import { Test, TestingModule } from '@nestjs/testing';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsStartupService } from './gov-cy-pdf-hotels.startup.service';
import { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';

interface IFetchResponse {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

describe('GovCyPdfHotelsStartupService', () => {
  let service: GovCyPdfHotelsStartupService;

  const config: IGovCyPdfHotelsConfig = {
    apifyActorId: 'apify~web-scraper',
    apifyToken: 'apify-token',
    downloadTimeoutMs: 90000,
    govCyHotelsPageUrl: 'https://www.gov.cy/tourism/en/documents/hotels-and-other-tourist-establishments-list/',
    openAiApiKey: 'openai-key',
    openAiModel: 'gpt-4.1',
    openAiResponsesTimeoutMs: 360000,
    parsingCacheTimeMs: 60000,
    storageDirectoryPath: '/tmp/hr-core-pdf-files',
  };

  beforeEach(async () => {
    global.fetch = jest.fn<Promise<IFetchResponse>, [RequestInfo | URL, RequestInit?]>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovCyPdfHotelsStartupService,
        {
          provide: GOV_CY_PDF_HOTELS_CONFIG,
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<GovCyPdfHotelsStartupService>(GovCyPdfHotelsStartupService);
  });

  it('passes startup checks when Apify and OpenAI are available', async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ data: { username: 'hotel-radar' } }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ id: 'gpt-4.1' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ input_tokens: 1, object: 'response.input_tokens' }),
        ok: true,
        status: 200,
      });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('logs a warning and keeps startup alive when Apify is unavailable', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'GovCyPdfHotelsModule startup check failed:',
      'Apify health check failed with status 401: Unauthorized',
    );
    expect(processExitSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it('logs a warning and keeps startup alive when OpenAI reports insufficient quota', async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ data: { username: 'hotel-radar' } }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({ id: 'gpt-4.1' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          error: {
            code: 'insufficient_quota',
            message: 'You exceeded your current quota, please check your plan and billing details.',
          },
        }),
        ok: false,
        status: 429,
        text: async () => 'quota exceeded',
      });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`process.exit:${String(code)}`);
    });

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'GovCyPdfHotelsModule startup check failed:',
      'OpenAI health check failed: insufficient quota or billing limit reached',
    );
    expect(processExitSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    processExitSpy.mockRestore();
  });
});
