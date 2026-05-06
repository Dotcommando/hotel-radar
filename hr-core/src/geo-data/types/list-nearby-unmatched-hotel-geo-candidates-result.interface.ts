import { INearbyHotelGeoCandidateResult } from './nearby-hotel-geo-candidate-result.interface';

export interface IListNearbyUnmatchedHotelGeoCandidatesCenterResult {
  lat: number;
  lng: number;
}

export interface IListNearbyUnmatchedHotelGeoCandidatesResult {
  ok: true;
  center: IListNearbyUnmatchedHotelGeoCandidatesCenterResult;
  radiusMeters: number;
  limit: number;
  total: number;
  items: INearbyHotelGeoCandidateResult[];
}
