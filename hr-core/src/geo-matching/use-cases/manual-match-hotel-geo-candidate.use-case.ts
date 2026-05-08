import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { CanonicalHotelForGeoMatchNotFoundError } from '../errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualMatchConflictError } from '../errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from '../errors/geo-hotel-match-invalid-id.error';
import { HotelGeoCandidateForMatchNotFoundError } from '../errors/hotel-geo-candidate-for-match-not-found.error';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IManualMatchHotelGeoCandidateQuery } from '../types/manual-match-hotel-geo-candidate-query.interface';
import { IManualMatchHotelGeoCandidateResult } from '../types/manual-match-hotel-geo-candidate-result.interface';
import { isCanonicalHotelEligibleForGeoMatching } from '../utils/canonical-hotel-geo-eligibility.util';

@Injectable()
export class ManualMatchHotelGeoCandidateUseCase {
  constructor(private readonly repository: GeoHotelMatchingRepository) {}

  async execute(
    query: IManualMatchHotelGeoCandidateQuery,
  ): Promise<IManualMatchHotelGeoCandidateResult> {
    const canonicalHotelId = this.parseObjectId(
      query.canonicalHotelId,
      'canonicalHotelId',
    );
    const hotelGeoCandidateId = this.parseObjectId(
      query.hotelGeoCandidateId,
      'hotelGeoCandidateId',
    );
    const [canonicalHotel, hotelGeoCandidate] = await Promise.all([
      this.repository.findCanonicalHotelForGeoMatchingById(canonicalHotelId),
      this.repository.findHotelGeoCandidateForGeoMatchingById(
        hotelGeoCandidateId,
      ),
    ]);

    if (
      canonicalHotel === null ||
      !isCanonicalHotelEligibleForGeoMatching(canonicalHotel)
    ) {
      throw new CanonicalHotelForGeoMatchNotFoundError(
        canonicalHotelId.toString(),
      );
    }

    if (hotelGeoCandidate === null) {
      throw new HotelGeoCandidateForMatchNotFoundError(
        hotelGeoCandidateId.toString(),
      );
    }

    const action = await this.repository.applyManualMatch({
      canonicalHotelId,
      hotelGeoCandidateId,
      point: hotelGeoCandidate.point,
    });

    if (action === GEO_MATCH_ACTION.CONFLICT) {
      throw new GeoHotelManualMatchConflictError();
    }

    return {
      action,
      canonicalHotelId: canonicalHotel._id.toString(),
      canonicalHotelName: canonicalHotel.canonicalName,
      hotelGeoCandidateId: hotelGeoCandidate._id.toString(),
      hotelGeoCandidateName: hotelGeoCandidate.name,
      hotelGeoCandidateSourceId: hotelGeoCandidate.source.id,
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
}
