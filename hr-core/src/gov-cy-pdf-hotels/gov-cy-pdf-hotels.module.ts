import { Module } from '@nestjs/common';
import { ParsedFilesModule } from '../parsed-files/parsed-files.module';
import { PromptsModule } from '../prompts/prompts.module';
import { RawHotelsModule } from '../raw-hotels/raw-hotels.module';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsController } from './gov-cy-pdf-hotels.controller';
import { buildGovCyPdfHotelsConfig } from './gov-cy-pdf-hotels-config';
import { GovCyPdfDownloaderService } from './gov-cy-pdf-downloader.service';
import { GovCyPdfHotelsService } from './gov-cy-pdf-hotels.service';
import { GovCyPdfHotelsStartupService } from './gov-cy-pdf-hotels.startup.service';
import { RunGovCyPdfParsingUseCase } from './use-cases/run-gov-cy-pdf-parsing.use-case';

@Module({
  controllers: [GovCyPdfHotelsController],
  exports: [GovCyPdfHotelsService],
  imports: [ParsedFilesModule, PromptsModule, RawHotelsModule],
  providers: [
    GovCyPdfDownloaderService,
    GovCyPdfHotelsService,
    GovCyPdfHotelsStartupService,
    RunGovCyPdfParsingUseCase,
    {
      provide: GOV_CY_PDF_HOTELS_CONFIG,
      useFactory: buildGovCyPdfHotelsConfig,
    },
  ],
})
export class GovCyPdfHotelsModule {}
