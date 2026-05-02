import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';

export interface IPreviousStageBlockingDetails {
  blockingStage: HOTEL_PROCESSING_STAGE;
  pending: number;
  claimed: number;
  failed: number;
}
