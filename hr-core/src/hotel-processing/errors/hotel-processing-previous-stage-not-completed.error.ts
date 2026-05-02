import { IPreviousStageBlockingDetails } from '../types/previous-stage-blocking-details.interface';

export class HotelProcessingPreviousStageNotCompletedError extends Error {
  constructor(readonly details: IPreviousStageBlockingDetails) {
    super(
      `Cannot start ${details.blockingStage} dependent stage because previous stage is not fully completed.`,
    );
  }
}
