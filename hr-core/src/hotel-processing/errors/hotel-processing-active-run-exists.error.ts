export class HotelProcessingActiveRunExistsError extends Error {
  constructor() {
    super('Hotel processing run is already active.');
  }
}
