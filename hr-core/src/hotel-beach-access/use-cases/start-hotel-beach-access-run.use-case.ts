import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CanonicalHotelsService } from '../../canonical-hotels/services/canonical-hotels.service';
import { VERSIONED_DATASET } from '../../data-versioning/constants/versioned-dataset.enum';
import { DataVersioningService } from '../../data-versioning/data-versioning.service';
import { HOTEL_BEACH_ACCESS_BATCH_SIZE } from '../constants/hotel-beach-access-defaults.constant';
import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { HotelBeachAccessActiveRunExistsError } from '../errors/hotel-beach-access-active-run-exists.error';
import { HotelBeachAccessNoEligibleHotelsError } from '../errors/hotel-beach-access-no-eligible-hotels.error';
import { HotelBeachAccessQueueService } from '../hotel-beach-access-queue.service';
import { HotelBeachAccessRunItemsService } from '../hotel-beach-access-run-items.service';
import { HotelBeachAccessRunsService } from '../hotel-beach-access-runs.service';
import { IStartHotelBeachAccessRunResult } from '../types/start-hotel-beach-access-run-result.interface';

@Injectable()
export class StartHotelBeachAccessRunUseCase {
  constructor(
    private readonly canonicalHotelsService: CanonicalHotelsService,
    private readonly runsService: HotelBeachAccessRunsService,
    private readonly runItemsService: HotelBeachAccessRunItemsService,
    private readonly queueService: HotelBeachAccessQueueService,
    private readonly dataVersioningService: DataVersioningService,
  ) {}

  async execute(): Promise<IStartHotelBeachAccessRunResult> {
    const hasActiveRun = await this.runsService.hasActiveRun();

    if (hasActiveRun) {
      throw new HotelBeachAccessActiveRunExistsError();
    }

    const total = await this.canonicalHotelsService.countActiveWithGeo();

    if (total === 0) {
      throw new HotelBeachAccessNoEligibleHotelsError();
    }

    const now = new Date();
    const runId = this.makeRunId(now);
    const datasetVersion =
      await this.dataVersioningService.reserveNextDatasetVersion({
        dataset: VERSIONED_DATASET.HOTEL_BEACH_ACCESS_EDGES,
        sourceRunId: runId,
      });
    const [ineligibleHotelsWithoutGeo, hotels] = await Promise.all([
      this.canonicalHotelsService.countActiveWithoutGeo(),
      this.canonicalHotelsService.listActiveWithGeo(),
    ]);
    const hotelIds: Types.ObjectId[] = hotels.map((hotel) => hotel._id);

    await this.runsService.createQueuedRun({
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      ineligibleHotelsWithoutGeo,
      runId,
      total,
    });
    await this.runItemsService.createPendingItems(runId, hotelIds);
    await this.queueService.addBatch({
      batchNo: 1,
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      datasetVersion,
      runId,
    });

    return {
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      ineligibleHotelsWithoutGeo,
      ok: true,
      runId,
      status: HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
      total,
    };
  }

  private makeRunId(date: Date): string {
    return `${date
      .toISOString()
      .replace(/\.\d{3}Z$/u, '')
      .replace(/:/g, '-')}-hotel-beach-access`;
  }
}
