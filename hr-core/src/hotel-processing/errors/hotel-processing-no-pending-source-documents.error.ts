export class HotelProcessingNoPendingSourceDocumentsError extends Error {
  constructor() {
    super('No pending source documents found.');
  }
}
