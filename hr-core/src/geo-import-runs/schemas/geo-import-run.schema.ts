import { Schema } from 'mongoose';
import { GEO_IMPORT_KIND } from '../constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../constants/geo-import-run-status.enum';
import { GEO_IMPORT_RUNS_COLLECTION_NAME } from '../constants/geo-import-runs-collection-name.constant';
import { GEO_SOURCE_DATASET } from '../constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../constants/geo-source-type.enum';
import { IGeoImportRun } from '../types/geo-import-run.interface';

const geoImportRunStatsSchema = new Schema(
  {
    failed: {
      default: 0,
      required: true,
      type: Number,
    },
    inserted: {
      default: 0,
      required: true,
      type: Number,
    },
    markedStale: {
      default: 0,
      required: true,
      type: Number,
    },
    read: {
      default: 0,
      required: true,
      type: Number,
    },
    unchanged: {
      default: 0,
      required: true,
      type: Number,
    },
    updated: {
      default: 0,
      required: true,
      type: Number,
    },
  },
  {
    _id: false,
  },
);

export const geoImportRunSchema = new Schema<IGeoImportRun>(
  {
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    error: {
      default: null,
      required: false,
      type: String,
    },
    fileName: {
      required: true,
      type: String,
    },
    filePath: {
      required: true,
      type: String,
    },
    fileSha256: {
      default: null,
      required: false,
      type: String,
    },
    fileSizeBytes: {
      default: null,
      required: false,
      type: Number,
    },
    finishedAt: {
      default: null,
      required: false,
      type: Date,
    },
    importKind: {
      enum: Object.values(GEO_IMPORT_KIND),
      required: true,
      type: String,
    },
    runId: {
      required: true,
      type: String,
    },
    sourceDataset: {
      enum: Object.values(GEO_SOURCE_DATASET),
      required: true,
      type: String,
    },
    sourceType: {
      enum: Object.values(GEO_SOURCE_TYPE),
      required: true,
      type: String,
    },
    startedAt: {
      required: true,
      type: Date,
    },
    stats: {
      default: (): IGeoImportRun['stats'] => ({
        failed: 0,
        inserted: 0,
        markedStale: 0,
        read: 0,
        unchanged: 0,
        updated: 0,
      }),
      required: true,
      type: geoImportRunStatsSchema,
    },
    status: {
      enum: Object.values(GEO_IMPORT_RUN_STATUS),
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
    collection: GEO_IMPORT_RUNS_COLLECTION_NAME,
    strict: true,
  },
);

geoImportRunSchema.index({ runId: 1 }, { unique: true });
geoImportRunSchema.index({
  importKind: 1,
  sourceDataset: 1,
  sourceType: 1,
  startedAt: -1,
});
geoImportRunSchema.index({
  startedAt: -1,
  status: 1,
});
