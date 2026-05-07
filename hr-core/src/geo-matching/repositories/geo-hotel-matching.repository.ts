import { Types } from 'mongoose';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualCanonicalHotelGeoParams } from '../types/apply-manual-canonical-hotel-geo-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';

export abstract class GeoHotelMatchingRepository {
  abstract findCanonicalHotelForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<ICanonicalHotel | null>;

  abstract findHotelGeoCandidateForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<IHotelGeoCandidate | null>;

  abstract listCanonicalHotelIdsWithMergedGeoCandidates(): Promise<string[]>;

  abstract listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]>;

  abstract listHotelGeoCandidatesForAutoMatching(
    limit: number,
  ): Promise<IHotelGeoCandidate[]>;

  abstract applyAutoMatch(
    params: IApplyGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION>;

  abstract applyManualCanonicalHotelGeo(
    params: IApplyManualCanonicalHotelGeoParams,
  ): Promise<GEO_MATCH_ACTION>;

  abstract applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION>;
}
