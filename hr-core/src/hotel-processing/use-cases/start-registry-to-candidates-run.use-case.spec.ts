import { HOTEL_PROCESSING_BATCH_SIZE } from '../constants/hotel-processing-defaults.constant';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../constants/hotel-processing-status.enum';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoPendingSourceDocumentsError } from '../errors/hotel-processing-no-pending-source-documents.error';
import { HotelProcessingPreviousStageNotCompletedError } from '../errors/hotel-processing-previous-stage-not-completed.error';
import { StartRegistryToCandidatesRunUseCase } from './start-registry-to-candidates-run.use-case';

interface IRawHotelsServiceMock {
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
}

interface IHotelRegistryEntriesServiceMock {
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
  addRegistryToCandidatesBatch: jest.Mock<
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

describe('StartRegistryToCandidatesRunUseCase', () => {
  let rawHotelsService: IRawHotelsServiceMock;
  let hotelRegistryEntriesService: IHotelRegistryEntriesServiceMock;
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let hotelProcessingQueueService: IHotelProcessingQueueServiceMock;
  let useCase: StartRegistryToCandidatesRunUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-02T19:00:00.000Z'));

    rawHotelsService = {
      countByProcessingStatus: jest.fn(),
    };
    hotelRegistryEntriesService = {
      countByProcessingStatus: jest.fn(),
      initializeMissingProcessing: jest.fn(),
      recoverStaleClaimedDocuments: jest.fn(),
    };
    hotelProcessingRunsService = {
      createQueuedRun: jest.fn(),
      hasActiveRun: jest.fn(),
    };
    hotelProcessingQueueService = {
      addRegistryToCandidatesBatch: jest.fn(),
    };
    useCase = new StartRegistryToCandidatesRunUseCase(
      rawHotelsService,
      hotelRegistryEntriesService,
      hotelProcessingRunsService,
      hotelProcessingQueueService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers registry entries, creates a run, and queues first batch', async () => {
    rawHotelsService.countByProcessingStatus.mockResolvedValue(0);
    hotelRegistryEntriesService.initializeMissingProcessing.mockResolvedValue(0);
    hotelRegistryEntriesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(746);
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    hotelProcessingQueueService.addRegistryToCandidatesBatch.mockResolvedValue();

    const result = await useCase.execute();

    expect(
      hotelRegistryEntriesService.initializeMissingProcessing,
    ).toHaveBeenCalledTimes(1);
    expect(
      hotelRegistryEntriesService.recoverStaleClaimedDocuments,
    ).toHaveBeenCalledWith(new Date('2026-05-02T18:30:00.000Z'));
    expect(hotelProcessingRunsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-02T19-00-00-registry-to-candidates',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      total: 746,
    });
    expect(
      hotelProcessingQueueService.addRegistryToCandidatesBatch,
    ).toHaveBeenCalledWith({
      batchNo: 1,
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-02T19-00-00-registry-to-candidates',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
    });
    expect(result).toEqual({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      ok: true,
      runId: '2026-05-02T19-00-00-registry-to-candidates',
      stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    });
  });

  it('blocks when raw-to-registry is not fully completed', async () => {
    rawHotelsService.countByProcessingStatus
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    hotelRegistryEntriesService.initializeMissingProcessing.mockResolvedValue(0);
    hotelRegistryEntriesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );

    await expect(useCase.execute()).rejects.toEqual(
      new HotelProcessingPreviousStageNotCompletedError({
        blockingStage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
        claimed: 1,
        failed: 3,
        pending: 2,
      }),
    );
    expect(hotelProcessingRunsService.hasActiveRun).not.toHaveBeenCalled();
  });

  it('blocks when an active registry-to-candidates run already exists', async () => {
    rawHotelsService.countByProcessingStatus.mockResolvedValue(0);
    hotelRegistryEntriesService.initializeMissingProcessing.mockResolvedValue(0);
    hotelRegistryEntriesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(true);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingActiveRunExistsError,
    );
    expect(
      hotelRegistryEntriesService.countByProcessingStatus,
    ).not.toHaveBeenCalled();
  });

  it('blocks when there are no pending registry entries', async () => {
    rawHotelsService.countByProcessingStatus.mockResolvedValue(0);
    hotelRegistryEntriesService.initializeMissingProcessing.mockResolvedValue(0);
    hotelRegistryEntriesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    hotelRegistryEntriesService.countByProcessingStatus.mockResolvedValue(0);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingNoPendingSourceDocumentsError,
    );
    expect(
      hotelProcessingQueueService.addRegistryToCandidatesBatch,
    ).not.toHaveBeenCalled();
  });
});
