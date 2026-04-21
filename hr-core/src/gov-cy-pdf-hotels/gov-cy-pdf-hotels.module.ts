import { Module } from '@nestjs/common';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import {
  APIFY_WEB_SCRAPER_ACTOR_ID,
  DEFAULT_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_OPENAI_RESPONSES_TIMEOUT_MS,
  DEFAULT_STORAGE_DIRECTORY_PATH,
  GOV_CY_HOTELS_PAGE_URL,
} from './constants/gov-cy-pdf-hotels.constants';
import { GovCyPdfHotelsService } from './gov-cy-pdf-hotels.service';
import { GovCyPdfHotelsStartupService } from './gov-cy-pdf-hotels.startup.service';
import { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';

@Module({
  exports: [GovCyPdfHotelsService],
  providers: [
    GovCyPdfHotelsService,
    GovCyPdfHotelsStartupService,
    {
      provide: GOV_CY_PDF_HOTELS_CONFIG,
      useFactory: (): IGovCyPdfHotelsConfig => ({
        apifyActorId: process.env.APIFY_ACTOR_ID ?? APIFY_WEB_SCRAPER_ACTOR_ID,
        apifyToken: process.env.APIFY_TOKEN ?? null,
        downloadTimeoutMs: Number(process.env.PDF_DOWNLOAD_TIMEOUT_MS ?? DEFAULT_DOWNLOAD_TIMEOUT_MS),
        govCyHotelsPageUrl: process.env.GOV_CY_HOTELS_PAGE_URL ?? GOV_CY_HOTELS_PAGE_URL,
        openAiApiKey: process.env.OPENAI_API_KEY ?? null,
        openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1',
        openAiResponsesTimeoutMs: Number(
          process.env.OPENAI_RESPONSES_TIMEOUT_MS ?? DEFAULT_OPENAI_RESPONSES_TIMEOUT_MS,
        ),
        storageDirectoryPath:
          process.env.PDF_STORAGE_DIRECTORY_PATH ?? DEFAULT_STORAGE_DIRECTORY_PATH,
      }),
    },
  ],
})
export class GovCyPdfHotelsModule {}
