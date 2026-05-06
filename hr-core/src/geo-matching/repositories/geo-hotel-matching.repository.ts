import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';

export abstract class GeoHotelMatchingRepository {
  abstract listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]>;

  abstract listHotelGeoCandidatesForAutoMatching(
    limit: number,
  ): Promise<IHotelGeoCandidate[]>;

  abstract applyAutoMatch(
    params: IApplyGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION>;
}
