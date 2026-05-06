import { IBeachProfileResult } from './beach-profile-result.interface';

export interface IListBeachProfilesResult {
  ok: boolean;
  total: number;
  limit: number;
  offset: number;
  items: IBeachProfileResult[];
}
