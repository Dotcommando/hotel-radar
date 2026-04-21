import { IGovCyHotelContacts } from './gov-cy-hotel-contacts.interface';
import { IGovCyHotelSourceFile } from './gov-cy-hotel-source-file.interface';

export interface IRecognizedGovCyHotelRecord {
  address: string | null;
  beds: number | null;
  classRaw: string | null;
  contacts: IGovCyHotelContacts;
  createdAt: Date;
  establishmentType: string | null;
  licenseStatus: string;
  locality: string | null;
  managerName: string | null;
  name: string;
  nameNormalized: string;
  operatorName: string | null;
  postcode: string | null;
  region: string | null;
  rooms: number | null;
  sourceFile: IGovCyHotelSourceFile;
  stars: number | null;
  updatedAt: Date;
}
