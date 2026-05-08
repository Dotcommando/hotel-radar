import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CANONICAL_HOTEL_MODEL_NAME } from '../../canonical-hotels/constants/canonical-hotel-model-name.constant';
import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../../canonical-hotels/constants/canonical-hotel-verification-status.enum';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { HOTEL_GEO_CANDIDATE_MODEL_NAME } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-model-name.constant';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { MANUAL_CANONICAL_HOTEL_GEO_SOURCE } from '../constants/manual-canonical-hotel-geo-source.constant';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualCanonicalHotelGeoParams } from '../types/apply-manual-canonical-hotel-geo-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';
import { GeoHotelMatchingRepository } from './geo-hotel-matching.repository';

@Injectable()
export class MongooseGeoHotelMatchingRepository extends GeoHotelMatchingRepository {
  constructor(
    @InjectModel(CANONICAL_HOTEL_MODEL_NAME)
    private readonly canonicalHotelModel: Model<ICanonicalHotel>,
    @InjectModel(HOTEL_GEO_CANDIDATE_MODEL_NAME)
    private readonly hotelGeoCandidateModel: Model<IHotelGeoCandidate>,
  ) {
    super();
  }

  async findCanonicalHotelForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<ICanonicalHotel | null> {
    return this.canonicalHotelModel
      .findOne({
        _id: id,
        status: CANONICAL_HOTEL_STATUS.ACTIVE,
      })
      .exec();
  }

  async findHotelGeoCandidateForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<IHotelGeoCandidate | null> {
    return this.hotelGeoCandidateModel.findById(id).exec();
  }

  async listCanonicalHotelIdsWithMergedGeoCandidates(): Promise<string[]> {
    const ids = await this.hotelGeoCandidateModel
      .distinct('canonicalHotelId', {
        'lifecycle.status': HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
        canonicalHotelId: {
          $ne: null,
        },
        matchStatus: {
          $in: [
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
          ],
        },
      })
      .exec();

    return ids
      .filter((id): id is Types.ObjectId => id instanceof Types.ObjectId)
      .map((id) => id.toString());
  }

