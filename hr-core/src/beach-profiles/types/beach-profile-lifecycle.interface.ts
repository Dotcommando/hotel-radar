import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../constants/beach-profile-lifecycle-status.enum';

export interface IBeachProfileLifecycle {
  status: BEACH_PROFILE_LIFECYCLE_STATUS;
  firstSeenAt: Date;
  lastSeenAt: Date;
  notSeenSince: Date | null;
}
