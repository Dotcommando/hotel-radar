import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';

export interface IListHotelGeoCandidatesQuery {
  sourceType?: GEO_SOURCE_TYPE;
  sourceDataset?: GEO_SOURCE_DATASET;
  lifecycleStatus?: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS;
  matchStatus?: HOTEL_GEO_CANDIDATE_MATCH_STATUS;
  q?: string;
  limit?: string;
  offset?: string;
}
