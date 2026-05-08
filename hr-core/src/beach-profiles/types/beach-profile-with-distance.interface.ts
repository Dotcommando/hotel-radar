import { IBeachProfile } from './beach-profile.interface';

export interface IBeachProfileWithDistance extends IBeachProfile {
  distanceMeters: number;
}
