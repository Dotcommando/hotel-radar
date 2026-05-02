import { Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';

export interface IHotelRegistryEntryProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  canonicalHotelCandidateId: Types.ObjectId | null;
  error: string | null;
}
