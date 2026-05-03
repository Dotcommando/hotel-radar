import { IHotelLocationFields } from '../types/hotel-location-fields.interface';

const POSTAL_LINE_PATTERN = /^(\d{4})\s*,?\s+(.+?)\s*$/u;
const STREET_ADDRESS_MARKER_PATTERN =
  /\b(?:AVENUE|STREET|ROAD|LANE|DRIVE|BOULEVARD|SQUARE|COURT|PLACE|CRESCENT|WAY|LEOFOROS|ODOS)\b/u;

export function normalizeHotelLocation(
  location: IHotelLocationFields,
): IHotelLocationFields {
  const normalizedLocation: IHotelLocationFields = {
    address: normalizeNullableText(location.address),
    locality: normalizeNullableText(location.locality),
    postcode: normalizeNullableText(location.postcode),
  };

  if (normalizedLocation.address === null) {
    return normalizedLocation;
  }

  const postalLineLocation = normalizePostalLineOnlyLocation(
    normalizedLocation,
  );

  if (postalLineLocation !== null) {
    return postalLineLocation;
  }

  return normalizeTrailingPostalLine(normalizedLocation);
}

function normalizePostalLineOnlyLocation(
  location: IHotelLocationFields,
): IHotelLocationFields | null {
  if (location.address === null) {
    return null;
  }

  const match = location.address.match(POSTAL_LINE_PATTERN);

  if (match === null) {
    return null;
  }

  const extractedPostcode = match[1];
  const extractedLocality = removeTrailingAddressPunctuation(match[2]);
  const hasMatchingPostcode =
    location.postcode !== null &&
    normalizePostcodeForCompare(location.postcode) === extractedPostcode;
  const hasMatchingLocality =
    location.locality !== null &&
    normalizeLocationTextForCompare(location.locality) ===
      normalizeLocationTextForCompare(extractedLocality);

  if (
    !hasMatchingPostcode
      && !hasMatchingLocality
  ) {
    return null;
  }

  if (
    location.locality === null
      && looksLikeStreetAddress(extractedLocality)
  ) {
    return null;
  }

  return {
    address: null,
    locality: location.locality ?? extractedLocality,
    postcode: location.postcode ?? extractedPostcode,
  };
}

function normalizeTrailingPostalLine(
  location: IHotelLocationFields,
): IHotelLocationFields {
  if (
    location.address === null
      || location.postcode === null
      || location.locality === null
  ) {
    return location;
  }

  const postalLinePattern = new RegExp(
    `[\\s,]+${buildPostcodePattern(location.postcode)}[\\s,]+${buildFlexibleTextPattern(location.locality)}\\s*$`,
    'iu',
  );
  const cleanedAddress = normalizeNullableText(
    removeTrailingAddressPunctuation(
      location.address.replace(postalLinePattern, ''),
    ),
  );

  if (cleanedAddress === location.address) {
    return location;
  }

  return {
    ...location,
    address: cleanedAddress,
  };
}

function normalizeNullableText(value: string | null): string | null {
  const normalizedValue = value?.normalize('NFKC').replace(/\s+/g, ' ').trim();

  if (normalizedValue === undefined || normalizedValue.length === 0) {
    return null;
  }

  return normalizedValue;
}

function removeTrailingAddressPunctuation(value: string): string {
  return value.replace(/[\s,]+$/u, '').trim();
}

function normalizePostcodeForCompare(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

function normalizeLocationTextForCompare(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[,\s]+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildPostcodePattern(value: string): string {
  return escapeRegex(normalizePostcodeForCompare(value));
}

function buildFlexibleTextPattern(value: string): string {
  return normalizeNullableText(value)
    ?.split(/\s+/u)
    .map((part) => escapeRegex(part))
    .join('[\\s,]+') ?? '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeStreetAddress(value: string): boolean {
  return STREET_ADDRESS_MARKER_PATTERN.test(
    normalizeLocationTextForCompare(value),
  );
}
