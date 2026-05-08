import { HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE } from '../constants/hotel-beach-access-target-point-source.enum';
import { IGeoPoint } from './geo-point.interface';

export interface IHotelBeachAccessTargetPoint {
  point: IGeoPoint;
  source: HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE;
  label: string | null;
}
