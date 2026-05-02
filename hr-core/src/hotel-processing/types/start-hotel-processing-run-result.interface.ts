import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';

export interface IStartHotelProcessingRunResult {
  ok: true;
  runId: string;
  stage: HOTEL_PROCESSING_STAGE;
  status: HOTEL_PROCESSING_RUN_STATUS;
  batchSize: number;
}
