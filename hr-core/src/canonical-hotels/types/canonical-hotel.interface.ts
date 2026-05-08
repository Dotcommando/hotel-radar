import { Types } from 'mongoose';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCapacity } from '../../canonical-hotel-candidates/types/canonical-hotel-capacity.interface';
import { ICanonicalHotelComponent } from '../../canonical-hotel-candidates/types/canonical-hotel-component.interface';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import { CANONICAL_HOTEL_STATUS } from '../constants/canonical-hotel-status.enum';
import { ICanonicalHotelSourceState } from './canonical-hotel-source-state.interface';
import { ICanonicalHotelVerification } from './canonical-hotel-verification.interface';
import { IHotelDeclaredWebPresence } from './hotel-declared-web-presence.interface';
import { IHotelGeo } from './hotel-geo.interface';

export interface ICanonicalHotel {
  _id: Types.ObjectId;
  canonicalKey: string;
  status: CANONICAL_HOTEL_STATUS;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  location: IHotelLocation;
  geo: IHotelGeo;
  operator: string | null;
  contacts: IHotelContacts;
  webPresence: IHotelDeclaredWebPresence;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  source: ICanonicalHotelSourceState;
  issues: string[];
  verification: ICanonicalHotelVerification;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
