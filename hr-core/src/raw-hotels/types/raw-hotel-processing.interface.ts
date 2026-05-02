import { Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';

export interface IRawHotelProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  hotelRegistryEntryId: Types.ObjectId | null;
  error: string | null;
}
