import { IRecognizedGovCyHotelRecord } from './recognized-gov-cy-hotel-record.interface';

export interface IOpenAiHotelsEnvelope {
  hotels: Array<Omit<IRecognizedGovCyHotelRecord, 'createdAt' | 'sourceFile' | 'updatedAt'> & {
    updatedAt: string;
  }>;
}
