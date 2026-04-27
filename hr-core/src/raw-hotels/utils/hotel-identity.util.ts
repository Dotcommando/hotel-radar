interface IHotelContactsForIdentity {
  phones: string[];
}

interface IHotelForStrictDedupeKey {
  beds: number | null;
  contacts: IHotelContactsForIdentity;
  nameNormalized: string;
  postcode: string | null;
  rooms: number | null;
}

interface IHotelForSoftDuplicateCandidateKey {
  beds: number | null;
  contacts: IHotelContactsForIdentity;
  name: string;
  postcode: string | null;
  rooms: number | null;
}

const TRAILING_CLASS_MARKERS_PATTERN =
  /(?:\s+(?:(?:5|4|3|2|1)\s*\*|[ABC]\s*'|N(?:\s*\/\s*|\s+)A|ΑΝΕΥ\s*Α?|ΆΝΕΥ\s*Α?|WITHOUT\s+STAR))+$/u;

const GENERIC_SUFFIXES = new Set([
  'HOTEL',
  'HOTELS',
  'APARTMENT',
  'APARTMENTS',
  'APTS',
  'APT',
  'SUITE',
  'SUITES',
  'RESIDENCE',
  'BOUTIQUE',
]);

export function normalizeHotelName(name: string): string {
  return removeTrailingClassMarkers(
    normalizeNameText(name),
  );
}

export function makeNameMatchKey(name: string): string {
  const normalized = normalizeHotelName(name);
  const tokens = normalized.split(' ').filter(Boolean);
  const withoutLeadingArticle = removeLeadingArticle(tokens);
  const withoutGenericSuffixes = removeGenericSuffixes(withoutLeadingArticle);

  return withoutGenericSuffixes.join(' ');
}

export function makeStrictHotelDedupeKey(hotel: IHotelForStrictDedupeKey): string {
  return [
    normalizeHotelName(hotel.nameNormalized),
    normalizePostcode(hotel.postcode),
    normalizePhone(hotel.contacts.phones[0] ?? null),
    normalizeNumber(hotel.rooms),
    normalizeNumber(hotel.beds),
  ].join('|');
}

export function makeSoftHotelDuplicateCandidateKey(
  hotel: IHotelForSoftDuplicateCandidateKey,
): string {
  return [
    makeNameMatchKey(hotel.name),
    normalizePostcode(hotel.postcode),
    normalizePhone(hotel.contacts.phones[0] ?? null),
    normalizeNumber(hotel.rooms),
    normalizeNumber(hotel.beds),
  ].join('|');
}

function normalizeNameText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[’‘`´]/g, '\'')
    .replace(/&/g, ' AND ')
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/[\/\\]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function removeTrailingClassMarkers(value: string): string {
  return value.replace(TRAILING_CLASS_MARKERS_PATTERN, '').trim();
}

function removeLeadingArticle(tokens: string[]): string[] {
  if (tokens[0] === 'THE' && tokens.length > 1) {
    return tokens.slice(1);
  }

  return tokens;
}

function removeGenericSuffixes(tokens: string[]): string[] {
  let suffixStartIndex = tokens.length;

  for (let index = tokens.length - 1; index > 0; index -= 1) {
    if (!GENERIC_SUFFIXES.has(tokens[index])) {
      break;
    }

    suffixStartIndex = index;
  }

  return tokens.slice(0, suffixStartIndex);
}

function normalizePostcode(value: string | null): string {
  return value?.replace(/\s+/g, '').trim().toUpperCase() ?? '';
}

function normalizePhone(value: string | null): string {
  if (value === null) {
    return '';
  }

  return value.replace(/[^\d+]/g, '');
}

function normalizeNumber(value: number | null): string {
  return value === null ? '' : String(value);
}
