export class CanonicalHotelCanonicalNameNotUniqueError extends Error {
  constructor(canonicalName: string) {
    super(`Canonical hotel canonicalName is not unique: ${canonicalName}`);
  }
}
