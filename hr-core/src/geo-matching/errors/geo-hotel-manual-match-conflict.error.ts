export class GeoHotelManualMatchConflictError extends Error {
  constructor() {
    super('Hotel geo candidate cannot be manually matched to this canonical hotel.');
  }
}
