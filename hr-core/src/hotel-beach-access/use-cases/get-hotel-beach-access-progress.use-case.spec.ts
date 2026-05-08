import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';
import { GetHotelBeachAccessProgressUseCase } from './get-hotel-beach-access-progress.use-case';

interface IHotelBeachAccessRunsServiceMock {
  findActiveRun: jest.Mock<Promise<IHotelBeachAccessRun | null>, []>;
  findLatestRun: jest.Mock<Promise<IHotelBeachAccessRun | null>, []>;
}

describe('GetHotelBeachAccessProgressUseCase', () => {
  let runsService: IHotelBeachAccessRunsServiceMock;
  let useCase: GetHotelBeachAccessProgressUseCase;

  beforeEach(() => {
    runsService = {
      findActiveRun: jest.fn<Promise<IHotelBeachAccessRun | null>, []>(),
      findLatestRun: jest.fn<Promise<IHotelBeachAccessRun | null>, []>(),
    };
    useCase = new GetHotelBeachAccessProgressUseCase(runsService);
  });

  it('rounds progress down to one decimal place for active runs', async () => {
    runsService.findActiveRun.mockResolvedValue(
      buildRun({
        failed: 2,
        processed: 183,
        skipped: 11,
        status: HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
        total: 701,
      }),
    );

    const result = await useCase.execute();

    expect(result).toMatchObject({
      failed: 2,
      ok: true,
      percent: 27.9,
      processed: 183,
      skipped: 11,
      status: HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
      total: 701,
    });
  });

  it('does not report 100.0 before the run is completed', async () => {
    runsService.findActiveRun.mockResolvedValue(
      buildRun({
        failed: 0,
        processed: 10,
        skipped: 0,
        status: HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
        total: 10,
      }),
    );

    const result = await useCase.execute();

    expect(result.percent).toBe(99.9);
  });

  it('reports 100.0 for completed empty runs', async () => {
    runsService.findActiveRun.mockResolvedValue(null);
    runsService.findLatestRun.mockResolvedValue(
      buildRun({
        failed: 0,
        processed: 0,
        skipped: 0,
        status: HOTEL_BEACH_ACCESS_RUN_STATUS.COMPLETED,
        total: 0,
      }),
    );

    const result = await useCase.execute();

    expect(result.percent).toBe(100);
  });
});

function buildRun(params: {
  status: HOTEL_BEACH_ACCESS_RUN_STATUS;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
}): IHotelBeachAccessRun {
  return {
    activeLock:
      params.status === HOTEL_BEACH_ACCESS_RUN_STATUS.COMPLETED
        ? null
        : 'hotel_beach_access',
    batchSize: 50,
    createdAt: new Date('2026-05-08T09:15:00.000Z'),
    currentBatch: 1,
    error: null,
    finishedAt: null,
    ineligibleHotelsWithoutGeo: 0,
    runId: 'run-1',
    startedAt: new Date('2026-05-08T09:15:01.000Z'),
    stats: {
      failed: params.failed,
      processed: params.processed,
      skipped: params.skipped,
      total: params.total,
    },
    status: params.status,
    updatedAt: new Date('2026-05-08T09:16:00.000Z'),
  };
}
