export class HotelGeoCandidateNotFoundError extends Error {
  constructor() {
    super('Hotel geo candidate was not found.');
  }
}
