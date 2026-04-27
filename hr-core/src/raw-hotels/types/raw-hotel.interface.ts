import { IRawHotelContacts } from './raw-hotel-contacts.interface';
import { IRawHotelSourceFile } from './raw-hotel-source-file.interface';

export interface IRawHotel {
  address: string | null;
  beds: number | null;
  classRaw: string | null;
  contacts: IRawHotelContacts;
  createdAt: Date;
  establishmentType: string | null;
  licenseStatus: string;
  locality: string | null;
  managerName: string | null;
  name: string;
  nameMatchKey?: string;
  nameNormalized: string;
  operatorName: string | null;
  postcode: string | null;
  region: string | null;
  rooms: number | null;
  sourceFile: IRawHotelSourceFile;
  stars: number | null;
  strictHotelDedupeKey?: string;
  updatedAt: Date;
}
