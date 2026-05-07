import { Types } from 'mongoose';
import { IGeoPoint } from '../../canonical-hotels/types/hotel-geo.interface';

export interface IApplyManualCanonicalHotelGeoParams {
  canonicalHotelId: Types.ObjectId;
  point: IGeoPoint;
}
