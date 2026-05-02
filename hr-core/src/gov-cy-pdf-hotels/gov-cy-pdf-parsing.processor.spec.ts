import { Test, TestingModule } from '@nestjs/testing';
import { HOTEL_PROCESSING_STAGE } from '../hotel-processing/constants/hotel-processing-stage.enum';
import { HotelProcessingRunsService } from '../hotel-processing/hotel-processing-runs.service';
import { ParsedFilesService } from '../parsed-files/parsed-files.service';
import { RawHotelsService } from '../raw-hotels/raw-hotels.service';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfParsingProcessor } from './gov-cy-pdf-parsing.processor';
import { GovCyPdfHotelsService } from './services';
import { IDiscoveredGovCyPdfFile } from './types/discovered-gov-cy-pdf-file.interface';
import { IDownloadedGovCyPdfFile } from './types/downloaded-gov-cy-pdf-file.interface';
import { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';
import { IRecognizedGovCyHotelRecord } from './types/recognized-gov-cy-hotel-record.interface';

interface IGovCyPdfHotelsServiceMock {
  cleanupParsingTmpDirectory: jest.Mock<Promise<void>, [string]>;
  discoverPdfFiles: jest.Mock<Promise<IDiscoveredGovCyPdfFile[]>, []>;
  downloadPdfFiles: jest.Mock<
    Promise<IDownloadedGovCyPdfFile[]>,
    [IDiscoveredGovCyPdfFile[]]
  >;
  parsePdfFileToBatches: jest.Mock<
    Promise<number>,
    [
      {
        downloadedPdfFile: IDownloadedGovCyPdfFile;
        onChunkProcessed?: (params: {
          chunkIndex: number;
          chunkTotal: number;
          recordsCount: number;
        }) => Promise<void>;
        onChunksPrepared?: (chunkTotal: number) => Promise<void>;
        onParsedBatch: (
          parsedHotels: IRecognizedGovCyHotelRecord[],
        ) => Promise<void>;
        runTmpDirectoryPath: string;
      },
    ]
  >;
  prepareParsingTmpDirectory: jest.Mock<Promise<string>, [string]>;
}

interface IRawHotelsServiceMock {
  upsertManyByStrictHotelDedupeKeyAndSourceFileName: jest.Mock<
    Promise<number>,
    [IRecognizedGovCyHotelRecord[]]
  >;
}

interface IParsedFilesServiceMock {
  createMany: jest.Mock<
    Promise<unknown[]>,
    [
      Array<{
        filename: string;
        parsedAt: Date;
        recordsCount: number;
      }>,
    ]
  >;
  readManyByFileNamesAndParsedAtFrom: jest.Mock<
    Promise<Array<{ filename: string; parsedAt: Date; recordsCount: number }>>,
    [string[], Date]
  >;
}

interface IHotelProcessingRunsServiceMock {
  complete: jest.Mock<Promise<void>, [string]>;
  fail: jest.Mock<Promise<void>, [string, string]>;
  incrementIgnored: jest.Mock<Promise<void>, [string, number]>;
  incrementProcessed: jest.Mock<Promise<void>, [string, number, number]>;
  markRunning: jest.Mock<Promise<void>, [string, number]>;
  setTotal: jest.Mock<Promise<void>, [string, number]>;
}

describe('GovCyPdfParsingProcessor', () => {
  let govCyPdfHotelsService: IGovCyPdfHotelsServiceMock;
  let rawHotelsService: IRawHotelsServiceMock;
  let parsedFilesService: IParsedFilesServiceMock;
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let processor: GovCyPdfParsingProcessor;

  const config: IGovCyPdfHotelsConfig = {
    apifyActorId: 'apify~web-scraper',
    apifyToken: 'apify-token',
    downloadTimeoutMs: 90000,
    govCyHotelsPageUrl:
      'https://www.gov.cy/tourism/en/documents/hotels-and-other-tourist-establishments-list/',
    openAiApiKey: 'openai-key',
    openAiModel: 'gpt-4.1',
    openAiResponsesTimeoutMs: 360000,
    parsingCacheTimeMs: 60000,
    storageDirectoryPath: '/tmp/hr-core-pdf-files',
    tmpDirectoryPath: '/tmp/hr-core-pdf-tmp',
  };

  const discoveredPdfFileFixture: IDiscoveredGovCyPdfFile = {
    collectedAt: '2026-04-21T08:00:00.000Z',
    docType: 'gov_list',
    filename: 'HOTELS_POLIS_8.4.2026.pdf',
    pdfUrl:
      'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
    publishedAt: '2026-04-08T00:00:00.000Z',
    region: 'POLIS',
  };

  const downloadedPdfFileFixture: IDownloadedGovCyPdfFile = {
    ...discoveredPdfFileFixture,
    localPath: '/opt/hr-core/data/files/2026-04-08/HOTELS_POLIS_8.4.2026.pdf',
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
    updatedAt: new Date('2026-04-08T00:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-21T08:00:00.000Z'));

    govCyPdfHotelsService = {
      cleanupParsingTmpDirectory: jest.fn(),
      discoverPdfFiles: jest.fn(),
      downloadPdfFiles: jest.fn(),
      parsePdfFileToBatches: jest.fn(),
      prepareParsingTmpDirectory: jest.fn(),
    };
    rawHotelsService = {
      upsertManyByStrictHotelDedupeKeyAndSourceFileName: jest.fn(),
    };
    parsedFilesService = {
      createMany: jest.fn(),
      readManyByFileNamesAndParsedAtFrom: jest.fn(),
    };
    hotelProcessingRunsService = {
      complete: jest.fn(),
      fail: jest.fn(),
      incrementIgnored: jest.fn(),
      incrementProcessed: jest.fn(),
      markRunning: jest.fn(),
      setTotal: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GovCyPdfParsingProcessor,
        {
          provide: GovCyPdfHotelsService,
          useValue: govCyPdfHotelsService,
        },
        {
          provide: RawHotelsService,
          useValue: rawHotelsService,
        },
        {
          provide: ParsedFilesService,
          useValue: parsedFilesService,
        },
        {
          provide: HotelProcessingRunsService,
          useValue: hotelProcessingRunsService,
        },
        {
          provide: GOV_CY_PDF_HOTELS_CONFIG,
          useValue: config,
        },
      ],
    }).compile();

    processor = module.get<GovCyPdfParsingProcessor>(GovCyPdfParsingProcessor);

    govCyPdfHotelsService.cleanupParsingTmpDirectory.mockResolvedValue();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses uncached files in the background and cleans tmp directory', async () => {
    govCyPdfHotelsService.prepareParsingTmpDirectory.mockResolvedValue(
      '/tmp/hr-core-pdf-tmp/run-1',
    );
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([
      discoveredPdfFileFixture,
    ]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([]);
    govCyPdfHotelsService.downloadPdfFiles.mockResolvedValue([
      downloadedPdfFileFixture,
    ]);
    govCyPdfHotelsService.parsePdfFileToBatches.mockImplementation(
      async ({ onParsedBatch }) => {
        await onParsedBatch([recognizedHotelFixture]);

        return 1;
      },
    );
    rawHotelsService.upsertManyByStrictHotelDedupeKeyAndSourceFileName.mockResolvedValue(
      1,
    );
    parsedFilesService.createMany.mockResolvedValue([]);

    await processor.processParseRun({
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    });

    expect(govCyPdfHotelsService.parsePdfFileToBatches).toHaveBeenCalledWith({
      downloadedPdfFile: downloadedPdfFileFixture,
      onChunkProcessed: expect.any(Function),
      onChunksPrepared: expect.any(Function),
      onParsedBatch: expect.any(Function),
      runTmpDirectoryPath: '/tmp/hr-core-pdf-tmp/run-1',
    });
    expect(
      rawHotelsService.upsertManyByStrictHotelDedupeKeyAndSourceFileName,
    ).toHaveBeenCalledWith([recognizedHotelFixture]);
    expect(parsedFilesService.createMany).toHaveBeenCalledWith([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 1,
      },
    ]);
    expect(hotelProcessingRunsService.markRunning).toHaveBeenCalledWith(
      'run-1',
      0,
    );
    expect(hotelProcessingRunsService.complete).toHaveBeenCalledWith('run-1');
    expect(
      govCyPdfHotelsService.cleanupParsingTmpDirectory,
    ).toHaveBeenCalledWith('run-1');
  });

  it('updates run progress after every parsed chunk before the whole PDF file completes', async () => {
    govCyPdfHotelsService.prepareParsingTmpDirectory.mockResolvedValue(
      '/tmp/hr-core-pdf-tmp/run-1',
    );
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([
      discoveredPdfFileFixture,
    ]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([]);
    govCyPdfHotelsService.downloadPdfFiles.mockResolvedValue([
      downloadedPdfFileFixture,
    ]);
    govCyPdfHotelsService.parsePdfFileToBatches.mockImplementation(
      async ({ onChunkProcessed, onChunksPrepared, onParsedBatch }) => {
        await onChunksPrepared?.(39);
        await onParsedBatch([recognizedHotelFixture]);
        await onChunkProcessed?.({
          chunkIndex: 1,
          chunkTotal: 39,
          recordsCount: 25,
        });
        await onParsedBatch([recognizedHotelFixture]);
        await onChunkProcessed?.({
          chunkIndex: 2,
          chunkTotal: 39,
          recordsCount: 24,
        });

        return 49;
      },
    );
    rawHotelsService.upsertManyByStrictHotelDedupeKeyAndSourceFileName.mockResolvedValue(
      1,
    );
    parsedFilesService.createMany.mockResolvedValue([]);

    await processor.processParseRun({
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    });

    expect(hotelProcessingRunsService.setTotal).toHaveBeenCalledWith(
      'run-1',
      39,
    );
    expect(hotelProcessingRunsService.markRunning).toHaveBeenCalledWith(
      'run-1',
      1,
    );
    expect(hotelProcessingRunsService.markRunning).toHaveBeenCalledWith(
      'run-1',
      2,
    );
    expect(hotelProcessingRunsService.incrementProcessed).toHaveBeenCalledTimes(
      2,
    );
    expect(hotelProcessingRunsService.incrementProcessed).toHaveBeenCalledWith(
      'run-1',
      1,
      0,
    );
    expect(parsedFilesService.createMany).toHaveBeenCalledWith([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 49,
      },
    ]);
  });

  it('skips cached files and increments ignored stats', async () => {
    govCyPdfHotelsService.prepareParsingTmpDirectory.mockResolvedValue(
      '/tmp/hr-core-pdf-tmp/run-1',
    );
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([
      discoveredPdfFileFixture,
    ]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T07:59:30.000Z'),
        recordsCount: 28,
      },
    ]);

    await processor.processParseRun({
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    });

    expect(govCyPdfHotelsService.downloadPdfFiles).not.toHaveBeenCalled();
    expect(govCyPdfHotelsService.parsePdfFileToBatches).not.toHaveBeenCalled();
    expect(hotelProcessingRunsService.incrementIgnored).toHaveBeenCalledWith(
      'run-1',
      1,
    );
    expect(hotelProcessingRunsService.complete).toHaveBeenCalledWith('run-1');
  });

  it('marks run failed and still cleans tmp directory on parsing errors', async () => {
    const parsingError = new Error('OpenAI failed');

    govCyPdfHotelsService.prepareParsingTmpDirectory.mockResolvedValue(
      '/tmp/hr-core-pdf-tmp/run-1',
    );
    govCyPdfHotelsService.discoverPdfFiles.mockRejectedValue(parsingError);

    await expect(
      processor.processParseRun({
        runId: 'run-1',
        stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      }),
    ).rejects.toBe(parsingError);

    expect(hotelProcessingRunsService.fail).toHaveBeenCalledWith(
      'run-1',
      'OpenAI failed',
    );
    expect(
      govCyPdfHotelsService.cleanupParsingTmpDirectory,
    ).toHaveBeenCalledWith('run-1');
  });
});
