import { Schema } from 'mongoose';
import { HOTEL_PROCESSING_RUN_STATUS } from '../constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_RUNS_COLLECTION_NAME } from '../constants/hotel-processing-runs-collection-name.constant';
import { HOTEL_PROCESSING_STAGE } from '../constants/hotel-processing-stage.enum';
import { IHotelProcessingRun } from '../types/hotel-processing-run.interface';

const hotelProcessingRunStatsSchema = new Schema(
  {
    failed: {
      default: 0,
      required: true,
      type: Number,
    },
    ignored: {
      default: 0,
      required: true,
      type: Number,
    },
    processed: {
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

export const hotelProcessingRunSchema = new Schema<IHotelProcessingRun>(
  {
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
    runId: {
      required: true,
      type: String,
    },
    stage: {
      enum: Object.values(HOTEL_PROCESSING_STAGE),
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
        ignored: 0,
        processed: 0,
        total: 0,
      }),
      required: true,
      type: hotelProcessingRunStatsSchema,
    },
    status: {
      enum: Object.values(HOTEL_PROCESSING_RUN_STATUS),
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
    collection: HOTEL_PROCESSING_RUNS_COLLECTION_NAME,
    strict: true,
  },
);

hotelProcessingRunSchema.index({ runId: 1 }, { unique: true });
hotelProcessingRunSchema.index(
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
);
