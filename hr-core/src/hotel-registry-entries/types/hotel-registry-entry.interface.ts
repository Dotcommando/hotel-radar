import { Types } from 'mongoose';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../constants/hotel-registry-entry-status.enum';
import { IHotelCapacity } from './hotel-capacity.interface';
import { IHotelContacts } from './hotel-contacts.interface';
import { IHotelLocation } from './hotel-location.interface';
import { IHotelRegistryEntryName } from './hotel-registry-entry-name.interface';
import { IHotelRegistryEntryProcessing } from './hotel-registry-entry-processing.interface';

export interface IHotelRegistryEntry {
  _id: Types.ObjectId;
  registryKey: string;
  status: HOTEL_REGISTRY_ENTRY_STATUS;
  name: IHotelRegistryEntryName;
  establishmentType: string | null;
  location: IHotelLocation;
  operator: string | null;
  capacity: IHotelCapacity;
  contacts: IHotelContacts;
  issues: string[];
  processing: IHotelRegistryEntryProcessing;
  createdAt: Date;
  updatedAt: Date;
}
