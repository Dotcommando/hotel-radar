const CYPRUS_COUNTRY_CODE = '357';
const CYPRUS_PHONE_DIGITS_LENGTH = 8;

export function normalizeCyprusPhones(values: string[]): string[] {
  const normalizedPhones: string[] = [];
  const seenPhones = new Set<string>();

  for (const value of values) {
    for (const phone of extractCyprusPhones(value)) {
      if (seenPhones.has(phone)) {
        continue;
      }

      seenPhones.add(phone);
      normalizedPhones.push(phone);
    }
  }

  return normalizedPhones;
}

function extractCyprusPhones(value: string): string[] {
  const phones: string[] = [];
  const segments = value
    .replace(/\+367/g, '+357')
    .replace(/00\s*357/g, '+357')
    .split(/[,;/&\n\r]+/);

  for (const segment of segments) {
    phones.push(...extractFromCompactValue(segment.replace(/[^\d+]/g, '')));
  }

  return phones;
}

function extractFromCompactValue(value: string): string[] {
  const phones: string[] = [];
  let cursor = 0;

  while (cursor < value.length) {
    const remainingValue = value.slice(cursor);
    const parsedPhone = parsePhoneAtStart(remainingValue);

    if (parsedPhone === null) {
      if (remainingValue.startsWith('+')) {
        const nextPlusIndex = remainingValue.indexOf('+', 1);

        if (nextPlusIndex === -1) {
          break;
        }

        cursor += nextPlusIndex;
        continue;
      }

      cursor += 1;
      continue;
    }

    phones.push(parsedPhone.phone);
    cursor += parsedPhone.consumedLength;
  }

  return phones;
}

function parsePhoneAtStart(
  value: string,
): { phone: string; consumedLength: number } | null {
  if (value.startsWith(`+${CYPRUS_COUNTRY_CODE}`)) {
    return parseCountryCodePhone(value, `+${CYPRUS_COUNTRY_CODE}`);
  }

  if (value.startsWith(`00${CYPRUS_COUNTRY_CODE}`)) {
    return parseCountryCodePhone(value, `00${CYPRUS_COUNTRY_CODE}`);
  }

  if (value.startsWith(CYPRUS_COUNTRY_CODE)) {
    return parseCountryCodePhone(value, CYPRUS_COUNTRY_CODE);
  }

  if (value.startsWith('+')) {
    const localDigits = value.slice(1, 1 + CYPRUS_PHONE_DIGITS_LENGTH);

    if (isCyprusLocalPhoneDigits(localDigits)) {
      return {
        consumedLength: 1 + CYPRUS_PHONE_DIGITS_LENGTH,
        phone: `+${CYPRUS_COUNTRY_CODE}${localDigits}`,
      };
    }

    return null;
  }

  const localDigits = value.slice(0, CYPRUS_PHONE_DIGITS_LENGTH);

  if (isCyprusLocalPhoneDigits(localDigits)) {
    return {
      consumedLength: CYPRUS_PHONE_DIGITS_LENGTH,
      phone: `+${CYPRUS_COUNTRY_CODE}${localDigits}`,
    };
  }

  return null;
}

function parseCountryCodePhone(
  value: string,
  prefix: string,
): { phone: string; consumedLength: number } | null {
  const localDigits = value.slice(
    prefix.length,
    prefix.length + CYPRUS_PHONE_DIGITS_LENGTH,
  );

  if (!isCyprusLocalPhoneDigits(localDigits)) {
    return null;
  }

  return {
    consumedLength: prefix.length + CYPRUS_PHONE_DIGITS_LENGTH,
    phone: `+${CYPRUS_COUNTRY_CODE}${localDigits}`,
  };
}

function isCyprusLocalPhoneDigits(value: string): boolean {
  return /^[29]\d{7}$/.test(value);
}
