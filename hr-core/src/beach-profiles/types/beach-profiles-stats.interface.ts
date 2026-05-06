import { BEACH_GEOMETRY_KIND } from '../constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../constants/beach-profile-lifecycle-status.enum';
import { BEACH_QUALITY_STATUS } from '../constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../constants/beach-type.enum';

export interface IBeachProfilesStats {
  total: number;
  withName: number;
  byGeometryKind: Record<BEACH_GEOMETRY_KIND, number>;
  byLifecycleStatus: Record<BEACH_PROFILE_LIFECYCLE_STATUS, number>;
  byQualityStatus: Record<BEACH_QUALITY_STATUS, number>;
  byBeachType: Record<BEACH_TYPE, number>;
}
