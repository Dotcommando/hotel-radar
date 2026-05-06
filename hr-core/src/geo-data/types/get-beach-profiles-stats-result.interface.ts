import { IBeachProfilesStats } from '../../beach-profiles/types/beach-profiles-stats.interface';

export interface IGetBeachProfilesStatsResult {
  ok: boolean;
  stats: IBeachProfilesStats;
}
