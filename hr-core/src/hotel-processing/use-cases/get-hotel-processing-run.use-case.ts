import { Injectable } from '@nestjs/common';
import { HotelProcessingRunNotFoundError } from '../errors/hotel-processing-run-not-found.error';
import { HotelProcessingRunsService } from '../hotel-processing-runs.service';
import { IGetHotelProcessingRunResult } from '../types/get-hotel-processing-run-result.interface';

@Injectable()
export class GetHotelProcessingRunUseCase {
  constructor(
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
  ) {}

  async execute(runId: string): Promise<IGetHotelProcessingRunResult> {
    const run = await this.hotelProcessingRunsService.findByRunId(runId);

    if (run === null) {
      throw new HotelProcessingRunNotFoundError();
    }

    return {
      batchSize: run.batchSize,
      currentBatch: run.currentBatch,
      error: run.error,
      finishedAt: run.finishedAt,
      ok: true,
      runId: run.runId,
      stage: run.stage,
      startedAt: run.startedAt,
      stats: run.stats,
      status: run.status,
    };
  }
}
