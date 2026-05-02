import { Test, TestingModule } from '@nestjs/testing';
import { HOTEL_PROCESSING_RUN_STATUS } from '../../hotel-processing/constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../../hotel-processing/constants/hotel-processing-stage.enum';
import { HotelProcessingActiveRunExistsError } from '../../hotel-processing/errors/hotel-processing-active-run-exists.error';
import { HotelProcessingRunsService } from '../../hotel-processing/hotel-processing-runs.service';
import { GovCyPdfParsingQueueService } from '../services';
import { StartGovCyPdfParsingRunUseCase } from './start-gov-cy-pdf-parsing-run.use-case';

interface IHotelProcessingRunsServiceMock {
  createQueuedRun: jest.Mock<
    Promise<unknown>,
    [
      {
        batchSize: number;
        runId: string;
        stage: HOTEL_PROCESSING_STAGE;
        total: number;
      },
    ]
  >;
  fail: jest.Mock<Promise<void>, [string, string]>;
  hasActiveRun: jest.Mock<Promise<boolean>, [HOTEL_PROCESSING_STAGE]>;
}

interface IGovCyPdfParsingQueueServiceMock {
  addParseRun: jest.Mock<
    Promise<void>,
    [
      {
        runId: string;
        stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE;
      },
    ]
  >;
}

describe('StartGovCyPdfParsingRunUseCase', () => {
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let govCyPdfParsingQueueService: IGovCyPdfParsingQueueServiceMock;
  let useCase: StartGovCyPdfParsingRunUseCase;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-02T18:30:00.000Z'));

    hotelProcessingRunsService = {
      createQueuedRun: jest.fn(),
      fail: jest.fn(),
      hasActiveRun: jest.fn(),
    };
    govCyPdfParsingQueueService = {
      addParseRun: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StartGovCyPdfParsingRunUseCase,
        {
          provide: HotelProcessingRunsService,
          useValue: hotelProcessingRunsService,
        },
        {
          provide: GovCyPdfParsingQueueService,
          useValue: govCyPdfParsingQueueService,
        },
      ],
    }).compile();

    useCase = module.get<StartGovCyPdfParsingRunUseCase>(
      StartGovCyPdfParsingRunUseCase,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a queued parsing run and enqueues the BullMQ job', async () => {
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    govCyPdfParsingQueueService.addParseRun.mockResolvedValue();

    const result = await useCase.execute();

    expect(hotelProcessingRunsService.hasActiveRun).toHaveBeenCalledWith(
      HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    );
    expect(hotelProcessingRunsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: 1,
      runId: '2026-05-02T18-30-00-gov-cy-pdf-parse',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      total: 0,
    });
    expect(govCyPdfParsingQueueService.addParseRun).toHaveBeenCalledWith({
      runId: '2026-05-02T18-30-00-gov-cy-pdf-parse',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    });
    expect(result).toEqual({
      batchSize: 1,
      ok: true,
      runId: '2026-05-02T18-30-00-gov-cy-pdf-parse',
      stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    });
  });

  it('blocks when an active parsing run already exists', async () => {
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(true);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingActiveRunExistsError,
    );

    expect(hotelProcessingRunsService.createQueuedRun).not.toHaveBeenCalled();
    expect(govCyPdfParsingQueueService.addParseRun).not.toHaveBeenCalled();
  });

  it('marks the run as failed when enqueue fails', async () => {
    const enqueueError = new Error('Redis is unavailable');

    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    govCyPdfParsingQueueService.addParseRun.mockRejectedValue(enqueueError);

    await expect(useCase.execute()).rejects.toBe(enqueueError);

    expect(hotelProcessingRunsService.fail).toHaveBeenCalledWith(
      '2026-05-02T18-30-00-gov-cy-pdf-parse',
      'Redis is unavailable',
    );
  });
});
