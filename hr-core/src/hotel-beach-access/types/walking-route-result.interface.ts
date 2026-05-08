import { IGeoPoint } from './geo-point.interface';

export interface IWalkingRouteResult {
  origin: IGeoPoint;
  target: IGeoPoint;
  distanceMeters: number;
  durationSeconds: number;
  geometry: IGeoPoint[];
}
