import { Injectable } from '@nestjs/common';
import { CanonicalHotelCandidatesService } from '../canonical-hotel-candidates/canonical-hotel-candidates.service';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../canonical-hotels/constants/canonical-hotel-processing-action.enum';
import { CanonicalHotelsService } from '../canonical-hotels/services/canonical-hotels.service';
import { VERSIONED_DATASET } from '../data-versioning/constants/versioned-dataset.enum';
import { DataVersioningService } from '../data-versioning/data-versioning.service';
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
    private readonly canonicalHotelsService: CanonicalHotelsService,
    private readonly dataVersioningService: DataVersioningService,
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
        const shadowAggregateGroup =
          await this.hotelRegistryEntriesService.readShadowAggregateNumericSuffixGroup(
            registryEntry,
          );

        if (shadowAggregateGroup !== null) {
          const candidate =
            await this.canonicalHotelCandidatesService.upsertFromRegistryEntries(
              shadowAggregateGroup.numberedEntries,
            );

          for (const groupEntry of shadowAggregateGroup.numberedEntries) {
            const groupEntryId = groupEntry._id.toString();

            if (!processedRegistryEntryIds.has(groupEntryId)) {
              await this.hotelRegistryEntriesService.markProcessed(
                groupEntry._id,
                candidate._id,
                data.runId,
              );
              processedRegistryEntryIds.add(groupEntryId);

              if (
                groupEntry.processing.status !==
                HOTEL_PROCESSING_STATUS.PROCESSED
              ) {
                processed += 1;
              }
            }
          }

          for (const shadowAggregateEntry of shadowAggregateGroup.shadowAggregateEntries) {
            const shadowAggregateEntryId =
              shadowAggregateEntry._id.toString();

            if (!processedRegistryEntryIds.has(shadowAggregateEntryId)) {
              await this.hotelRegistryEntriesService.markShadowAggregateIgnored(
                shadowAggregateEntry._id,
                this.buildShadowAggregateMessage(shadowAggregateEntry),
              );
              processedRegistryEntryIds.add(shadowAggregateEntryId);
              ignored += 1;
            }
          }

          continue;
        }

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

  async processCandidatesToCanonicalBatch(
    data: IHotelProcessingBatchJobData,
  ): Promise<void> {
    if (data.stage !== HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL) {
      throw new Error(`Unsupported hotel processing stage: ${data.stage}`);
    }

    if (data.datasetVersion === undefined) {
      throw new Error('Canonical hotels dataset version is missing.');
    }

    await this.hotelProcessingRunsService.markRunning(data.runId, data.batchNo);

    const candidates =
      await this.canonicalHotelCandidatesService.claimPendingForRun(
        data.runId,
        data.batchSize,
      );
    let processed = 0;
    let reviewRequired = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const result = await this.canonicalHotelsService.applyCandidate(
          candidate,
          data.datasetVersion,
        );

        if (
          result.action === CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED
        ) {
          if (result.review === null) {
            throw new Error('Canonical hotel review result is missing review.');
          }

          await this.canonicalHotelCandidatesService.markCanonicalReviewRequired(
            candidate._id,
            data.runId,
            result.review,
          );
          reviewRequired += 1;
          continue;
        }

        if (result.canonicalHotelId === null) {
          throw new Error(
            'Canonical hotel processing result is missing canonicalHotelId.',
          );
        }

        await this.canonicalHotelCandidatesService.markCanonicalProcessed(
          candidate._id,
          result.canonicalHotelId,
          data.runId,
          result.action,
        );
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown candidate processing error';

        await this.canonicalHotelCandidatesService.markCanonicalFailed(
          candidate._id,
          message,
        );
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

    if (reviewRequired > 0) {
      await this.hotelProcessingRunsService.incrementReviewRequired(
        data.runId,
        reviewRequired,
      );
    }

    if (failed > 0) {
      await this.hotelProcessingRunsService.fail(
        data.runId,
        'One or more canonical hotel candidates failed.',
      );
      return;
    }

    const pendingCount =
      await this.canonicalHotelCandidatesService.countByProcessingStatus(
        HOTEL_PROCESSING_STATUS.PENDING,
      );

    if (pendingCount > 0) {
      await this.hotelProcessingQueueService.addCandidatesToCanonicalBatch({
        batchNo: data.batchNo + 1,
        batchSize: data.batchSize,
        datasetVersion: data.datasetVersion,
        runId: data.runId,
        stage: data.stage,
      });
      return;
    }

    await this.canonicalHotelsService.markAllWithDatasetVersion(
      data.datasetVersion,
    );
    await this.dataVersioningService.publishDatasetVersion({
      dataset: VERSIONED_DATASET.CANONICAL_HOTELS,
      version: data.datasetVersion,
    });
    await this.hotelProcessingRunsService.complete(data.runId);
  }

  private buildBlockedRegistryEntryMessage(issues: string[]): string {
    if (issues.length === 0) {
      return 'Registry entry is blocked.';
    }

    return `Registry entry is blocked: ${issues.join(', ')}`;
  }

  private buildShadowAggregateMessage(registryEntry: {
    location: {
      address: string | null;
      postcode: string | null;
    };
    name: {
      baseName: string;
    };
  }): string {
    return [
      'Ignored as shadow aggregate of numeric suffix group:',
      registryEntry.name.baseName,
      'postcode',
      registryEntry.location.postcode ?? '',
      'address',
      registryEntry.location.address ?? '',
    ]
      .join(' ')
      .trim();
  }
}
