import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';

export class HotelProcessingNoRollbackRunFoundError extends Error {
  constructor(stage: HOTEL_PROCESSING_STAGE) {
    super(`No rollback run found for hotel processing stage: ${stage}.`);
  }
}
