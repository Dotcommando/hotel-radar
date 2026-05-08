import { IGeoPoint } from './geo-point.interface';

export interface IWalkingRouteRequest {
  origin: IGeoPoint;
  target: IGeoPoint;
}
