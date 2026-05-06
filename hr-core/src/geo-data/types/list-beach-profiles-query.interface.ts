import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../../beach-profiles/constants/beach-profile-lifecycle-status.enum';

export interface IListBeachProfilesQuery {
  sourceType?: GEO_SOURCE_TYPE;
  sourceDataset?: GEO_SOURCE_DATASET;
  lifecycleStatus?: BEACH_PROFILE_LIFECYCLE_STATUS;
  geometryKind?: BEACH_GEOMETRY_KIND;
  q?: string;
  limit?: string;
  offset?: string;
}
