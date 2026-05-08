import { Injectable } from '@nestjs/common';
import { IGeoPoint } from '../types/geo-point.interface';

@Injectable()
export class GeoDistanceService {
  calculateMeters(first: IGeoPoint, second: IGeoPoint): number {
    const earthRadiusMeters = 6371000;
    const firstLatitude = this.toRadians(first.coordinates[1]);
    const secondLatitude = this.toRadians(second.coordinates[1]);
    const latitudeDelta = this.toRadians(
      second.coordinates[1] - first.coordinates[1],
    );
    const longitudeDelta = this.toRadians(
      second.coordinates[0] - first.coordinates[0],
    );
    const haversine =
      Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
      Math.cos(firstLatitude) *
        Math.cos(secondLatitude) *
        Math.sin(longitudeDelta / 2) *
        Math.sin(longitudeDelta / 2);
    const angularDistance =
      2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

    return Math.round(earthRadiusMeters * angularDistance);
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
