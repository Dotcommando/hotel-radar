export class HotelGeoCandidateForMatchNotFoundError extends Error {
  constructor(id: string) {
    super(`Hotel geo candidate was not found for id "${id}".`);
  }
}
