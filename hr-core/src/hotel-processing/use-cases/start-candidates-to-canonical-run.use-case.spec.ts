import { HOTEL_PROCESSING_BATCH_SIZE } from '../constants/hotel-processing-defaults.constant';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HOTEL_PROCESSING_STATUS } from '../constants/hotel-processing-status.enum';
import { HotelProcessingActiveRunExistsError } from '../errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoPendingSourceDocumentsError } from '../errors/hotel-processing-no-pending-source-documents.error';
import { StartCandidatesToCanonicalRunUseCase } from './start-candidates-to-canonical-run.use-case';

interface ICanonicalHotelCandidatesServiceMock {
  countByProcessingStatus: jest.Mock<
    Promise<number>,
    [HOTEL_PROCESSING_STATUS]
  >;
  initializeMissingProcessing: jest.Mock<Promise<number>, []>;
  recoverStaleClaimedDocuments: jest.Mock<Promise<number>, [Date]>;
  resetReviewRequiredToPending: jest.Mock<Promise<number>, []>;
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
  addCandidatesToCanonicalBatch: jest.Mock<
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

describe('StartCandidatesToCanonicalRunUseCase', () => {
  let canonicalHotelCandidatesService: ICanonicalHotelCandidatesServiceMock;
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let hotelProcessingQueueService: IHotelProcessingQueueServiceMock;
  let useCase: StartCandidatesToCanonicalRunUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-04T08:00:00.000Z'));

    canonicalHotelCandidatesService = {
      countByProcessingStatus: jest.fn(),
      initializeMissingProcessing: jest.fn(),
      recoverStaleClaimedDocuments: jest.fn(),
      resetReviewRequiredToPending: jest.fn(),
    };
    hotelProcessingRunsService = {
      createQueuedRun: jest.fn(),
      hasActiveRun: jest.fn(),
    };
    hotelProcessingQueueService = {
      addCandidatesToCanonicalBatch: jest.fn(),
    };
    useCase = new StartCandidatesToCanonicalRunUseCase(
      canonicalHotelCandidatesService,
      hotelProcessingRunsService,
      hotelProcessingQueueService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('recovers candidates, creates a run, and queues first batch', async () => {
    canonicalHotelCandidatesService.initializeMissingProcessing.mockResolvedValue(
      0,
    );
    canonicalHotelCandidatesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    canonicalHotelCandidatesService.countByProcessingStatus.mockResolvedValue(
      746,
    );
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    hotelProcessingQueueService.addCandidatesToCanonicalBatch.mockResolvedValue();

    const result = await useCase.execute();

    expect(
      canonicalHotelCandidatesService.initializeMissingProcessing,
    ).toHaveBeenCalledTimes(1);
    expect(
      canonicalHotelCandidatesService.recoverStaleClaimedDocuments,
    ).toHaveBeenCalledWith(new Date('2026-05-04T07:30:00.000Z'));
    expect(hotelProcessingRunsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-04T08-00-00-candidates-to-canonical',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
      total: 746,
    });
    expect(
      hotelProcessingQueueService.addCandidatesToCanonicalBatch,
    ).toHaveBeenCalledWith({
      batchNo: 1,
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-04T08-00-00-candidates-to-canonical',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
    });
    expect(result).toEqual({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      ok: true,
      runId: '2026-05-04T08-00-00-candidates-to-canonical',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    });
  });

  it('blocks when an active candidates-to-canonical run already exists', async () => {
    canonicalHotelCandidatesService.initializeMissingProcessing.mockResolvedValue(
      0,
    );
    canonicalHotelCandidatesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(true);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingActiveRunExistsError,
    );
    expect(
      canonicalHotelCandidatesService.countByProcessingStatus,
    ).not.toHaveBeenCalled();
  });

  it('blocks when there are no pending candidates', async () => {
    canonicalHotelCandidatesService.initializeMissingProcessing.mockResolvedValue(
      0,
    );
    canonicalHotelCandidatesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    canonicalHotelCandidatesService.countByProcessingStatus.mockResolvedValue(
      0,
    );

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelProcessingNoPendingSourceDocumentsError,
    );
    expect(
      hotelProcessingQueueService.addCandidatesToCanonicalBatch,
    ).not.toHaveBeenCalled();
  });

  it('resets review-required candidates before retrying them', async () => {
    canonicalHotelCandidatesService.initializeMissingProcessing.mockResolvedValue(
      0,
    );
    canonicalHotelCandidatesService.recoverStaleClaimedDocuments.mockResolvedValue(
      0,
    );
    hotelProcessingRunsService.hasActiveRun.mockResolvedValue(false);
    canonicalHotelCandidatesService.countByProcessingStatus
      .mockResolvedValueOnce(57)
      .mockResolvedValueOnce(57);
    canonicalHotelCandidatesService.resetReviewRequiredToPending.mockResolvedValue(
      57,
    );
    hotelProcessingRunsService.createQueuedRun.mockResolvedValue({});
    hotelProcessingQueueService.addCandidatesToCanonicalBatch.mockResolvedValue();

    const result = await useCase.execute({
      retryReviewRequired: true,
    });

    expect(
      canonicalHotelCandidatesService.resetReviewRequiredToPending,
    ).toHaveBeenCalledTimes(1);
    expect(hotelProcessingRunsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: HOTEL_PROCESSING_BATCH_SIZE,
      runId: '2026-05-04T08-00-00-candidates-to-canonical',
      stage: HOTEL_PROCESSING_STAGE.CANDIDATES_TO_CANONICAL,
      total: 57,
    });
    expect(result.ok).toBe(true);
  });
});
