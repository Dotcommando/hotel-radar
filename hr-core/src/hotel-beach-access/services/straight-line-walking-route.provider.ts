import { Injectable } from '@nestjs/common';
import { GeoDistanceService } from './geo-distance.service';
import { IWalkingRouteProvider } from '../types/walking-route-provider.interface';
import { IWalkingRouteRequest } from '../types/walking-route-request.interface';
import { IWalkingRouteResult } from '../types/walking-route-result.interface';

@Injectable()
export class StraightLineWalkingRouteProvider implements IWalkingRouteProvider {
  constructor(private readonly geoDistanceService: GeoDistanceService) {}

  async calculateWalkingRoute(
    params: IWalkingRouteRequest,
  ): Promise<IWalkingRouteResult | null> {
    const distanceMeters = this.geoDistanceService.calculateMeters(
      params.origin,
      params.target,
    );

    return {
      distanceMeters,
      durationSeconds: Math.ceil(distanceMeters / 1.25),
      geometry: [params.origin, params.target],
      origin: params.origin,
      target: params.target,
    };
  }
}
