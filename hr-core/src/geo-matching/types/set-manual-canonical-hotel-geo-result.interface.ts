import { IHotelGeo } from '../../canonical-hotels/types/hotel-geo.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';

export interface ISetManualCanonicalHotelGeoResult {
  action: GEO_MATCH_ACTION;
  canonicalHotelId: string;
  canonicalHotelName: string;
  geo: IHotelGeo;
  ok: true;
}
