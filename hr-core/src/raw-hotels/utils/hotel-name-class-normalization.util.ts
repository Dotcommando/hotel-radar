import { normalizeHotelName } from './hotel-identity.util';

export interface IHotelNameClassFields {
  classRaw: string | null;
  name: string;
}

export interface INormalizedHotelNameClassFields {
  classRaw: string | null;
  name: string;
  nameNormalized: string;
}

const NUMERIC_CLASS_AS_NAME_SUFFIX_PATTERN = /^\d{1,3}$/u;
const TRAILING_CYPRUS_CLASS_SUFFIX_PATTERN = /\s+[ABC]'$/iu;

export function cleanHotelName(name: string): string {
  return name.replace(TRAILING_CYPRUS_CLASS_SUFFIX_PATTERN, '').trim();
}

export function normalizeHotelNameAndClass(
  fields: IHotelNameClassFields,
): INormalizedHotelNameClassFields {
  const cleanName = cleanHotelName(fields.name);
  const normalizedName = normalizeHotelName(cleanName);
  const classRaw = fields.classRaw?.trim() ?? null;

  if (
    classRaw === null
      || !NUMERIC_CLASS_AS_NAME_SUFFIX_PATTERN.test(classRaw)
      || normalizedName.endsWith(` ${classRaw}`)
  ) {
    return {
      classRaw: fields.classRaw,
      name: cleanName,
      nameNormalized: normalizedName,
    };
  }

  const name = `${cleanName} ${classRaw}`;

  return {
    classRaw: null,
    name,
    nameNormalized: normalizeHotelName(name),
  };
}
