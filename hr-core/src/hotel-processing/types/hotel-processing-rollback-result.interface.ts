import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from '../constants/hotel-processing-rollback-target-stage.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';

export interface IHotelProcessingRollbackStepResult {
  stage: HOTEL_PROCESSING_STAGE;
  runId: string;
  resetSourceDocuments: number;
  deletedTargetDocuments: number;
}

export interface IHotelProcessingRollbackResult {
  ok: true;
  targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE;
  steps: IHotelProcessingRollbackStepResult[];
}
