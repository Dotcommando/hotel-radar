import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import {
  normalizeRegistryPostcode,
  normalizeRegistryText,
} from '../../hotel-registry-entries/utils/hotel-registry-normalization.util';

export interface IMakeCanonicalHotelKeyParams {
  canonicalName: string;
  contacts?: IHotelContacts;
  kind: CANONICAL_HOTEL_KIND;
  location: IHotelLocation;
  operator: string | null;
}

export function makeCanonicalHotelKey(
  params: IMakeCanonicalHotelKeyParams,
): string {
  const location = params.location;
  const canonicalName = normalizeRegistryText(params.canonicalName);
  const district = normalizeRegistryText(location.district);
  const locality = normalizeRegistryText(location.locality);
  const postcode = normalizeRegistryPostcode(location.postcode);
  const address = normalizeRegistryText(location.address);
  const operator = normalizeRegistryText(params.operator);
  const contact = normalizeRegistryText(readStrongContact(params.contacts));

  if (postcode.length > 0 && address.length > 0) {
    return ['chv1', params.kind, canonicalName, district, locality, postcode, address].join('|');
  }

  if (postcode.length > 0 && operator.length > 0) {
    return ['chv1', params.kind, canonicalName, district, locality, postcode, operator].join('|');
  }

  if (address.length > 0 && operator.length > 0) {
    return [
      'chv1',
      params.kind,
      canonicalName,
      district,
      locality,
      'address_operator',
      address,
      operator,
    ].join('|');
  }

  if (address.length > 0 && contact.length > 0) {
    return [
      'chv1',
      params.kind,
      canonicalName,
      district,
      locality,
      'address_contact',
      address,
      contact,
    ].join('|');
  }

  if (postcode.length > 0 && contact.length > 0) {
    return [
      'chv1',
      params.kind,
      canonicalName,
      district,
      locality,
      'postcode_contact',
      postcode,
      contact,
    ].join('|');
  }

  if (operator.length > 0 && contact.length > 0) {
    return [
      'chv1',
      params.kind,
      canonicalName,
      district,
      locality,
      'operator_contact',
      operator,
      contact,
    ].join('|');
  }

  return [
    'chv1',
    params.kind,
    canonicalName,
    district,
    locality,
    'location_contact',
    contact,
  ].join('|');
}

export function hasStrongCanonicalHotelIdentity(
  params: IMakeCanonicalHotelKeyParams,
): boolean {
  const location = params.location;
  const hasCanonicalName = params.canonicalName.trim().length > 0;
  const hasDistrictOrLocality =
    hasText(location.district) || hasText(location.locality);
  const hasPostcode = hasText(location.postcode);
  const hasAddress = hasText(location.address);
  const hasOperator = hasText(params.operator);
  const hasContact = readStrongContact(params.contacts).length > 0;

  return (
    hasCanonicalName &&
    ((hasPostcode && hasAddress) ||
      (hasPostcode && hasOperator) ||
      (hasAddress && hasOperator) ||
      (hasAddress && hasContact) ||
      (hasPostcode && hasContact) ||
      (hasOperator && hasContact) ||
      (hasDistrictOrLocality && hasContact))
  );
}

function readStrongContact(contacts: IHotelContacts | undefined): string {
  if (contacts === undefined) {
    return '';
  }

  return contacts.phones[0] ?? contacts.emails[0] ?? '';
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}
