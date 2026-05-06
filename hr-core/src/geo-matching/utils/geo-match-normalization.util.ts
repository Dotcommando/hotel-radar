import { SHARED_HOTEL_DOMAINS } from '../constants/shared-hotel-domain.constant';

const REDUCED_NAME_STOP_WORDS = new Set([
  'AND',
  'APARTMENT',
  'APARTMENTS',
  'APT',
  'APTS',
  'BEACH',
  'BOUTIQUE',
  'BY',
  'GUEST',
  'GUESTHOUSE',
  'HOLIDAY',
  'HOSTEL',
  'HOTEL',
  'HOTELS',
  'HOUSE',
  'RESORT',
  'SPA',
  'SUITE',
  'SUITES',
  'THE',
  'VILLAGE',
]);

export function normalizeGeoMatchNameRaw(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGeoMatchNameReduced(
  value: string | null | undefined,
): string {
  return normalizeGeoMatchNameRaw(value)
    .split(' ')
    .filter((token) => token.length > 0 && !REDUCED_NAME_STOP_WORDS.has(token))
    .join(' ');
}

export function normalizeGeoMatchPhone(value: string | null | undefined): string {
  let digits = String(value ?? '').replace(/\D/g, '');

  if (digits.startsWith('00357')) {
    digits = digits.slice(2);
  }

  if (digits.length === 8) {
    digits = `357${digits}`;
  }

  return digits;
}

export function extractDomain(value: string | null | undefined): string {
  const raw = String(value ?? '').trim().toLowerCase();

  if (raw.length === 0) {
    return '';
  }

  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withScheme).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^www\./, '').split('/')[0] ?? '';
  }
}

export function isSharedHotelDomain(domain: string): boolean {
  return SHARED_HOTEL_DOMAINS.some(
    (sharedDomain) =>
      domain === sharedDomain || domain.endsWith(`.${sharedDomain}`),
  );
}

export function normalizeGeoMatchEmail(
  value: string | null | undefined,
): string {
  return String(value ?? '').trim().toLowerCase();
}

export function getGeoMatchEmailDomain(email: string): string {
  return email.split('@')[1] ?? '';
}

export function getGeoMatchNameTokens(value: string): string[] {
  return normalizeGeoMatchNameReduced(value)
    .split(' ')
    .filter((token) => token.length > 0);
}
