import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { BEACH_GEOMETRY_KIND } from '../constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../constants/beach-profile-lifecycle-status.enum';

export interface IBeachProfileListFilters {
  sourceType?: GEO_SOURCE_TYPE;
  sourceDataset?: GEO_SOURCE_DATASET;
  lifecycleStatus?: BEACH_PROFILE_LIFECYCLE_STATUS;
  geometryKind?: BEACH_GEOMETRY_KIND;
  q?: string;
  limit: number;
  offset: number;
}
