export class CanonicalHotelForGeoMatchNotFoundError extends Error {
  constructor(id: string) {
    super(`Canonical hotel was not found for id "${id}".`);
  }
}