  async listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]> {
    return this.canonicalHotelModel
      .find({
        status: CANONICAL_HOTEL_STATUS.ACTIVE,
      })
      .exec();
  }

  async listHotelGeoCandidatesForAutoMatching(
    limit: number,
  ): Promise<IHotelGeoCandidate[]> {
    const query = this.hotelGeoCandidateModel
      .find({
        'lifecycle.status': HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
        matchStatus: {
          $in: [
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
          ],
        },
      })
      .sort({
        updatedAt: -1,
        _id: 1,
      });

    if (limit > 0) {
      query.limit(limit);
    }

    return query.exec();
  }

  async applyAutoMatch(
    params: IApplyGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    const source = this.buildCanonicalGeoSource(params.hotelGeoCandidateId);
    const now = new Date();
    const existingCandidate = await this.hotelGeoCandidateModel
      .findById(params.hotelGeoCandidateId)
      .exec();

    if (existingCandidate === null) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const wasAlreadyMatched =
      existingCandidate.matchStatus ===
        HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED &&
      existingCandidate.canonicalHotelId?.equals(params.canonicalHotelId) ===
        true;

    if (
      existingCandidate.canonicalHotelId !== null &&
      !existingCandidate.canonicalHotelId.equals(params.canonicalHotelId)
    ) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const existingCanonicalConflict = await this.hotelGeoCandidateModel
      .findOne({
        _id: {
          $ne: params.hotelGeoCandidateId,
        },
        canonicalHotelId: params.canonicalHotelId,
        matchStatus: {
          $in: [
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
          ],
        },
      })
      .exec();

    if (existingCanonicalConflict !== null) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const canonicalUpdate = await this.canonicalHotelModel
      .updateOne(
        {
          _id: params.canonicalHotelId,
          $or: [
            {
              'geo.source': null,
            },
            {
              'geo.source': source,
            },
          ],
        },
        {
          $set: {
            geo: {
              point: params.point,
              source,
            },
            updatedAt: now,
          },
        },
      )
      .exec();

    if (canonicalUpdate.matchedCount === 0) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    if (wasAlreadyMatched) {
      return GEO_MATCH_ACTION.ALREADY_MATCHED;
    }

    await this.hotelGeoCandidateModel
      .updateOne(
        {
          _id: params.hotelGeoCandidateId,
        },
        {
          $set: {
            canonicalHotelId: params.canonicalHotelId,
            componentId: params.componentId,
            matchReasons: [
              'AUTO_MATCH',
              ...params.reasons,
              `SCORE:${params.score}`,
            ],
            matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
            updatedAt: now,
          },
        },
      )
      .exec();

    return GEO_MATCH_ACTION.AUTO_MATCHED;
  }

  async applyManualCanonicalHotelGeo(
    params: IApplyManualCanonicalHotelGeoParams,
  ): Promise<GEO_MATCH_ACTION> {
    const now = new Date();
    const result = await this.canonicalHotelModel
      .updateOne(
        {
          _id: params.canonicalHotelId,
          $or: [
            {
              'geo.source': null,
            },
            {
              'geo.source': MANUAL_CANONICAL_HOTEL_GEO_SOURCE,
            },
          ],
        },
        {
          $set: {
            geo: {
              point: params.point,
              source: MANUAL_CANONICAL_HOTEL_GEO_SOURCE,
            },
            updatedAt: now,
            verification: {
              issues: [],
              status: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
              updatedAt: now,
            },
          },
        },
      )
      .exec();

    return result.matchedCount === 0
      ? GEO_MATCH_ACTION.CONFLICT
      : GEO_MATCH_ACTION.MANUAL_GEO_SET;
  }

  async applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    const source = this.buildCanonicalGeoSource(params.hotelGeoCandidateId);
    const now = new Date();
    const existingCandidate = await this.hotelGeoCandidateModel
      .findById(params.hotelGeoCandidateId)
      .exec();

    if (existingCandidate === null) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const wasAlreadyMatched =
      existingCandidate.matchStatus ===
        HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED &&
      existingCandidate.canonicalHotelId?.equals(params.canonicalHotelId) ===
        true;

    if (
      existingCandidate.canonicalHotelId !== null &&
      !existingCandidate.canonicalHotelId.equals(params.canonicalHotelId)
    ) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const existingCanonicalConflict = await this.hotelGeoCandidateModel
      .findOne({
        _id: {
          $ne: params.hotelGeoCandidateId,
        },
        canonicalHotelId: params.canonicalHotelId,
        matchStatus: {
          $in: [
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
          ],
        },
      })
      .exec();

    if (existingCanonicalConflict !== null) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    const canonicalUpdate = await this.canonicalHotelModel
      .updateOne(
        {
          _id: params.canonicalHotelId,
          $or: [
            {
              'geo.source': null,
            },
            {
              'geo.source': source,
            },
          ],
        },
        {
          $set: {
            geo: {
              point: params.point,
              source,
            },
            updatedAt: now,
            verification: {
              issues: [],
              status: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
              updatedAt: now,
            },
          },
        },
      )
      .exec();

    if (canonicalUpdate.matchedCount === 0) {
      return GEO_MATCH_ACTION.CONFLICT;
    }

    if (wasAlreadyMatched) {
      return GEO_MATCH_ACTION.ALREADY_MATCHED;
    }

    await this.hotelGeoCandidateModel
      .updateOne(
        {
          _id: params.hotelGeoCandidateId,
        },
        {
          $set: {
            canonicalHotelId: params.canonicalHotelId,
            componentId: null,
            matchReasons: ['MANUAL_MATCH'],
            matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
            updatedAt: now,
          },
        },
      )
      .exec();

    return GEO_MATCH_ACTION.MANUAL_MATCHED;
  }

  private buildCanonicalGeoSource(candidateId: Types.ObjectId): string {
    return `hotel_geo_candidate:${candidateId.toString()}`;
  }
}
