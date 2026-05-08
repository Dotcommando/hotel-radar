export class HotelBeachAccessNoEligibleHotelsError extends Error {
  constructor() {
    super('No active canonical hotels with geo point are available.');
  }
}
