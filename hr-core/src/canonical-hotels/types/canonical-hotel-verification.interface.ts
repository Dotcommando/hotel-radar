import { CANONICAL_HOTEL_VERIFICATION_ISSUE } from '../constants/canonical-hotel-verification-issue.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../constants/canonical-hotel-verification-status.enum';

export interface ICanonicalHotelVerification {
  status: CANONICAL_HOTEL_VERIFICATION_STATUS;
  issues: CANONICAL_HOTEL_VERIFICATION_ISSUE[];
  updatedAt: Date | null;
}
