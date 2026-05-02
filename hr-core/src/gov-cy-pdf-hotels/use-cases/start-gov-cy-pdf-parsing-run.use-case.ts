import { Injectable } from '@nestjs/common';
import { HOTEL_PROCESSING_RUN_STATUS } from '../../hotel-processing/constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../../hotel-processing/constants/hotel-processing-stage.enum';
import { HotelProcessingActiveRunExistsError } from '../../hotel-processing/errors/hotel-processing-active-run-exists.error';
import { HotelProcessingRunsService } from '../../hotel-processing/hotel-processing-runs.service';
import { IStartHotelProcessingRunResult } from '../../hotel-processing/types/start-hotel-processing-run-result.interface';
import { GovCyPdfParsingQueueService } from '../services';

@Injectable()
export class StartGovCyPdfParsingRunUseCase {
  constructor(
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
    private readonly govCyPdfParsingQueueService: GovCyPdfParsingQueueService,
  ) {}

  async execute(): Promise<IStartHotelProcessingRunResult> {
    const now = new Date();
    const hasActiveRun = await this.hotelProcessingRunsService.hasActiveRun(
      HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    );

    if (hasActiveRun) {
      throw new HotelProcessingActiveRunExistsError();
    }

    const runId = this.makeRunId(now);

    await this.hotelProcessingRunsService.createQueuedRun({
      batchSize: 1,
      runId,
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      total: 0,
    });

    try {
      await this.govCyPdfParsingQueueService.addParseRun({
        runId,
        stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to enqueue GovCy PDF parsing run';

      await this.hotelProcessingRunsService.fail(runId, message);
      throw error;
    }

    return {
      batchSize: 1,
      ok: true,
      runId,
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    };
  }

  private makeRunId(date: Date): string {
    return `${date
      .toISOString()
      .replace(/\.\d{3}Z$/u, '')
      .replace(/:/g, '-')}-gov-cy-pdf-parse`;
  }
}
