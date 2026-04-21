import { constants } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { PDF_DISCOVERY_PAGE_FUNCTION } from './constants/pdf-discovery-page-function.constant';
import { PDF_DOWNLOAD_METHOD } from './constants/pdf-download-method.constant';
import { GovCyPdfDownloaderService } from './gov-cy-pdf-downloader.service';
import { GovCyPdfHotelsService } from './gov-cy-pdf-hotels.service';
import { PromptsService } from '../prompts/prompts.service';
import { PROMPT_TYPE } from '../prompts/constants/prompt-type.enum';
import { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';
import { IDownloadedGovCyPdfFile } from './types/downloaded-gov-cy-pdf-file.interface';
import { IDiscoveredGovCyPdfFile } from './types/discovered-gov-cy-pdf-file.interface';
import { IRecognizedGovCyHotelRecord } from './types/recognized-gov-cy-hotel-record.interface';
import { IPrompt } from '../prompts/types/prompt.interface';

jest.mock('node:fs/promises', () => ({
  access: jest.fn(),
  chmod: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

interface IFetchResponse {
  ok: boolean;
  status: number;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

function createFetchFailedError(code: string): TypeError {
  return new TypeError('fetch failed', {
    cause: {
      code,
    },
  });
}

describe('GovCyPdfHotelsService', () => {
  let service: GovCyPdfHotelsService;
  let govCyPdfDownloaderService: {
    downloadPdfToPath: jest.Mock<
      Promise<{ bytes: Buffer; method: PDF_DOWNLOAD_METHOD }>,
      [{ pdfUrl: string; targetPath: string; timeoutMs: number }]
    >;
  };
  let promptsService: {
    readLatestByType: jest.Mock<Promise<IPrompt | null>, [PROMPT_TYPE]>;
  };

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

  const discoveredPdfFileFixture: IDiscoveredGovCyPdfFile = {
    collectedAt: '2026-04-21T08:00:00.000Z',
    docType: 'gov_list',
    filename: 'POLIS_HOTELS_16.2.2026.pdf',
    pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
    publishedAt: '2026-02-16T00:00:00.000Z',
    region: 'POLIS',
  };

  const downloadedPdfFileFixture: IDownloadedGovCyPdfFile = {
    ...discoveredPdfFileFixture,
    localPath: '/tmp/hr-core-pdf-files/2026-02-16/POLIS_HOTELS_16.2.2026.pdf',
  };

  const recognizedHotelFixture: IRecognizedGovCyHotelRecord = {
    address: '40, Alekos Michailides Rd',
    beds: 366,
    classRaw: '5*',
    contacts: {
      domain: 'anassa.com',
      emails: ['anassa@thanoshotels.com'],
      faxes: ['+357 26 322 900'],
      phones: ['+357 26 888 000'],
      websites: ['https://www.anassa.com/'],
    },
    createdAt: new Date('2026-04-21T08:00:00.000Z'),
    establishmentType: 'HOTEL',
    licenseStatus: 'P',
    locality: 'Neo Chorion (Aphrodite Paths)',
    managerName: 'Mr Sebastian Wurst',
    name: 'ANASSA',
    nameNormalized: 'ANASSA',
    operatorName: 'Thanos Club Hotels Ltd',
    postcode: '8852',
    region: 'Pafos',
    rooms: 177,
    sourceFile: {
      filename: discoveredPdfFileFixture.filename,
      localPath: downloadedPdfFileFixture.localPath,
      pdfUrl: discoveredPdfFileFixture.pdfUrl,
    },
    stars: 5,
    updatedAt: new Date('2026-02-20T00:00:00.000Z'),
  };

  const mkdirMock = jest.mocked(fsPromises.mkdir);
  const chmodMock = jest.mocked(fsPromises.chmod);
  const accessMock = jest.mocked(fsPromises.access);
  const writeFileMock = jest.mocked(fsPromises.writeFile);
  const readFileMock = jest.mocked(fsPromises.readFile);

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-21T08:00:00.000Z'));
    global.fetch = jest.fn<Promise<IFetchResponse>, [RequestInfo | URL, RequestInit?]>();
    govCyPdfDownloaderService = {
      downloadPdfToPath: jest.fn(),
    };
    promptsService = {
      readLatestByType: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovCyPdfHotelsService,
        {
          provide: GovCyPdfDownloaderService,
          useValue: govCyPdfDownloaderService,
        },
        {
          provide: PromptsService,
          useValue: promptsService,
        },
        {
          provide: GOV_CY_PDF_HOTELS_CONFIG,
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<GovCyPdfHotelsService>(GovCyPdfHotelsService);
  });

  afterEach(() => {
    config.openAiResponsesTimeoutMs = 360000;
    jest.useRealTimers();
  });

  it('discovers and normalizes hotel pdf links via Apify', async () => {
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => [
          {
            pdfLinks: [
              '/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
              'https://www.gov.cy/app/uploads/sites/26/2026/02/PET_FRIENDLY_16.2.2026.pdf',
              '/app/uploads/sites/26/2026/02/HOTELS_LARNAKA_1.3.2026.pdf',
              '/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
            ],
          },
        ],
        ok: true,
        status: 201,
      });

    const result = await service.discoverPdfFiles();

    const fetchCall = jest.mocked(global.fetch).mock.calls[0];
    const requestInit = fetchCall[1];

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.apify.com/v2/acts/apify~web-scraper/run-sync-get-dataset-items',
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${config.apifyToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    );
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      injectJQuery: true,
      maxCrawlingDepth: 0,
      maxRequestsPerCrawl: 1,
      pageFunction: PDF_DISCOVERY_PAGE_FUNCTION,
      proxyConfiguration: {
        useApifyProxy: true,
      },
      startUrls: [
        {
          url: config.govCyHotelsPageUrl,
        },
      ],
    });
    expect(result).toEqual([
      discoveredPdfFileFixture,
      {
        collectedAt: '2026-04-21T08:00:00.000Z',
        docType: 'gov_list',
        filename: 'HOTELS_LARNAKA_1.3.2026.pdf',
        pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/02/HOTELS_LARNAKA_1.3.2026.pdf',
        publishedAt: '2026-03-01T00:00:00.000Z',
        region: 'LARNAKA',
      },
    ]);
  });

  it('ensures the storage directory exists and is writable', async () => {
    const result = await service.ensureStorageDirectoryIsWritable();

    expect(mkdirMock).toHaveBeenCalledWith(config.storageDirectoryPath, { recursive: true });
    expect(chmodMock).toHaveBeenCalledWith(config.storageDirectoryPath, 0o775);
    expect(accessMock).toHaveBeenCalledWith(config.storageDirectoryPath, constants.W_OK);
    expect(result).toBe(config.storageDirectoryPath);
  });

  it('downloads many pdf files to a dated local directory', async () => {
    govCyPdfDownloaderService.downloadPdfToPath.mockResolvedValue({
      bytes: Buffer.from([1, 2, 3]),
      method: PDF_DOWNLOAD_METHOD.DOWNLOAD,
    });

    const result = await service.downloadPdfFiles([discoveredPdfFileFixture]);

    expect(mkdirMock).toHaveBeenCalledWith(config.storageDirectoryPath, { recursive: true });
    expect(mkdirMock).toHaveBeenCalledWith(join(config.storageDirectoryPath, '2026-02-16'), {
      recursive: true,
    });
    expect(govCyPdfDownloaderService.downloadPdfToPath).toHaveBeenCalledWith({
      pdfUrl: discoveredPdfFileFixture.pdfUrl,
      targetPath: downloadedPdfFileFixture.localPath,
      timeoutMs: 90000,
    });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(result).toEqual([downloadedPdfFileFixture]);
  });

  it('parses downloaded pdf files through OpenAI and normalizes the recognized records', async () => {
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'completed',
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: '40, Alekos Michailides Rd',
                        beds: 366,
                        classRaw: '5*',
                        contacts: {
                          domain: 'anassa.com',
                          emails: ['anassa@thanoshotels.com'],
                          faxes: ['+357 26 322 900'],
                          phones: ['+357 26 888 000'],
                          websites: ['www.anassa.com'],
                        },
                        establishmentType: 'HOTEL',
                        licenseStatus: 'P',
                        locality: 'Neo Chorion (Aphrodite Paths)',
                        managerName: 'Mr Sebastian Wurst',
                        name: 'ANASSA',
                        nameNormalized: 'ANASSA',
                        operatorName: 'Thanos Club Hotels Ltd',
                        postcode: '8852',
                        region: 'Pafos',
                        rooms: 177,
                        stars: 5,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const result = await service.parsePdfFiles([downloadedPdfFileFixture]);

    expect(readFileMock).toHaveBeenCalledWith(downloadedPdfFileFixture.localPath);
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.openai.com/v1/files',
      expect.objectContaining({
        body: expect.any(FormData),
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`,
        },
        method: 'POST',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        body: expect.stringContaining('System prompt from db'),
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    );
    expect(jest.mocked(global.fetch).mock.calls[1]?.[1]?.body).toEqual(
      expect.stringContaining('User prompt from db'),
    );
    expect(JSON.parse(String(jest.mocked(global.fetch).mock.calls[1]?.[1]?.body))).toEqual(
      expect.objectContaining({
        background: true,
        store: true,
      }),
    );
    expect(result).toEqual([
      {
        ...recognizedHotelFixture,
        createdAt: new Date('2026-04-21T08:00:00.000Z'),
      },
    ]);
  });

  it('polls OpenAI background responses until the parsing result is completed', async () => {
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'in_progress',
        }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'completed',
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: recognizedHotelFixture.address,
                        beds: recognizedHotelFixture.beds,
                        classRaw: recognizedHotelFixture.classRaw,
                        contacts: {
                          domain: 'anassa.com',
                          emails: ['anassa@thanoshotels.com'],
                          faxes: ['+357 26 322 900'],
                          phones: ['+357 26 888 000'],
                          websites: ['www.anassa.com'],
                        },
                        establishmentType: recognizedHotelFixture.establishmentType,
                        licenseStatus: recognizedHotelFixture.licenseStatus,
                        locality: recognizedHotelFixture.locality,
                        managerName: recognizedHotelFixture.managerName,
                        name: recognizedHotelFixture.name,
                        nameNormalized: recognizedHotelFixture.nameNormalized,
                        operatorName: recognizedHotelFixture.operatorName,
                        postcode: recognizedHotelFixture.postcode,
                        region: recognizedHotelFixture.region,
                        rooms: recognizedHotelFixture.rooms,
                        stars: recognizedHotelFixture.stars,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const parsingPromise = service.parsePdfFiles([downloadedPdfFileFixture]);

    await jest.advanceTimersByTimeAsync(5000);

    const result = await parsingPromise;

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.openai.com/v1/responses/resp_123',
      expect.objectContaining({
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }),
    );
    expect(result).toEqual([
      {
        ...recognizedHotelFixture,
        createdAt: new Date('2026-04-21T08:00:05.000Z'),
      },
    ]);
  });

  it('keeps polling background responses beyond the old total timeout budget', async () => {
    config.openAiResponsesTimeoutMs = 1000;
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'in_progress',
        }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'completed',
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: recognizedHotelFixture.address,
                        beds: recognizedHotelFixture.beds,
                        classRaw: recognizedHotelFixture.classRaw,
                        contacts: {
                          domain: 'anassa.com',
                          emails: ['anassa@thanoshotels.com'],
                          faxes: ['+357 26 322 900'],
                          phones: ['+357 26 888 000'],
                          websites: ['www.anassa.com'],
                        },
                        establishmentType: recognizedHotelFixture.establishmentType,
                        licenseStatus: recognizedHotelFixture.licenseStatus,
                        locality: recognizedHotelFixture.locality,
                        managerName: recognizedHotelFixture.managerName,
                        name: recognizedHotelFixture.name,
                        nameNormalized: recognizedHotelFixture.nameNormalized,
                        operatorName: recognizedHotelFixture.operatorName,
                        postcode: recognizedHotelFixture.postcode,
                        region: recognizedHotelFixture.region,
                        rooms: recognizedHotelFixture.rooms,
                        stars: recognizedHotelFixture.stars,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const parsingPromise = service.parsePdfFiles([downloadedPdfFileFixture]);

    await jest.advanceTimersByTimeAsync(5000);

    const result = await parsingPromise;

    expect(result).toEqual([
      {
        ...recognizedHotelFixture,
        createdAt: new Date('2026-04-21T08:00:05.000Z'),
      },
    ]);
    config.openAiResponsesTimeoutMs = 360000;
  });

  it('retries transient OpenAI response creation failures before succeeding', async () => {
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockRejectedValueOnce(createFetchFailedError('UND_ERR_HEADERS_TIMEOUT'))
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'completed',
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: recognizedHotelFixture.address,
                        beds: recognizedHotelFixture.beds,
                        classRaw: recognizedHotelFixture.classRaw,
                        contacts: {
                          domain: 'anassa.com',
                          emails: ['anassa@thanoshotels.com'],
                          faxes: ['+357 26 322 900'],
                          phones: ['+357 26 888 000'],
                          websites: ['www.anassa.com'],
                        },
                        establishmentType: recognizedHotelFixture.establishmentType,
                        licenseStatus: recognizedHotelFixture.licenseStatus,
                        locality: recognizedHotelFixture.locality,
                        managerName: recognizedHotelFixture.managerName,
                        name: recognizedHotelFixture.name,
                        nameNormalized: recognizedHotelFixture.nameNormalized,
                        operatorName: recognizedHotelFixture.operatorName,
                        postcode: recognizedHotelFixture.postcode,
                        region: recognizedHotelFixture.region,
                        rooms: recognizedHotelFixture.rooms,
                        stars: recognizedHotelFixture.stars,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const parsingPromise = service.parsePdfFiles([downloadedPdfFileFixture]);

    await jest.advanceTimersByTimeAsync(1000);

    const result = await parsingPromise;

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toEqual([
      {
        ...recognizedHotelFixture,
        createdAt: new Date('2026-04-21T08:00:01.000Z'),
      },
    ]);
  });

  it('retries transient OpenAI polling failures before succeeding', async () => {
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'in_progress',
        }),
        ok: true,
        status: 200,
      })
      .mockRejectedValueOnce(createFetchFailedError('ECONNRESET'))
      .mockResolvedValueOnce({
        json: async () => ({
          id: 'resp_123',
          status: 'completed',
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: recognizedHotelFixture.address,
                        beds: recognizedHotelFixture.beds,
                        classRaw: recognizedHotelFixture.classRaw,
                        contacts: {
                          domain: 'anassa.com',
                          emails: ['anassa@thanoshotels.com'],
                          faxes: ['+357 26 322 900'],
                          phones: ['+357 26 888 000'],
                          websites: ['www.anassa.com'],
                        },
                        establishmentType: recognizedHotelFixture.establishmentType,
                        licenseStatus: recognizedHotelFixture.licenseStatus,
                        locality: recognizedHotelFixture.locality,
                        managerName: recognizedHotelFixture.managerName,
                        name: recognizedHotelFixture.name,
                        nameNormalized: recognizedHotelFixture.nameNormalized,
                        operatorName: recognizedHotelFixture.operatorName,
                        postcode: recognizedHotelFixture.postcode,
                        region: recognizedHotelFixture.region,
                        rooms: recognizedHotelFixture.rooms,
                        stars: recognizedHotelFixture.stars,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const parsingPromise = service.parsePdfFiles([downloadedPdfFileFixture]);

    await jest.advanceTimersByTimeAsync(7000);

    const result = await parsingPromise;

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.openai.com/v1/responses/resp_123',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      'https://api.openai.com/v1/responses/resp_123',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(result).toEqual([
      {
        ...recognizedHotelFixture,
        createdAt: new Date('2026-04-21T08:00:06.000Z'),
      },
    ]);
  });

  it('normalizes websites, moves email-like website values into emails and preserves property-specific paths', async () => {
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: '  3, Papaelissaiou Street ',
                        beds: 16,
                        classRaw: 'N/A',
                        contacts: {
                          domain: 'wrong-domain.example',
                          emails: [' Info@CyprusVillageHouses.net '],
                          faxes: ['+357 25 736 792'],
                          phones: ['+357 99 525 462'],
                          websites: [
                            'https://anogyravillage.cy/',
                            ' anogyravillage.cy/nicolas-maria-cottages/ ',
                            'www.soulibeach@cytanet.com.cy',
                            ' www. avalonvillagehouses.com ',
                            'cyprusagroyourism-loxandrainn',
                          ],
                        },
                        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
                        licenseStatus: 'P',
                        locality: 'Anogyra',
                        managerName: 'Mr Nicos Makrides',
                        name: 'NICOLAS & MARIA\'S COTTAGE',
                        nameNormalized: 'NICOLAS & MARIA\'S COTTAGE',
                        operatorName: 'Mr Nicos Makrides',
                        postcode: '4603',
                        region: 'LIMASSOL',
                        rooms: 8,
                        stars: null,
                        updatedAt: '2026-04-08T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });

    const result = await service.parsePdfFiles([downloadedPdfFileFixture]);

    expect(result).toEqual([
      {
        address: '3, Papaelissaiou Street',
        beds: 16,
        classRaw: 'N/A',
        contacts: {
          domain: 'anogyravillage.cy',
          emails: [
            'info@cyprusvillagehouses.net',
            'soulibeach@cytanet.com.cy',
          ],
          faxes: ['+357 25 736 792'],
          phones: ['+357 99 525 462'],
          websites: [
            'https://anogyravillage.cy/nicolas-maria-cottages/',
            'https://anogyravillage.cy/',
            'https://www.avalonvillagehouses.com/',
          ],
        },
        createdAt: new Date('2026-04-21T08:00:00.000Z'),
        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
        licenseStatus: 'P',
        locality: 'Anogyra',
        managerName: 'Mr Nicos Makrides',
        name: 'NICOLAS & MARIA\'S COTTAGE',
        nameNormalized: 'NICOLAS & MARIA\'S COTTAGE',
        operatorName: 'Mr Nicos Makrides',
        postcode: '4603',
        region: 'LIMASSOL',
        rooms: 8,
        sourceFile: {
          filename: discoveredPdfFileFixture.filename,
          localPath: downloadedPdfFileFixture.localPath,
          pdfUrl: discoveredPdfFileFixture.pdfUrl,
        },
        stars: null,
        updatedAt: new Date('2026-04-08T00:00:00.000Z'),
      },
    ]);
  });

  it('collects, downloads and parses pdf files end-to-end', async () => {
    promptsService.readLatestByType
      .mockResolvedValueOnce({
        content: 'System prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      })
      .mockResolvedValueOnce({
        content: 'User prompt from db',
        createdAt: new Date('2026-04-21T00:00:00.000Z'),
        type: PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
        updatedAt: new Date('2026-04-21T00:00:00.000Z'),
        version: 1,
      });
    jest.mocked(global.fetch)
      .mockResolvedValueOnce({
        json: async () => [
          {
            pdfLinks: [discoveredPdfFileFixture.pdfUrl],
          },
        ],
        ok: true,
        status: 201,
      })
      .mockResolvedValueOnce({
        json: async () => ({ id: 'file_123' }),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        json: async () => ({
          output: [
            {
              content: [
                {
                  text: JSON.stringify({
                    hotels: [
                      {
                        address: recognizedHotelFixture.address,
                        beds: recognizedHotelFixture.beds,
                        classRaw: recognizedHotelFixture.classRaw,
                        contacts: recognizedHotelFixture.contacts,
                        establishmentType: recognizedHotelFixture.establishmentType,
                        licenseStatus: recognizedHotelFixture.licenseStatus,
                        locality: recognizedHotelFixture.locality,
                        managerName: recognizedHotelFixture.managerName,
                        name: recognizedHotelFixture.name,
                        nameNormalized: recognizedHotelFixture.nameNormalized,
                        operatorName: recognizedHotelFixture.operatorName,
                        postcode: recognizedHotelFixture.postcode,
                        region: recognizedHotelFixture.region,
                        rooms: recognizedHotelFixture.rooms,
                        stars: recognizedHotelFixture.stars,
                        updatedAt: '2026-02-20T00:00:00.000Z',
                      },
                    ],
                  }),
                  type: 'output_text',
                },
              ],
            },
          ],
        }),
        ok: true,
        status: 200,
      });
    govCyPdfDownloaderService.downloadPdfToPath.mockResolvedValue({
      bytes: Buffer.from([1, 2, 3]),
      method: PDF_DOWNLOAD_METHOD.DOWNLOAD,
    });
    readFileMock.mockResolvedValue(Buffer.from('pdf-binary'));

    const result = await service.collectDownloadAndParsePdfFiles();

    expect(govCyPdfDownloaderService.downloadPdfToPath).toHaveBeenCalledWith({
      pdfUrl: discoveredPdfFileFixture.pdfUrl,
      targetPath: downloadedPdfFileFixture.localPath,
      timeoutMs: 90000,
    });
    expect(result).toEqual([recognizedHotelFixture]);
  });
});
