import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import type { IGeoPoint } from '../../canonical-hotels/types/hotel-geo.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { MANUAL_CANONICAL_HOTEL_COORDS_REGEXP } from '../constants/manual-canonical-hotel-coords-regexp.constant';
import { MANUAL_CANONICAL_HOTEL_GEO_SOURCE } from '../constants/manual-canonical-hotel-geo-source.constant';
import { CanonicalHotelForGeoMatchNotFoundError } from '../errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualGeoConflictError } from '../errors/geo-hotel-manual-geo-conflict.error';
import { GeoHotelManualGeoInvalidQueryError } from '../errors/geo-hotel-manual-geo-invalid-query.error';
import { GeoHotelMatchInvalidIdError } from '../errors/geo-hotel-match-invalid-id.error';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { ISetManualCanonicalHotelGeoQuery } from '../types/set-manual-canonical-hotel-geo-query.interface';
import { ISetManualCanonicalHotelGeoResult } from '../types/set-manual-canonical-hotel-geo-result.interface';
import { isCanonicalHotelEligibleForGeoMatching } from '../utils/canonical-hotel-geo-eligibility.util';

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
    const { lat, lng } = this.parseCoords(query.coords);
    const point: IGeoPoint = {
      coordinates: [lng, lat],
      type: 'Point',
    };
    const canonicalHotel =
      await this.repository.findCanonicalHotelForGeoMatchingById(
        canonicalHotelId,
      );

    if (
      canonicalHotel === null ||
      !isCanonicalHotelEligibleForGeoMatching(canonicalHotel)
    ) {
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

  private parseCoords(value: string | undefined): {
    lat: number;
    lng: number;
  } {
    if (value === undefined || value.trim().length === 0) {
      throw new GeoHotelManualGeoInvalidQueryError('coords');
    }

    const match = MANUAL_CANONICAL_HOTEL_COORDS_REGEXP.exec(value);

    if (match === null) {
      throw new GeoHotelManualGeoInvalidQueryError('coords');
    }

    const lat = Number(match[1]);
    const lng = Number(match[2]);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      throw new GeoHotelManualGeoInvalidQueryError('coords');
    }

    return { lat, lng };
  }
}
