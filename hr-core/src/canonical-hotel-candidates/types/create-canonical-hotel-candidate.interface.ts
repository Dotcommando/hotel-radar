import { ICanonicalHotelCandidate } from './canonical-hotel-candidate.interface';

export interface ICreateCanonicalHotelCandidate
  extends Omit<ICanonicalHotelCandidate, '_id' | 'createdAt' | 'updatedAt'> {}
