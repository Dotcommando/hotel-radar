export class GeoHotelManualGeoInvalidQueryError extends Error {
  constructor(readonly field: string) {
    super(`${field} must be a valid manual canonical hotel geo query value.`);
  }
}
