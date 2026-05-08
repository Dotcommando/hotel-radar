import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../../canonical-hotels/constants/canonical-hotel-verification-status.enum';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';

export function isCanonicalHotelEligibleForGeoMatching(
  hotel: ICanonicalHotel,
): boolean {
  return (
    hotel.status === CANONICAL_HOTEL_STATUS.ACTIVE &&
    hotel.verification.status !==
      CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED
  );
}
