import {
  APIFY_WEB_SCRAPER_ACTOR_ID,
  DEFAULT_DOWNLOAD_TIMEOUT_MS,
  DEFAULT_GOV_CY_PDF_PARSING_CACHE_TIME_MS,
  DEFAULT_OPENAI_RESPONSES_TIMEOUT_MS,
  DEFAULT_STORAGE_DIRECTORY_PATH,
  DEFAULT_TMP_DIRECTORY_PATH,
  GOV_CY_HOTELS_PAGE_URL,
} from './constants/gov-cy-pdf-hotels.constants';
import { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';

export function buildGovCyPdfHotelsConfig(): IGovCyPdfHotelsConfig {
  return {
    apifyActorId: process.env.APIFY_ACTOR_ID ?? APIFY_WEB_SCRAPER_ACTOR_ID,
    apifyToken: process.env.APIFY_TOKEN ?? null,
    downloadTimeoutMs: Number(
      process.env.PDF_DOWNLOAD_TIMEOUT_MS ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
    ),
    govCyHotelsPageUrl:
      process.env.GOV_CY_HOTELS_PAGE_URL ?? GOV_CY_HOTELS_PAGE_URL,
    openAiApiKey: process.env.OPENAI_API_KEY ?? null,
    openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1',
    openAiResponsesTimeoutMs: Number(
      process.env.OPENAI_RESPONSES_TIMEOUT_MS ??
        DEFAULT_OPENAI_RESPONSES_TIMEOUT_MS,
    ),
    parsingCacheTimeMs: Number(
      process.env.GOV_CY_PDF_PARSING_CACHE_TIME_MS ??
        DEFAULT_GOV_CY_PDF_PARSING_CACHE_TIME_MS,
    ),
    storageDirectoryPath:
      process.env.PDF_STORAGE_DIRECTORY_PATH ?? DEFAULT_STORAGE_DIRECTORY_PATH,
    tmpDirectoryPath:
      process.env.PDF_TMP_DIRECTORY_PATH ?? DEFAULT_TMP_DIRECTORY_PATH,
  };
}
