import { IHotelGeoCandidateResult } from './hotel-geo-candidate-result.interface';

export interface IListHotelGeoCandidatesResult {
  ok: boolean;
  total: number;
  limit: number;
  offset: number;
  items: IHotelGeoCandidateResult[];
}
