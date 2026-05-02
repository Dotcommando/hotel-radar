import { HOTEL_PROCESSING_STAGE } from '../../hotel-processing/constants/hotel-processing-stage.enum';

export interface IGovCyPdfParsingJobData {
  runId: string;
  stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE;
}
