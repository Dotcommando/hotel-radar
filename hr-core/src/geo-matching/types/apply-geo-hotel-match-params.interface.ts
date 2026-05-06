import { Types } from 'mongoose';
import { IHotelGeoPoint } from '../../hotel-geo-candidates/types/hotel-geo-point.interface';
import { GEO_MATCH_REASON } from '../constants/geo-match-reason.enum';

export interface IApplyGeoHotelMatchParams {
  canonicalHotelId: Types.ObjectId;
  componentId: string | null;
  hotelGeoCandidateId: Types.ObjectId;
  point: IHotelGeoPoint;
  reasons: GEO_MATCH_REASON[];
  score: number;
}
