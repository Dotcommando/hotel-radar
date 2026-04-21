import { buildGovCyPdfHotelsConfig } from './gov-cy-pdf-hotels-config';

describe('buildGovCyPdfHotelsConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GOV_CY_PDF_PARSING_CACHE_TIME_MS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses the default cache ttl when env value is not provided', () => {
    const result = buildGovCyPdfHotelsConfig();

    expect(result.parsingCacheTimeMs).toBe(43200000);
  });

  it('uses the cache ttl from env when it is provided', () => {
    process.env.GOV_CY_PDF_PARSING_CACHE_TIME_MS = '60000';

    const result = buildGovCyPdfHotelsConfig();

    expect(result.parsingCacheTimeMs).toBe(60000);
  });
});
