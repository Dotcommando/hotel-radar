import { HOTEL_PROCESSING_BATCH_SIZE } from '../constants/hotel-processing-defaults.constant';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../constants/hotel-processing-status.enum';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoPendingSourceDocumentsError } from '../errors/hotel-processing-no-pending-source-documents.error';
import { StartRawToRegistryRunUseCase } from './start-raw-to-registry-run.use-case';

interface IRawHotelsServiceMock {
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
  initializeMissingProcessing: jest.Mock<Promise<number>, []>;
  recoverStaleClaimedDocuments: jest.Mock<Promise<number>, [Date]>;
}

interface IHotelProcessingRunsServiceMock {
  createQueuedRun: jest.Mock<
    Promise<unknown>,
    [
      {
        runId: string;
        stage: HOTEL_PROCESSING_STAGE;
        batchSize: number;
        total: number;
      },
    ]
  >;
  hasActiveRun: jest.Mock<Promise<boolean>, [HOTEL_PROCESSING_STAGE]>;
}

interface IHotelProcessingQueueServiceMock {
  addRawToRegistryBatch: jest.Mock<
    Promise<void>,
    [
      {
        runId: string;
        stage: HOTEL_PROCESSING_STAGE;
        batchNo: number;
        batchSize: number;
      },
    ]
  >;
}

describe('StartRawToRegistryRunUseCase', () => {
  let rawHotelsService: IRawHotelsServiceMock;
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let hotelProcessingQueueService: IHotelProcessingQueueServiceMock;
  let useCase: StartRawToRegistryRunUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-02T18:30:00.000Z'));

    rawHotelsService = {
      countByProcessingStatus: jest.fn<
        Promise<number>,
        [HOTEL_PROCESSING_STATUS]
      >(),
      initializeMissingProcessing: jest.fn<Promise<number>, []>(),
      recoverStaleClaimedDocuments: jest.fn<Promise<number>, [Date]>(),
    };
    hotelProcessingRunsService = {
      createQueuedRun: jest.fn<
        Promise<unknown>,
        [
          {
            runId: string;
            stage: HOTEL_PROCESSING_STAGE;
            batchSize: number;
            total: number;
          },
        ]
      >(),
      hasActiveRun: jest.fn<Promise<boolean>, [HOTEL_PROCESSING_STAGE]>(),
    };
    hotelProcessingQueueService = {
      addRawToRegistryBatch: jest.fn<
        Promise<void>,
        [
          {
            runId: string;
            stage: HOTEL_PROCESSING_STAGE;
            batchNo: number;
            batchSize: number;
          },
        ]
      >(),
    };
    useCase = new StartRawToRegistryRunUseCase(
      rawHotelsService,
      hotelProcessingRunsService,
      hotelProcessingQueueService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers source documents, creates a run, and queues first batch', async () => {
    rawHotelsService.initializeMissingProcessing.mockResolvedValue(774);
    rawHotelsService.recoverStaleClaimedDocuments.mockResolvedValue(0);
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    rawHotelsService.countByProcessingStatus.mockResolvedValue(774);
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    hotelProcessingQueueService.addRawToRegistryBatch.mockResolvedValue();

    const result = await useCase.execute();

    expect(rawHotelsService.initializeMissingProcessing).toHaveBeenCalledTimes(
      1,
    );
    expect(rawHotelsService.recoverStaleClaimedDocuments).toHaveBeenCalledWith(
      new Date('2026-05-02T18:00:00.000Z'),
    );
    expect(hotelProcessingRunsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-02T18-30-00-raw-to-registry',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      total: 774,
    });
    expect(
      hotelProcessingQueueService.addRawToRegistryBatch,
    ).toHaveBeenCalledWith({
      batchNo: 1,
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-02T18-30-00-raw-to-registry',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
    });
    expect(result).toEqual({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      ok: true,
      runId: '2026-05-02T18-30-00-raw-to-registry',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    });
  });

  it('blocks when an active raw-to-registry run already exists', async () => {
    rawHotelsService.initializeMissingProcessing.mockResolvedValue(0);
    rawHotelsService.recoverStaleClaimedDocuments.mockResolvedValue(0);
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(true);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingActiveRunExistsError,
    );
    expect(rawHotelsService.countByProcessingStatus).not.toHaveBeenCalled();
  });

  it('blocks when there are no pending raw hotels', async () => {
    rawHotelsService.initializeMissingProcessing.mockResolvedValue(0);
    rawHotelsService.recoverStaleClaimedDocuments.mockResolvedValue(0);
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    rawHotelsService.countByProcessingStatus.mockResolvedValue(0);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingNoPendingSourceDocumentsError,
    );
    expect(
      hotelProcessingQueueService.addRawToRegistryBatch,
    ).not.toHaveBeenCalled();
  });
});
