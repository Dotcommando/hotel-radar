import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCapacity } from '../../canonical-hotel-candidates/types/canonical-hotel-capacity.interface';
import { ICanonicalHotelComponent } from '../../canonical-hotel-candidates/types/canonical-hotel-component.interface';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import { ICanonicalHotelSourceState } from './canonical-hotel-source-state.interface';
import { IHotelDeclaredWebPresence } from './hotel-declared-web-presence.interface';

export interface ICanonicalHotelSnapshot {
  canonicalKey: string;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  location: IHotelLocation;
  operator: string | null;
  contacts: IHotelContacts;
  webPresence: IHotelDeclaredWebPresence;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  source: ICanonicalHotelSourceState;
}
