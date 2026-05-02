import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';

export interface ICanonicalHotelCapacity {
  rooms: number | null;
  beds: number | null;
  mode: CANONICAL_HOTEL_CAPACITY_MODE;
}
