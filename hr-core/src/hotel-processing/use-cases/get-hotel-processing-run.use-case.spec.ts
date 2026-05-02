import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { HotelProcessingRunNotFoundError } from '../errors/hotel-processing-run-not-found.error';
import { IHotelProcessingRun } from '../types/hotel-processing-run.interface';
import { GetHotelProcessingRunUseCase } from './get-hotel-processing-run.use-case';

interface IHotelProcessingRunsServiceMock {
  findByRunId: jest.Mock<Promise<IHotelProcessingRun | null>, [string]>;
}

describe('GetHotelProcessingRunUseCase', () => {
  let hotelProcessingRunsService: IHotelProcessingRunsServiceMock;
  let useCase: GetHotelProcessingRunUseCase;

  beforeEach(() => {
    hotelProcessingRunsService = {
      findByRunId: jest.fn<Promise<IHotelProcessingRun | null>, [string]>(),
    };
    useCase = new GetHotelProcessingRunUseCase(hotelProcessingRunsService);
  });

  it('returns durable run status', async () => {
    const startedAt = new Date('2026-05-02T18:30:00.000Z');

    hotelProcessingRunsService.findByRunId.mockResolvedValue({
      batchSize: 50,
      createdAt: startedAt,
      currentBatch: 6,
      error: null,
      finishedAt: null,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      startedAt,
      stats: {
        failed: 0,
        ignored: 0,
        processed: 300,
        total: 774,
      },
      status: HOTEL_PROCESSING_RUN_STATUS.RUNNING,
      updatedAt: startedAt,
    });

    await expect(useCase.execute('run-1')).resolves.toEqual({
      batchSize: 50,
      currentBatch: 6,
      error: null,
      finishedAt: null,
      ok: true,
      runId: 'run-1',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      startedAt,
      stats: {
        failed: 0,
        ignored: 0,
        processed: 300,
        total: 774,
      },
      status: HOTEL_PROCESSING_RUN_STATUS.RUNNING,
    });
  });

  it('throws when run is not found', async () => {
    hotelProcessingRunsService.findByRunId.mockResolvedValue(null);

    await expect(useCase.execute('missing-run')).rejects.toBeInstanceOf(
      HotelProcessingRunNotFoundError,
    );
  });
});
