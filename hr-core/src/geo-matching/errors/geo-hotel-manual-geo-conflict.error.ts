export class GeoHotelManualGeoConflictError extends Error {
  constructor() {
    super('Canonical hotel geo cannot be manually updated because it has another geo source.');
  }
}
