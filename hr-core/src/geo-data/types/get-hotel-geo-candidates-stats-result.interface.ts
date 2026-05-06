import { IHotelGeoCandidatesStats } from '../../hotel-geo-candidates/types/hotel-geo-candidates-stats.interface';

export interface IGetHotelGeoCandidatesStatsResult {
  ok: boolean;
  stats: IHotelGeoCandidatesStats;
}
