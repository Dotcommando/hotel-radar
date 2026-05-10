import { Schema } from 'mongoose';
import { DATASET_VERSION_STATUS } from '../constants/dataset-version-status.enum';
import { DATASET_VERSIONS_COLLECTION_NAME } from '../constants/dataset-versions-collection-name.constant';
import { VERSIONED_DATASET } from '../constants/versioned-dataset.enum';
import { IDatasetVersion } from '../types/dataset-version.interface';

export const datasetVersionSchema = new Schema<IDatasetVersion>(
  {
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    dataset: {
      enum: Object.values(VERSIONED_DATASET),
      required: true,
      type: String,
    },
    metrics: {
      default: (): Record<string, number> => ({}),
      required: true,
      type: Map,
    },
    publishedAt: {
      default: null,
      required: false,
      type: Date,
    },
    sourceRunIds: {
      default: [],
      required: true,
      type: [String],
    },
    status: {
      enum: Object.values(DATASET_VERSION_STATUS),
      required: true,
      type: String,
    },
    version: {
      required: true,
      type: Number,
    },
  },
  {
    collection: DATASET_VERSIONS_COLLECTION_NAME,
    strict: true,
  },
);

datasetVersionSchema.index(
  {
    dataset: 1,
    version: 1,
  },
  {
    unique: true,
  },
);
datasetVersionSchema.index({
  dataset: 1,
  status: 1,
  createdAt: -1,
});
