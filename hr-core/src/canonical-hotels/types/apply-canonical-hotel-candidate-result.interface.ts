import { Types } from 'mongoose';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../constants/canonical-hotel-processing-action.enum';
import { CANONICAL_HOTEL_REVIEW_REASON } from '../constants/canonical-hotel-review-reason.enum';

export interface ICanonicalHotelCandidateReview {
  reason: CANONICAL_HOTEL_REVIEW_REASON;
  candidateCanonicalHotelIds: Types.ObjectId[];
  details: string[];
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface IApplyCanonicalHotelCandidateResult {
  action: CANONICAL_HOTEL_PROCESSING_ACTION;
  canonicalHotelId: Types.ObjectId | null;
  review: ICanonicalHotelCandidateReview | null;
}
