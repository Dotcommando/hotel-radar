import { Injectable } from '@nestjs/common';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { IGetBeachProfilesStatsResult } from '../types/get-beach-profiles-stats-result.interface';

@Injectable()
export class GetBeachProfilesStatsUseCase {
  constructor(private readonly beachProfilesService: BeachProfilesService) {}

  async execute(): Promise<IGetBeachProfilesStatsResult> {
    return {
      ok: true,
      stats: await this.beachProfilesService.getStats(),
    };
  }
}
