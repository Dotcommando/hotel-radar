import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { IHotelProcessingRunStats } from './hotel-processing-run-stats.interface';

export interface IHotelProcessingRun {
  runId: string;
  stage: HOTEL_PROCESSING_STAGE;
  status: HOTEL_PROCESSING_RUN_STATUS;
  batchSize: number;
  stats: IHotelProcessingRunStats;
  currentBatch: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
