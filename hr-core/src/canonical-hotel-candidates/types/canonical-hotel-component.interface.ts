import { IHotelCapacity } from '../../hotel-registry-entries/types/hotel-capacity.interface';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';

export interface ICanonicalHotelComponent {
  componentKey: string;
  name: string;
  normalizedName: string;
  establishmentType: string | null;
  location: IHotelLocation;
  contacts: IHotelContacts;
  capacity: IHotelCapacity;
}
