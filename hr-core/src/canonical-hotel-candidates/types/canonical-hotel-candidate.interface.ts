import { Types } from 'mongoose';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCandidateBuild } from './canonical-hotel-candidate-build.interface';
import { ICanonicalHotelCandidateProcessing } from './canonical-hotel-candidate-processing.interface';
import { ICanonicalHotelCapacity } from './canonical-hotel-capacity.interface';
import { ICanonicalHotelComponent } from './canonical-hotel-component.interface';

export interface ICanonicalHotelCandidate {
  _id: Types.ObjectId;
  candidateKey: string;
  status: CANONICAL_HOTEL_CANDIDATE_STATUS;
  kind: CANONICAL_HOTEL_KIND;
  canonicalName: string;
  location: IHotelLocation;
  operator: string | null;
  contacts: IHotelContacts;
  capacity: ICanonicalHotelCapacity;
  components: ICanonicalHotelComponent[];
  build: ICanonicalHotelCandidateBuild;
  processing: ICanonicalHotelCandidateProcessing;
  createdAt: Date;
  updatedAt: Date;
}
