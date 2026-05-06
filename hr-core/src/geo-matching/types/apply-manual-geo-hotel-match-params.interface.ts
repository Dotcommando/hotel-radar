import { Types } from 'mongoose';
import { IHotelGeoPoint } from '../../hotel-geo-candidates/types/hotel-geo-point.interface';

export interface IApplyManualGeoHotelMatchParams {
  canonicalHotelId: Types.ObjectId;
  hotelGeoCandidateId: Types.ObjectId;
  point: IHotelGeoPoint;
}
