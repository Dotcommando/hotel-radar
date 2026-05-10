import { Types } from 'mongoose';
import { DATASET_VERSION_STATUS } from '../constants/dataset-version-status.enum';
import { VERSIONED_DATASET } from '../constants/versioned-dataset.enum';

export interface IDatasetVersion {
  _id: Types.ObjectId;
  dataset: VERSIONED_DATASET;
  version: number;
  status: DATASET_VERSION_STATUS;
  sourceRunIds: string[];
  metrics: Record<string, number>;
  createdAt: Date;
  publishedAt: Date | null;
}
