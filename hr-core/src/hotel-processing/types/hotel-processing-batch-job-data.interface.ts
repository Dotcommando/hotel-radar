import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';

export interface IHotelProcessingBatchJobData {
  runId: string;
  stage: HOTEL_PROCESSING_STAGE;
  batchNo: number;
  batchSize: number;
}
