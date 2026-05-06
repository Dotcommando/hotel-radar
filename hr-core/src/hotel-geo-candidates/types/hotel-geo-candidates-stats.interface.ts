import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../constants/hotel-geo-candidate-match-status.enum';

export interface IHotelGeoCandidatesStats {
  total: number;
  withName: number;
  withPhone: number;
  withWebsite: number;
  byTourismTag: Record<string, number>;
  byLifecycleStatus: Record<HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS, number>;
  byMatchStatus: Record<HOTEL_GEO_CANDIDATE_MATCH_STATUS, number>;
}
