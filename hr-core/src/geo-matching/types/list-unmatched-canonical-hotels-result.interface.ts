import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import { IHotelGeo } from '../../canonical-hotels/types/hotel-geo.interface';
import { IAutoMatchHotelGeoCandidateResultItem } from './auto-match-hotel-geo-candidates-result.interface';

export interface IUnmatchedCanonicalHotelResultItem {
  canonicalHotel: {
    _id: string;
    canonicalName: string;
    geo: IHotelGeo;
    location: IHotelLocation;
    status: CANONICAL_HOTEL_STATUS;
  };
  suggestions: IAutoMatchHotelGeoCandidateResultItem[];
}

export interface IListUnmatchedCanonicalHotelsResult {
  items: IUnmatchedCanonicalHotelResultItem[];
  limit: number;
  offset: number;
  ok: true;
  total: number;
}
