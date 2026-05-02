import { Module } from '@nestjs/common';
import { HotelProcessingModule } from '../hotel-processing/hotel-processing.module';
import { ParsedFilesModule } from '../parsed-files/parsed-files.module';
import { PromptsModule } from '../prompts/prompts.module';
import { RawHotelsModule } from '../raw-hotels/raw-hotels.module';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsController } from './gov-cy-pdf-hotels.controller';
import { buildGovCyPdfHotelsConfig } from './gov-cy-pdf-hotels-config';
import { GovCyPdfParsingProcessor } from './gov-cy-pdf-parsing.processor';
import { GovCyPdfParsingWorker } from './gov-cy-pdf-parsing.worker';
import {
  GovCyPdfDownloaderService,
  GovCyPdfHotelsService,
  GovCyPdfHotelsStartupService,
  GovCyPdfParsingQueueService,
} from './services';
import { StartGovCyPdfParsingRunUseCase } from './use-cases/start-gov-cy-pdf-parsing-run.use-case';
import { RunGovCyPdfParsingUseCase } from './use-cases/run-gov-cy-pdf-parsing.use-case';

@Module({
  controllers: [GovCyPdfHotelsController],
  exports: [GovCyPdfHotelsService],
  imports: [
    HotelProcessingModule,
    ParsedFilesModule,
    PromptsModule,
    RawHotelsModule,
  ],
  providers: [
    GovCyPdfDownloaderService,
    GovCyPdfHotelsService,
    GovCyPdfParsingProcessor,
    GovCyPdfParsingQueueService,
    GovCyPdfParsingWorker,
    GovCyPdfHotelsStartupService,
    RunGovCyPdfParsingUseCase,
    StartGovCyPdfParsingRunUseCase,
    {
      provide: GOV_CY_PDF_HOTELS_CONFIG,
      useFactory: buildGovCyPdfHotelsConfig,
    },
  ],
})
export class GovCyPdfHotelsModule {}
