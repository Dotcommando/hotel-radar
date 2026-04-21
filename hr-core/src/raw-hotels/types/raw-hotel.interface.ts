import { Document } from 'mongoose';
import { IRawHotelContacts } from './raw-hotel-contacts.interface';
import { IRawHotelSourceFile } from './raw-hotel-source-file.interface';

export interface IRawHotel extends Document {
  address: string | null;
  beds: number;
  classRaw: string | null;
  contacts: IRawHotelContacts;
  createdAt: Date;
  establishmentType: string;
  licenseStatus: string;
  locality: string | null;
  managerName: string | null;
  name: string;
  nameNormalized: string;
  operatorName: string | null;
  postcode: string | null;
  region: string | null;
  rooms: number;
  sourceFile: IRawHotelSourceFile;
  stars: number | null;
  updatedAt: Date;
}
