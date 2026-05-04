import { Types } from 'mongoose';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../../canonical-hotels/constants/canonical-hotel-processing-action.enum';
import { ICanonicalHotelCandidateReview } from '../../canonical-hotels/types/apply-canonical-hotel-candidate-result.interface';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';

export interface ICanonicalHotelCandidateProcessing {
  status: HOTEL_PROCESSING_STATUS;
  runId: string | null;
  claimedAt: Date | null;
  processedAt: Date | null;
  canonicalHotelId: Types.ObjectId | null;
  action?: CANONICAL_HOTEL_PROCESSING_ACTION | null;
  review?: ICanonicalHotelCandidateReview | null;
  error: string | null;
}
