import { IHotelGeoCandidate } from './hotel-geo-candidate.interface';

export interface IHotelGeoCandidateWithDistance extends IHotelGeoCandidate {
  distanceMeters: number;
}
