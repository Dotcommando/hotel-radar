export class HotelBeachAccessActiveRunExistsError extends Error {
  constructor() {
    super('A hotel beach access run is already active.');
  }
}
