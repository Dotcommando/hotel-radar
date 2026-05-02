import { Injectable } from '@nestjs/common';
import { HotelRegistryEntriesService } from '../../hotel-registry-entries/hotel-registry-entries.service';
import { RawHotelsService } from '../../raw-hotels/raw-hotels.service';
import {
  HOTEL_PROCESSING_BATCH_SIZE,
  HOTEL_PROCESSING_STALE_CLAIM_TIMEOUT_MS,
} from '../constants/hotel-processing-defaults.constant';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../constants/hotel-processing-status.enum';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoPendingSourceDocumentsError } from '../errors/hotel-processing-no-pending-source-documents.error';
import { HotelProcessingPreviousStageNotCompletedError } from '../errors/hotel-processing-previous-stage-not-completed.error';
import { HotelProcessingQueueService } from '../hotel-processing-queue.service';
import { HotelProcessingRunsService } from '../hotel-processing-runs.service';
import { IStartHotelProcessingRunResult } from '../types/start-hotel-processing-run-result.interface';

@Injectable()
export class StartRegistryToCandidatesRunUseCase {
  constructor(
    private readonly rawHotelsService: RawHotelsService,
    private readonly hotelRegistryEntriesService: HotelRegistryEntriesService,
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
    private readonly hotelProcessingQueueService: HotelProcessingQueueService,
  ) {}

  async execute(): Promise<IStartHotelProcessingRunResult> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - HOTEL_PROCESSING_STALE_CLAIM_TIMEOUT_MS,
    );

    await this.hotelRegistryEntriesService.initializeMissingProcessing();
    await this.hotelRegistryEntriesService.recoverStaleClaimedDocuments(
      staleBefore,
    );
    await this.assertRawToRegistryCompleted();

    const hasActiveRun = await this.hotelProcessingRunsService.hasActiveRun(
      HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    );

    if (hasActiveRun) {
      throw new HotelProcessingActiveRunExistsError();
    }

    const total =
      await this.hotelRegistryEntriesService.countByProcessingStatus(
        HOTEL_PROCESSING_STATUS.PENDING,
      );

    if (total === 0) {
      throw new HotelProcessingNoPendingSourceDocumentsError();
    }

    const runId = this.makeRunId(now);

    await this.hotelProcessingRunsService.createQueuedRun({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId,
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      total,
    });
    await this.hotelProcessingQueueService.addRegistryToCandidatesBatch({
      batchNo: 1,
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId,
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });

    return {
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      ok: true,
      runId,
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    };
  }

  private async assertRawToRegistryCompleted(): Promise<void> {
    const pending = await this.rawHotelsService.countByProcessingStatus(
      HOTEL_PROCESSING_STATUS.PENDING,
    );
    const claimed = await this.rawHotelsService.countByProcessingStatus(
      HOTEL_PROCESSING_STATUS.CLAIMED,
    );
    const failed = await this.rawHotelsService.countByProcessingStatus(
      HOTEL_PROCESSING_STATUS.FAILED,
    );

    if (pending > 0 || claimed > 0 || failed > 0) {
      throw new HotelProcessingPreviousStageNotCompletedError({
        blockingStage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
        claimed,
        failed,
        pending,
      });
    }
  }

  private makeRunId(date: Date): string {
    return `${date
      .toISOString()
      .replace(/\.\d{3}Z$/u, '')
      .replace(/:/g, '-')}-registry-to-candidates`;
  }
}
