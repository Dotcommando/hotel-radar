import { Injectable } from '@nestjs/common';
import { CanonicalHotelCandidatesService } from '../canonical-hotel-candidates/canonical-hotel-candidates.service';
import { HotelRegistryEntriesService } from '../hotel-registry-entries/hotel-registry-entries.service';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../hotel-registry-entries/constants/hotel-registry-entry-status.enum';
import { RawHotelsService } from '../raw-hotels/raw-hotels.service';
import { HOTEL_PROCESSING_STATUS } from './constants/hotel-processing-status.enum';
import { HOTEL_PROCESSING_STAGE } from './constants/hotel-processing-stage.enum';
import { IHotelProcessingBatchJobData } from './types/hotel-processing-batch-job-data.interface';
import { HotelProcessingQueueService } from './hotel-processing-queue.service';
import { HotelProcessingRunsService } from './hotel-processing-runs.service';

@Injectable()
export class HotelProcessingBatchProcessor {
  constructor(
    private readonly rawHotelsService: RawHotelsService,
    private readonly hotelRegistryEntriesService: HotelRegistryEntriesService,
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
    private readonly hotelProcessingQueueService: HotelProcessingQueueService,
    private readonly canonicalHotelCandidatesService: CanonicalHotelCandidatesService,
  ) {}

  async processRawToRegistryBatch(
    data: IHotelProcessingBatchJobData,
  ): Promise<void> {
    if (data.stage !== HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY) {
      throw new Error(`Unsupported hotel processing stage: ${data.stage}`);
    }

    await this.hotelProcessingRunsService.markRunning(data.runId, data.batchNo);

    const rawHotels = await this.rawHotelsService.claimPendingForRun(
      data.runId,
      data.batchSize,
    );
    let processed = 0;
    let failed = 0;

    for (const rawHotel of rawHotels) {
      try {
        const result =
          await this.hotelRegistryEntriesService.upsertFromRawHotel(rawHotel);

        await this.rawHotelsService.markProcessed(
          rawHotel._id,
          result.entry._id,
        );
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown raw hotel processing error';

        await this.rawHotelsService.markFailed(rawHotel._id, message);
        failed += 1;
      }
    }

    await this.hotelProcessingRunsService.incrementProcessed(
      data.runId,
      processed,
      failed,
    );

    if (failed > 0) {
      await this.hotelProcessingRunsService.fail(
        data.runId,
        'One or more raw hotels failed.',
      );
      return;
    }

    const pendingCount = await this.rawHotelsService.countByProcessingStatus(
      HOTEL_PROCESSING_STATUS.PENDING,
    );

    if (pendingCount > 0) {
      await this.hotelProcessingQueueService.addRawToRegistryBatch({
        batchNo: data.batchNo + 1,
        batchSize: data.batchSize,
        runId: data.runId,
        stage: data.stage,
      });
      return;
    }

    await this.hotelProcessingRunsService.complete(data.runId);
  }

  async processRegistryToCandidatesBatch(
    data: IHotelProcessingBatchJobData,
  ): Promise<void> {
    if (data.stage !== HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES) {
      throw new Error(`Unsupported hotel processing stage: ${data.stage}`);
    }

    await this.hotelProcessingRunsService.markRunning(data.runId, data.batchNo);

    const registryEntries =
      await this.hotelRegistryEntriesService.claimPendingForRun(
        data.runId,
        data.batchSize,
      );
    const processedRegistryEntryIds = new Set<string>();
    let processed = 0;
    let ignored = 0;
    let failed = 0;

    for (const registryEntry of registryEntries) {
      const registryEntryId = registryEntry._id.toString();

      if (processedRegistryEntryIds.has(registryEntryId)) {
        continue;
      }

      if (registryEntry.status === HOTEL_REGISTRY_ENTRY_STATUS.BLOCKED) {
        await this.hotelRegistryEntriesService.markIgnored(
          registryEntry._id,
          this.buildBlockedRegistryEntryMessage(registryEntry.issues),
        );
        processedRegistryEntryIds.add(registryEntryId);
        ignored += 1;
        continue;
      }

      try {
        const groupEntries =
          await this.hotelRegistryEntriesService.readSafeCanonicalCandidateGroup(
            registryEntry,
          );
        const hasAmbiguousNumericSuffixGroup =
          groupEntries.length === 1 &&
          (await this.hotelRegistryEntriesService.hasCompatibleNumericSuffixGroup(
            registryEntry,
          ));
        const candidate = hasAmbiguousNumericSuffixGroup
          ? await this.canonicalHotelCandidatesService.upsertAmbiguousBaseCandidate(
              registryEntry,
            )
          : await this.canonicalHotelCandidatesService.upsertFromRegistryEntries(
              groupEntries,
            );

        for (const groupEntry of groupEntries) {
          const groupEntryId = groupEntry._id.toString();

          if (processedRegistryEntryIds.has(groupEntryId)) {
            continue;
          }

          await this.hotelRegistryEntriesService.markProcessed(
            groupEntry._id,
            candidate._id,
            data.runId,
          );
          processedRegistryEntryIds.add(groupEntryId);

          if (
            groupEntry.processing.status !== HOTEL_PROCESSING_STATUS.PROCESSED
          ) {
            processed += 1;
          }
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown registry entry processing error';

        await this.hotelRegistryEntriesService.markFailed(
          registryEntry._id,
          message,
        );
        processedRegistryEntryIds.add(registryEntryId);
        failed += 1;
      }
    }

    if (processed > 0 || failed > 0) {
      await this.hotelProcessingRunsService.incrementProcessed(
        data.runId,
        processed,
        failed,
      );
    }

    if (ignored > 0) {
      await this.hotelProcessingRunsService.incrementIgnored(
        data.runId,
        ignored,
      );
    }

    if (failed > 0) {
      await this.hotelProcessingRunsService.fail(
        data.runId,
        'One or more registry entries failed.',
      );
      return;
    }

    const pendingCount =
      await this.hotelRegistryEntriesService.countByProcessingStatus(
        HOTEL_PROCESSING_STATUS.PENDING,
      );

    if (pendingCount > 0) {
      await this.hotelProcessingQueueService.addRegistryToCandidatesBatch({
        batchNo: data.batchNo + 1,
        batchSize: data.batchSize,
        runId: data.runId,
        stage: data.stage,
      });
      return;
    }

    await this.hotelProcessingRunsService.complete(data.runId);
  }

  private buildBlockedRegistryEntryMessage(issues: string[]): string {
    if (issues.length === 0) {
      return 'Registry entry is blocked.';
    }

    return `Registry entry is blocked: ${issues.join(', ')}`;
  }
}
