import mongoose, { Model } from 'mongoose';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { IHotelProcessingRun } from '../types/hotel-processing-run.interface';
import { hotelProcessingRunSchema } from './hotel-processing-run.schema';

describe('hotelProcessingRunSchema', () => {
  const modelName = 'HotelProcessingRunSchemaSpecModel';
  let hotelProcessingRunModel: Model<IHotelProcessingRun>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    hotelProcessingRunModel = mongoose.model<IHotelProcessingRun>(
      modelName,
      hotelProcessingRunSchema,
    );
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores documents in the hotel_processing_runs collection', () => {
    expect(hotelProcessingRunSchema.get('collection')).toBe(
      'hotel_processing_runs',
    );
  });

  it('defines unique runId and active stage indexes', () => {
    expect(hotelProcessingRunSchema.indexes()).toContainEqual([
      { runId: 1 },
      { unique: true },
    ]);
    expect(hotelProcessingRunSchema.indexes()).toContainEqual([
      { stage: 1 },
      {
        partialFilterExpression: {
          status: {
            $in: [
              HOTEL_PROCESSING_RUN_STATUS.QUEUED,
              HOTEL_PROCESSING_RUN_STATUS.RUNNING,
            ],
          },
        },
        unique: true,
      },
    ]);
  });

  it('defaults stats counters to zero', async () => {
    const run = new hotelProcessingRunModel({
      batchSize: 50,
      runId: '2026-05-02T18-30-00-raw-to-registry',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    });

    await run.validate();

    expect(run.stats.failed).toBe(0);
    expect(run.stats.ignored).toBe(0);
    expect(run.stats.processed).toBe(0);
    expect(run.stats.total).toBe(0);
  });
});
