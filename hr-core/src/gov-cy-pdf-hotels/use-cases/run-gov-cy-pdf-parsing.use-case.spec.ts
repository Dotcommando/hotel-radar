import { Test, TestingModule } from '@nestjs/testing';
import { ParsedFilesService } from '../../parsed-files/parsed-files.service';
import { IParsedFile } from '../../parsed-files/types/parsed-file.interface';
import { RawHotelsService } from '../../raw-hotels/raw-hotels.service';
import { GOV_CY_PDF_HOTELS_CONFIG } from '../constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsService } from '../gov-cy-pdf-hotels.service';
import { IGovCyPdfHotelsConfig } from '../types/gov-cy-pdf-hotels-config.interface';
import { IDiscoveredGovCyPdfFile } from '../types/discovered-gov-cy-pdf-file.interface';
import { IDownloadedGovCyPdfFile } from '../types/downloaded-gov-cy-pdf-file.interface';
import { IRecognizedGovCyHotelRecord } from '../types/recognized-gov-cy-hotel-record.interface';
import { RunGovCyPdfParsingUseCase } from './run-gov-cy-pdf-parsing.use-case';

describe('RunGovCyPdfParsingUseCase', () => {
  let useCase: RunGovCyPdfParsingUseCase;
  let govCyPdfHotelsService: {
    discoverPdfFiles: jest.Mock<Promise<IDiscoveredGovCyPdfFile[]>, []>;
    downloadPdfFiles: jest.Mock<Promise<IDownloadedGovCyPdfFile[]>, [IDiscoveredGovCyPdfFile[]]>;
    parsePdfFiles: jest.Mock<Promise<IRecognizedGovCyHotelRecord[]>, [IDownloadedGovCyPdfFile[]]>;
  };
  let rawHotelsService: {
    createMany: jest.Mock<Promise<IRecognizedGovCyHotelRecord[]>, [IRecognizedGovCyHotelRecord[]]>;
  };
  let parsedFilesService: {
    createMany: jest.Mock<Promise<IParsedFile[]>, [IParsedFile[]]>;
    readManyByFileNamesAndParsedAtFrom: jest.Mock<Promise<IParsedFile[]>, [string[], Date]>;
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
    filename: 'HOTELS_POLIS_8.4.2026.pdf',
    pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
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
      websites: ['www.anassa.com'],
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
      discoverPdfFiles: jest.fn(),
      downloadPdfFiles: jest.fn(),
      parsePdfFiles: jest.fn(),
    };
    rawHotelsService = {
      createMany: jest.fn(),
    };
    parsedFilesService = {
      createMany: jest.fn(),
      readManyByFileNamesAndParsedAtFrom: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunGovCyPdfParsingUseCase,
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
          provide: GOV_CY_PDF_HOTELS_CONFIG,
          useValue: config,
        },
      ],
    }).compile();

    useCase = module.get<RunGovCyPdfParsingUseCase>(RunGovCyPdfParsingUseCase);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses an uncached file and saves its parsing summary in parsed_files', async () => {
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([discoveredPdfFileFixture]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([]);
    govCyPdfHotelsService.downloadPdfFiles.mockResolvedValue([downloadedPdfFileFixture]);
    govCyPdfHotelsService.parsePdfFiles.mockResolvedValue([recognizedHotelFixture]);
    rawHotelsService.createMany.mockResolvedValue([recognizedHotelFixture]);
    parsedFilesService.createMany.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 1,
      },
    ]);

    const result = await useCase.execute();

    expect(parsedFilesService.readManyByFileNamesAndParsedAtFrom).toHaveBeenCalledWith(
      [discoveredPdfFileFixture.filename],
      new Date('2026-04-21T07:59:00.000Z'),
    );
    expect(govCyPdfHotelsService.downloadPdfFiles).toHaveBeenCalledWith([discoveredPdfFileFixture]);
    expect(govCyPdfHotelsService.parsePdfFiles).toHaveBeenCalledWith([downloadedPdfFileFixture]);
    expect(rawHotelsService.createMany).toHaveBeenCalledWith([recognizedHotelFixture]);
    expect(parsedFilesService.createMany).toHaveBeenCalledWith([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 1,
      },
    ]);
    expect(result).toEqual({
      files: [
        {
          filename: discoveredPdfFileFixture.filename,
          recordsCount: 1,
        },
      ],
    });
  });

  it('skips a file that was parsed within cache ttl and returns its saved summary', async () => {
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([discoveredPdfFileFixture]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T07:59:30.000Z'),
        recordsCount: 28,
      },
    ]);

    const result = await useCase.execute();

    expect(govCyPdfHotelsService.downloadPdfFiles).not.toHaveBeenCalled();
    expect(govCyPdfHotelsService.parsePdfFiles).not.toHaveBeenCalled();
    expect(rawHotelsService.createMany).not.toHaveBeenCalled();
    expect(parsedFilesService.createMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      files: [
        {
          filename: discoveredPdfFileFixture.filename,
          recordsCount: 28,
        },
      ],
    });
  });

  it('continues from the first uncached file when previous files are already cached', async () => {
    const secondDiscoveredPdfFileFixture: IDiscoveredGovCyPdfFile = {
      ...discoveredPdfFileFixture,
      filename: 'HOTELS_PARALIMNI_8.4.2026.pdf',
      pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_PARALIMNI_8.4.2026.pdf',
      region: 'PARALIMNI',
    };
    const secondDownloadedPdfFileFixture: IDownloadedGovCyPdfFile = {
      ...secondDiscoveredPdfFileFixture,
      localPath: '/opt/hr-core/data/files/2026-04-08/HOTELS_PARALIMNI_8.4.2026.pdf',
    };
    const secondRecognizedHotelFixture: IRecognizedGovCyHotelRecord = {
      ...recognizedHotelFixture,
      name: 'SEA GULL',
      nameNormalized: 'SEA GULL',
      sourceFile: {
        filename: secondDiscoveredPdfFileFixture.filename,
        localPath: secondDownloadedPdfFileFixture.localPath,
        pdfUrl: secondDiscoveredPdfFileFixture.pdfUrl,
      },
    };

    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([
      discoveredPdfFileFixture,
      secondDiscoveredPdfFileFixture,
    ]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T07:59:30.000Z'),
        recordsCount: 28,
      },
    ]);
    govCyPdfHotelsService.downloadPdfFiles.mockResolvedValue([secondDownloadedPdfFileFixture]);
    govCyPdfHotelsService.parsePdfFiles.mockResolvedValue([secondRecognizedHotelFixture]);
    rawHotelsService.createMany.mockResolvedValue([secondRecognizedHotelFixture]);
    parsedFilesService.createMany.mockResolvedValue([
      {
        filename: secondDiscoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 1,
      },
    ]);

    const result = await useCase.execute();

    expect(govCyPdfHotelsService.downloadPdfFiles).toHaveBeenCalledTimes(1);
    expect(govCyPdfHotelsService.downloadPdfFiles).toHaveBeenCalledWith([
      secondDiscoveredPdfFileFixture,
    ]);
    expect(result).toEqual({
      files: [
        {
          filename: discoveredPdfFileFixture.filename,
          recordsCount: 28,
        },
        {
          filename: secondDiscoveredPdfFileFixture.filename,
          recordsCount: 1,
        },
      ],
    });
  });

  it('reuses a single in-flight parsing operation for concurrent calls', async () => {
    let resolveParsingPromise: ((value: IRecognizedGovCyHotelRecord[]) => void) | null = null;
    const parsingPromise = new Promise<IRecognizedGovCyHotelRecord[]>((resolve) => {
      resolveParsingPromise = resolve;
    });

    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([discoveredPdfFileFixture]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([]);
    govCyPdfHotelsService.downloadPdfFiles.mockResolvedValue([downloadedPdfFileFixture]);
    govCyPdfHotelsService.parsePdfFiles.mockReturnValue(parsingPromise);
    rawHotelsService.createMany.mockResolvedValue([recognizedHotelFixture]);
    parsedFilesService.createMany.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T08:00:00.000Z'),
        recordsCount: 1,
      },
    ]);

    const firstPromise = useCase.execute();
    const secondPromise = useCase.execute();

    resolveParsingPromise?.([recognizedHotelFixture]);

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);

    expect(govCyPdfHotelsService.discoverPdfFiles).toHaveBeenCalledTimes(1);
    expect(govCyPdfHotelsService.parsePdfFiles).toHaveBeenCalledTimes(1);
    expect(parsedFilesService.createMany).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual({
      files: [
        {
          filename: discoveredPdfFileFixture.filename,
          recordsCount: 1,
        },
      ],
    });
    expect(secondResult).toEqual(firstResult);
  });

  it('uses the latest cached parsed_files record when several records exist for one filename', async () => {
    govCyPdfHotelsService.discoverPdfFiles.mockResolvedValue([discoveredPdfFileFixture]);
    parsedFilesService.readManyByFileNamesAndParsedAtFrom.mockResolvedValue([
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T07:59:10.000Z'),
        recordsCount: 12,
      },
      {
        filename: discoveredPdfFileFixture.filename,
        parsedAt: new Date('2026-04-21T07:59:50.000Z'),
        recordsCount: 28,
      },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual({
      files: [
        {
          filename: discoveredPdfFileFixture.filename,
          recordsCount: 28,
        },
      ],
    });
  });
});
