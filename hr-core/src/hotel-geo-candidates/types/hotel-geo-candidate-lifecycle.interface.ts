import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../constants/hotel-geo-candidate-lifecycle-status.enum';

export interface IHotelGeoCandidateLifecycle {
  status: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS;
  firstSeenAt: Date;
  lastSeenAt: Date;
  notSeenSince: Date | null;
}
