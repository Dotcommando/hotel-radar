export class InvalidNearbyHotelGeoCandidatesQueryError extends Error {
  constructor(readonly field: string) {
    super(`${field} must be a valid nearby hotel geo candidates query value.`);
  }
}
