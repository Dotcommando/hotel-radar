import { Injectable } from '@nestjs/common';
import { HotelRegistryEntriesService } from '../hotel-registry-entries/hotel-registry-entries.service';
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
}
