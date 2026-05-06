import { Injectable } from '@nestjs/common';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { IHotelGeoCandidateNearbyFilters } from '../../hotel-geo-candidates/types/hotel-geo-candidate-nearby-filters.interface';
import { InvalidNearbyHotelGeoCandidatesQueryError } from '../errors/invalid-nearby-hotel-geo-candidates-query.error';
import { IListNearbyUnmatchedHotelGeoCandidatesQuery } from '../types/list-nearby-unmatched-hotel-geo-candidates-query.interface';
import { IListNearbyUnmatchedHotelGeoCandidatesResult } from '../types/list-nearby-unmatched-hotel-geo-candidates-result.interface';

const DEFAULT_RADIUS_METERS = 1000;
const MAX_RADIUS_METERS = 10000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListNearbyUnmatchedHotelGeoCandidatesUseCase {
  constructor(
    private readonly hotelGeoCandidatesService: HotelGeoCandidatesService,
  ) {}

  async execute(
    query: IListNearbyUnmatchedHotelGeoCandidatesQuery,
  ): Promise<IListNearbyUnmatchedHotelGeoCandidatesResult> {
    const filters = this.normalizeFilters(query);
    const items = await this.hotelGeoCandidatesService.listNearbyUnmatched(
      filters,
    );

    return {
      center: {
        lat: filters.lat,
        lng: filters.lng,
      },
      items,
      limit: filters.limit,
      ok: true,
      radiusMeters: filters.radiusMeters,
      total: items.length,
    };
  }

  private normalizeFilters(
    query: IListNearbyUnmatchedHotelGeoCandidatesQuery,
  ): IHotelGeoCandidateNearbyFilters {
    return {
      lat: this.normalizeCoordinate(query.lat, 'lat', -90, 90),
      limit: this.normalizeInteger(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
      lng: this.normalizeCoordinate(query.lng, 'lng', -180, 180),
      radiusMeters: this.normalizeInteger(
        query.radiusMeters,
        DEFAULT_RADIUS_METERS,
        1,
        MAX_RADIUS_METERS,
      ),
    };
  }

  private normalizeCoordinate(
    value: string | undefined,
    field: string,
    min: number,
    max: number,
  ): number {
    if (value === undefined || value.trim().length === 0) {
      throw new InvalidNearbyHotelGeoCandidatesQueryError(field);
    }

    const parsed = Number.parseFloat(value);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new InvalidNearbyHotelGeoCandidatesQueryError(field);
    }

    return parsed;
  }

  private normalizeInteger(
    value: string | undefined,
    defaultValue: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined || value.trim().length === 0) {
      return defaultValue;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }

    return Math.min(Math.max(parsed, min), max);
  }
}
