import { Injectable } from '@nestjs/common';
import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { IBeachProfile } from '../../beach-profiles/types/beach-profile.interface';
import { HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE } from '../constants/hotel-beach-access-target-point-source.enum';
import { IGeoPoint } from '../types/geo-point.interface';
import { IHotelBeachAccessTargetPoint } from '../types/hotel-beach-access-target-point.interface';
import { GeoDistanceService } from './geo-distance.service';

const MAX_TARGET_POINTS = 5;

@Injectable()
export class BeachRoutingTargetPointService {
  constructor(private readonly geoDistanceService = new GeoDistanceService()) {}

  buildTargetPoints(
    beach: IBeachProfile,
    hotelPoint: IGeoPoint,
  ): IHotelBeachAccessTargetPoint[] {
    if (beach.accessPoints.length > 0) {
      return beach.accessPoints
        .map((accessPoint) => ({
          label: accessPoint.label,
          point: accessPoint.point,
          source:
            HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.CURATED_ACCESS_POINT,
        }))
        .sort(
          (first, second) =>
            this.geoDistanceService.calculateMeters(first.point, hotelPoint) -
            this.geoDistanceService.calculateMeters(second.point, hotelPoint),
        )
        .slice(0, MAX_TARGET_POINTS);
    }

    if (beach.geometryKind === BEACH_GEOMETRY_KIND.LINE) {
      const linePoints = this.readLinePoints(beach.geometry.coordinates);

      if (linePoints.length > 0) {
        return this.dedupePoints(
          this.samplePoints(linePoints).map((point) => ({
            label: null,
            point,
            source:
              HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.GEOMETRY_LINE_SAMPLE,
          })),
        ).slice(0, MAX_TARGET_POINTS);
      }
    }

    if (beach.geometryKind === BEACH_GEOMETRY_KIND.AREA) {
      const boundaryPoints = this.readAreaBoundaryPoints(
        beach.geometry.coordinates,
      );

      if (boundaryPoints.length > 0) {
        return this.dedupePoints(
          boundaryPoints
            .sort(
              (first, second) =>
                this.geoDistanceService.calculateMeters(first, hotelPoint) -
                this.geoDistanceService.calculateMeters(second, hotelPoint),
            )
            .slice(0, MAX_TARGET_POINTS)
            .map((point) => ({
              label: null,
              point,
              source:
                HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.GEOMETRY_BOUNDARY_SAMPLE,
            })),
        );
      }
    }

    return [
      {
        label: null,
        point: beach.point,
        source:
          HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE.FALLBACK_PROFILE_POINT,
      },
    ];
  }

  private samplePoints(points: IGeoPoint[]): IGeoPoint[] {
    if (points.length <= MAX_TARGET_POINTS) {
      return points;
    }

    return [0, 0.25, 0.5, 0.75, 1].map((position) => {
      const index = Math.min(
        points.length - 1,
        Math.round((points.length - 1) * position),
      );

      return points[index];
    });
  }

  private dedupePoints(
    points: IHotelBeachAccessTargetPoint[],
  ): IHotelBeachAccessTargetPoint[] {
    const seen = new Set<string>();
    const result: IHotelBeachAccessTargetPoint[] = [];

    for (const point of points) {
      const key = point.point.coordinates.join(',');

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(point);
    }

    return result;
  }

  private readLinePoints(coordinates: unknown): IGeoPoint[] {
    if (!Array.isArray(coordinates)) {
      return [];
    }

    return coordinates.flatMap((coordinate) =>
      this.readCoordinatePoint(coordinate),
    );
  }

  private readAreaBoundaryPoints(coordinates: unknown): IGeoPoint[] {
    if (!Array.isArray(coordinates)) {
      return [];
    }

    const firstRing = coordinates[0];

    if (!Array.isArray(firstRing)) {
      return [];
    }

    return firstRing.flatMap((coordinate) =>
      this.readCoordinatePoint(coordinate),
    );
  }

  private readCoordinatePoint(coordinate: unknown): IGeoPoint[] {
    if (
      !Array.isArray(coordinate) ||
      coordinate.length < 2 ||
      typeof coordinate[0] !== 'number' ||
      typeof coordinate[1] !== 'number'
    ) {
      return [];
    }

    return [
      {
        coordinates: [coordinate[0], coordinate[1]],
        type: 'Point',
      },
    ];
  }
}
