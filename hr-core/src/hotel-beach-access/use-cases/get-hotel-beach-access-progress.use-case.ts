import { Injectable } from '@nestjs/common';
import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { HotelBeachAccessRunsService } from '../hotel-beach-access-runs.service';
import { IGetHotelBeachAccessProgressResult } from '../types/get-hotel-beach-access-progress-result.interface';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';

@Injectable()
export class GetHotelBeachAccessProgressUseCase {
  constructor(private readonly runsService: HotelBeachAccessRunsService) {}

  async execute(): Promise<IGetHotelBeachAccessProgressResult> {
    const run =
      (await this.runsService.findActiveRun()) ??
      (await this.runsService.findLatestRun());

    if (run === null) {
      return {
        failed: 0,
        ineligibleHotelsWithoutGeo: 0,
        ok: true,
        percent: 0,
        processed: 0,
        runId: null,
        skipped: 0,
        status: null,
        total: 0,
      };
    }

    return {
      failed: run.stats.failed,
      ineligibleHotelsWithoutGeo: run.ineligibleHotelsWithoutGeo,
      ok: true,
      percent: this.calculatePercent(run),
      processed: run.stats.processed,
      runId: run.runId,
      skipped: run.stats.skipped,
      status: run.status,
      total: run.stats.total,
    };
  }

  private calculatePercent(run: IHotelBeachAccessRun): number {
    if (run.stats.total === 0) {
      return run.status === HOTEL_BEACH_ACCESS_RUN_STATUS.COMPLETED ? 100 : 0;
    }

    const done = run.stats.processed + run.stats.failed + run.stats.skipped;
    const percent = Math.floor((done / run.stats.total) * 1000) / 10;

    if (
      percent >= 100 &&
      run.status !== HOTEL_BEACH_ACCESS_RUN_STATUS.COMPLETED
    ) {
      return 99.9;
    }

    return percent;
  }
}
