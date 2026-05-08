import { Injectable } from '@nestjs/common';
import { HotelBeachAccessRunNotFoundError } from '../errors/hotel-beach-access-run-not-found.error';
import { HotelBeachAccessRunsService } from '../hotel-beach-access-runs.service';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';

@Injectable()
export class GetHotelBeachAccessRunUseCase {
  constructor(private readonly runsService: HotelBeachAccessRunsService) {}

  async execute(runId: string): Promise<IHotelBeachAccessRun> {
    const run = await this.runsService.findByRunId(runId);

    if (run === null) {
      throw new HotelBeachAccessRunNotFoundError(runId);
    }

    return run;
  }
}
