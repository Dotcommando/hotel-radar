export class GeoHotelMatchInvalidIdError extends Error {
  constructor(readonly field: string) {
    super(`${field} must be a valid MongoDB ObjectId.`);
  }
}
