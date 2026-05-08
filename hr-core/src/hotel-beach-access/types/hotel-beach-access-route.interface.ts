import { IGeoPoint } from './geo-point.interface';
import { IHotelBeachAccessTargetPoint } from './hotel-beach-access-target-point.interface';

export interface IHotelBeachAccessRoute {
  originPoint: IGeoPoint;
  targetPoint: IHotelBeachAccessTargetPoint;
  walkingDistanceMeters: number;
  walkingDurationSeconds: number;
  geometry: IGeoPoint[];
}
