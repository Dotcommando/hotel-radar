const TRAILING_CLASS_MARKERS_PATTERN =
  /(?:\s+(?:(?:5|4|3|2|1)\s*\*|[ABC]\s*'|N(?:\s*\/\s*|\s+)A|ΑΝΕΥ\s*Α?|ΆΝΕΥ\s*Α?|WITHOUT\s+STAR))+$/u;

const NUMERIC_SUFFIX_PATTERN = /^(.*?)(?:\s+(NO\s*)?(\d+[A-Z]?))$/u;

export function normalizeRegistryText(value: string | null): string {
  if (value === null) {
    return '';
  }

  return value
    .normalize('NFKC')
    .replace(/[’‘`´]/g, "'")
    .replace(/&/g, ' AND ')
    .replace(/[.,;:()[\]{}]/g, ' ')
    .replace(/[/\\]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function normalizeRegistryName(value: string): string {
  return normalizeRegistryText(value)
    .replace(TRAILING_CLASS_MARKERS_PATTERN, '')
    .trim();
}

export function normalizeRegistryPostcode(value: string | null): string {
  return value?.replace(/\s+/g, '').trim().toUpperCase() ?? '';
}

export function normalizeRegistryPhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

export function splitAndNormalizeRegistryPhones(values: string[]): string[] {
  return uniqueStrings(
    values
      .flatMap((value) => value.split(','))
      .map((value) => normalizeRegistryPhone(value.trim()))
      .filter(Boolean),
  );
}

export function normalizeRegistryEmails(values: string[]): string[] {
  return uniqueStrings(
    values.map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
}

export function normalizeRegistryWebsites(values: string[]): string[] {
  return uniqueStrings(values.map((value) => value.trim()).filter(Boolean));
}

export function normalizeRegistryDomains(
  values: Array<string | null>,
): string[] {
  return uniqueStrings(
    values
      .filter((value): value is string => value !== null)
      .map((value) =>
        value
          .trim()
          .toLowerCase()
          .replace(/^www\./u, ''),
      )
      .filter(Boolean),
  );
}

export function splitRegistryNameSuffix(normalizedName: string): {
  baseName: string;
  suffix: string | null;
} {
  const match = normalizedName.match(NUMERIC_SUFFIX_PATTERN);

  if (match === null) {
    return {
      baseName: normalizedName,
      suffix: null,
    };
  }

  return {
    baseName: match[1].trim(),
    suffix: match[3],
  };
}

export function makeHotelRegistryKey(params: {
  nameNormalized: string;
  establishmentType: string | null;
  region: string | null;
  locality: string | null;
  postcode: string | null;
  address: string | null;
}): string {
  return [
    'rkv1',
    normalizeRegistryName(params.nameNormalized),
    normalizeRegistryText(params.establishmentType),
    normalizeRegistryText(params.region),
    normalizeRegistryText(params.locality),
    normalizeRegistryPostcode(params.postcode),
    normalizeRegistryText(params.address),
  ].join('|');
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
