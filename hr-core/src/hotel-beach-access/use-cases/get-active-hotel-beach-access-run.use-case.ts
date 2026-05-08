import { Injectable } from '@nestjs/common';
import { HotelBeachAccessRunsService } from '../hotel-beach-access-runs.service';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';

@Injectable()
export class GetActiveHotelBeachAccessRunUseCase {
  constructor(private readonly runsService: HotelBeachAccessRunsService) {}

  async execute(): Promise<{
    ok: true;
    run: IHotelBeachAccessRun | null;
  }> {
    return {
      ok: true,
      run: await this.runsService.findActiveRun(),
    };
  }
}
