import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { MANUAL_CANONICAL_HOTEL_GEO_SOURCE } from '../constants/manual-canonical-hotel-geo-source.constant';
import { CanonicalHotelForGeoMatchNotFoundError } from '../errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualGeoConflictError } from '../errors/geo-hotel-manual-geo-conflict.error';
import { GeoHotelManualGeoInvalidQueryError } from '../errors/geo-hotel-manual-geo-invalid-query.error';
import { GeoHotelMatchInvalidIdError } from '../errors/geo-hotel-match-invalid-id.error';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { ISetManualCanonicalHotelGeoQuery } from '../types/set-manual-canonical-hotel-geo-query.interface';
import { ISetManualCanonicalHotelGeoResult } from '../types/set-manual-canonical-hotel-geo-result.interface';

@Injectable()
export class SetManualCanonicalHotelGeoUseCase {
  constructor(private readonly repository: GeoHotelMatchingRepository) {}

  async execute(
    query: ISetManualCanonicalHotelGeoQuery,
  ): Promise<ISetManualCanonicalHotelGeoResult> {
    const canonicalHotelId = this.parseObjectId(
      query.canonicalHotelId,
      'canonicalHotelId',
    );
    const lat = this.parseCoordinate(query.lat, 'lat', -90, 90);
    const lng = this.parseCoordinate(query.lng, 'lng', -180, 180);
    const point = {
      coordinates: [lng, lat] as [number, number],
      type: 'Point' as const,
    };
    const canonicalHotel =
      await this.repository.findCanonicalHotelForGeoMatchingById(
        canonicalHotelId,
      );

    if (canonicalHotel === null) {
      throw new CanonicalHotelForGeoMatchNotFoundError(
        canonicalHotelId.toString(),
      );
    }

    const action = await this.repository.applyManualCanonicalHotelGeo({
      canonicalHotelId,
      point,
    });

    if (action === GEO_MATCH_ACTION.CONFLICT) {
      throw new GeoHotelManualGeoConflictError();
    }

    return {
      action,
      canonicalHotelId: canonicalHotel._id.toString(),
      canonicalHotelName: canonicalHotel.canonicalName,
      geo: {
        point,
        source: MANUAL_CANONICAL_HOTEL_GEO_SOURCE,
      },
      ok: true,
    };
  }

  private parseObjectId(
    value: string | undefined,
    field: string,
  ): Types.ObjectId {
    if (value === undefined || value.trim().length === 0) {
      throw new GeoHotelMatchInvalidIdError(field);
    }

    const normalized = value.trim().toLowerCase();

    if (
      normalized.length !== 24 ||
      !Types.ObjectId.isValid(normalized) ||
      new Types.ObjectId(normalized).toString() !== normalized
    ) {
      throw new GeoHotelMatchInvalidIdError(field);
    }

    return new Types.ObjectId(normalized);
  }

  private parseCoordinate(
    value: string | undefined,
    field: string,
    min: number,
    max: number,
  ): number {
    if (value === undefined || value.trim().length === 0) {
      throw new GeoHotelManualGeoInvalidQueryError(field);
    }

    const parsed = Number.parseFloat(value);

    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new GeoHotelManualGeoInvalidQueryError(field);
    }

    return parsed;
  }
}
