import { IHotelRegistryEntry } from './hotel-registry-entry.interface';

export interface IUpsertHotelRegistryEntryResult {
  entry: IHotelRegistryEntry;
  issues: string[];
}
