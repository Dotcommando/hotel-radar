export class HotelProcessingRunNotFoundError extends Error {
  constructor() {
    super('Hotel processing run was not found.');
  }
}
