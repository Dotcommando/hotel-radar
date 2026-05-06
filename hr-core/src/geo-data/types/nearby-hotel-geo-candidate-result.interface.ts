import { IHotelGeoCandidateResult } from './hotel-geo-candidate-result.interface';

export interface INearbyHotelGeoCandidateResult extends IHotelGeoCandidateResult {
  distanceMeters: number;
}
