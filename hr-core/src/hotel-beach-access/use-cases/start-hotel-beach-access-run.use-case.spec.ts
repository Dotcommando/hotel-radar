import { Types } from 'mongoose';
import { HOTEL_BEACH_ACCESS_BATCH_SIZE } from '../constants/hotel-beach-access-defaults.constant';
import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { HotelBeachAccessActiveRunExistsError } from '../errors/hotel-beach-access-active-run-exists.error';
import { HotelBeachAccessNoEligibleHotelsError } from '../errors/hotel-beach-access-no-eligible-hotels.error';
import { IHotelBeachAccessBatchJobData } from '../types/hotel-beach-access-batch-job-data.interface';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';
import { StartHotelBeachAccessRunUseCase } from './start-hotel-beach-access-run.use-case';

interface ICanonicalHotelsServiceMock {
  countActiveWithGeo: jest.Mock<Promise<number>, []>;
  countActiveWithoutGeo: jest.Mock<Promise<number>, []>;
  listActiveWithGeo: jest.Mock<
    Promise<Array<{ _id: Types.ObjectId }>>,
    []
  >;
}

interface IHotelBeachAccessRunsServiceMock {
  createQueuedRun: jest.Mock<
    Promise<IHotelBeachAccessRun>,
    [
      {
        runId: string;
        batchSize: number;
        total: number;
        ineligibleHotelsWithoutGeo: number;
      },
    ]
  >;
  hasActiveRun: jest.Mock<Promise<boolean>, []>;
}

interface IHotelBeachAccessRunItemsServiceMock {
  createPendingItems: jest.Mock<
    Promise<number>,
    [string, Types.ObjectId[]]
  >;
}

interface IHotelBeachAccessQueueServiceMock {
  addBatch: jest.Mock<Promise<void>, [IHotelBeachAccessBatchJobData]>;
}

describe('StartHotelBeachAccessRunUseCase', () => {
  let canonicalHotelsService: ICanonicalHotelsServiceMock;
  let runsService: IHotelBeachAccessRunsServiceMock;
  let runItemsService: IHotelBeachAccessRunItemsServiceMock;
  let queueService: IHotelBeachAccessQueueServiceMock;
  let useCase: StartHotelBeachAccessRunUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T09:15:00.000Z'));

    canonicalHotelsService = {
      countActiveWithGeo: jest.fn<Promise<number>, []>(),
      countActiveWithoutGeo: jest.fn<Promise<number>, []>(),
      listActiveWithGeo: jest.fn<Promise<Array<{ _id: Types.ObjectId }>>, []>(),
    };
    runsService = {
      createQueuedRun: jest.fn<
        Promise<IHotelBeachAccessRun>,
        [
          {
            runId: string;
            batchSize: number;
            total: number;
            ineligibleHotelsWithoutGeo: number;
          },
        ]
      >(),
      hasActiveRun: jest.fn<Promise<boolean>, []>(),
    };
    runItemsService = {
      createPendingItems: jest.fn<
        Promise<number>,
        [string, Types.ObjectId[]]
      >(),
    };
    queueService = {
      addBatch: jest.fn<Promise<void>, [IHotelBeachAccessBatchJobData]>(),
    };
    useCase = new StartHotelBeachAccessRunUseCase(
      canonicalHotelsService,
      runsService,
      runItemsService,
      queueService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a run, creates per-hotel items, and queues the first batch', async () => {
    const firstHotelId = new Types.ObjectId();
    const secondHotelId = new Types.ObjectId();

    runsService.hasActiveRun.mockResolvedValue(false);
    canonicalHotelsService.countActiveWithGeo.mockResolvedValue(2);
    canonicalHotelsService.countActiveWithoutGeo.mockResolvedValue(5);
    canonicalHotelsService.listActiveWithGeo.mockResolvedValue([
      {
        _id: firstHotelId,
      },
      {
        _id: secondHotelId,
      },
    ]);
    runsService.createQueuedRun.mockResolvedValue({
      activeLock: 'hotel_beach_access',
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      createdAt: new Date('2026-05-08T09:15:00.000Z'),
      currentBatch: 0,
      error: null,
      finishedAt: null,
      ineligibleHotelsWithoutGeo: 5,
      runId: '2026-05-08T09-15-00-hotel-beach-access',
      startedAt: null,
      stats: {
        failed: 0,
        processed: 0,
        skipped: 0,
        total: 2,
      },
      status: HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
      updatedAt: new Date('2026-05-08T09:15:00.000Z'),
    });
    runItemsService.createPendingItems.mockResolvedValue(2);
    queueService.addBatch.mockResolvedValue();

    const result = await useCase.execute();

    expect(runsService.createQueuedRun).toHaveBeenCalledWith({
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      ineligibleHotelsWithoutGeo: 5,
      runId: '2026-05-08T09-15-00-hotel-beach-access',
      total: 2,
    });
    expect(runItemsService.createPendingItems).toHaveBeenCalledWith(
      '2026-05-08T09-15-00-hotel-beach-access',
      [firstHotelId, secondHotelId],
    );
    expect(queueService.addBatch).toHaveBeenCalledWith({
      batchNo: 1,
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      runId: '2026-05-08T09-15-00-hotel-beach-access',
    });
    expect(result).toEqual({
      batchSize: HOTEL_BEACH_ACCESS_BATCH_SIZE,
      ineligibleHotelsWithoutGeo: 5,
      ok: true,
      runId: '2026-05-08T09-15-00-hotel-beach-access',
      status: HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
      total: 2,
    });
  });

  it('blocks when another hotel beach access run is active', async () => {
    runsService.hasActiveRun.mockResolvedValue(true);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelBeachAccessActiveRunExistsError,
    );
    expect(canonicalHotelsService.countActiveWithGeo).not.toHaveBeenCalled();
  });

  it('blocks when there are no active hotels with geo', async () => {
    runsService.hasActiveRun.mockResolvedValue(false);
    canonicalHotelsService.countActiveWithGeo.mockResolvedValue(0);

    await expect(useCase.execute()).rejects.toBeInstanceOf(
      HotelBeachAccessNoEligibleHotelsError,
    );
    expect(queueService.addBatch).not.toHaveBeenCalled();
  });
});
