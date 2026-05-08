export class HotelBeachAccessRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Hotel beach access run not found: ${runId}`);
  }
}
