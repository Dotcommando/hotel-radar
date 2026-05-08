import { Schema } from 'mongoose';
import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { HOTEL_BEACH_ACCESS_RUNS_COLLECTION_NAME } from '../constants/hotel-beach-access-runs-collection-name.constant';
import { IHotelBeachAccessRun } from '../types/hotel-beach-access-run.interface';

const runStatsSchema = new Schema(
  {
    failed: {
      default: 0,
      required: true,
      type: Number,
    },
    processed: {
      default: 0,
      required: true,
      type: Number,
    },
    skipped: {
      default: 0,
      required: true,
      type: Number,
    },
    total: {
      default: 0,
      required: true,
      type: Number,
    },
  },
  {
    _id: false,
  },
);

export const hotelBeachAccessRunSchema = new Schema<IHotelBeachAccessRun>(
  {
    activeLock: {
      default: null,
      required: false,
      type: String,
    },
    batchSize: {
      required: true,
      type: Number,
    },
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    currentBatch: {
      default: 0,
      required: true,
      type: Number,
    },
    error: {
      default: null,
      required: false,
      type: String,
    },
    finishedAt: {
      default: null,
      required: false,
      type: Date,
    },
    ineligibleHotelsWithoutGeo: {
      default: 0,
      required: true,
      type: Number,
    },
    runId: {
      required: true,
      type: String,
    },
    startedAt: {
      default: null,
      required: false,
      type: Date,
    },
    stats: {
      default: (): Record<string, number> => ({
        failed: 0,
        processed: 0,
        skipped: 0,
        total: 0,
      }),
      required: true,
      type: runStatsSchema,
    },
    status: {
      enum: Object.values(HOTEL_BEACH_ACCESS_RUN_STATUS),
      required: true,
      type: String,
    },
    updatedAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
  },
  {
    collection: HOTEL_BEACH_ACCESS_RUNS_COLLECTION_NAME,
    strict: true,
  },
);

hotelBeachAccessRunSchema.index({ runId: 1 }, { unique: true });
hotelBeachAccessRunSchema.index(
  { activeLock: 1 },
  {
    partialFilterExpression: {
      activeLock: 'hotel_beach_access',
    },
    unique: true,
  },
);
hotelBeachAccessRunSchema.index({ createdAt: -1 });
