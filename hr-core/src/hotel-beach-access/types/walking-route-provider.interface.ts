import { IWalkingRouteRequest } from './walking-route-request.interface';
import { IWalkingRouteResult } from './walking-route-result.interface';

export interface IWalkingRouteProvider {
  calculateWalkingRoute(
    params: IWalkingRouteRequest,
  ): Promise<IWalkingRouteResult | null>;
}
