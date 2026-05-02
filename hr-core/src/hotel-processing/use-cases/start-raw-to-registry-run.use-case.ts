import { Injectable } from '@nestjs/common';
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
import { HotelProcessingQueueService } from '../hotel-processing-queue.service';
import { HotelProcessingRunsService } from '../hotel-processing-runs.service';
import { IStartHotelProcessingRunResult } from '../types/start-hotel-processing-run-result.interface';

@Injectable()
export class StartRawToRegistryRunUseCase {
  constructor(
    private readonly rawHotelsService: RawHotelsService,
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
    private readonly hotelProcessingQueueService: HotelProcessingQueueService,
  ) {}

  async execute(): Promise<IStartHotelProcessingRunResult> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - HOTEL_PROCESSING_STALE_CLAIM_TIMEOUT_MS,
    );

    await this.rawHotelsService.initializeMissingProcessing();
    await this.rawHotelsService.recoverStaleClaimedDocuments(staleBefore);

    const hasActiveRun = await this.hotelProcessingRunsService.hasActiveRun(
      HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
    );

    if (hasActiveRun) {
      throw new HotelProcessingActiveRunExistsError();
    }

    const total = await this.rawHotelsService.countByProcessingStatus(
      HOTEL_PROCESSING_STATUS.PENDING,
    );

    if (total === 0) {
      throw new HotelProcessingNoPendingSourceDocumentsError();
    }

    const runId = this.makeRunId(now);

    await this.hotelProcessingRunsService.createQueuedRun({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId,
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      total,
    });
    await this.hotelProcessingQueueService.addRawToRegistryBatch({
      batchNo: 1,
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId,
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
    });

    return {
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      ok: true,
      runId,
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    };
  }

  private makeRunId(date: Date): string {
    return `${date
      .toISOString()
      .replace(/\.\d{3}Z$/u, '')
      .replace(/:/g, '-')}-raw-to-registry`;
  }
}
