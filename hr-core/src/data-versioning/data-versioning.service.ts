import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DATASET_VERSION_MODEL_NAME } from './constants/dataset-version-model-name.constant';
import { DATASET_VERSION_STATUS } from './constants/dataset-version-status.enum';
import { VERSIONED_DATASET } from './constants/versioned-dataset.enum';
import { IDatasetVersion } from './types/dataset-version.interface';

@Injectable()
export class DataVersioningService {
  constructor(
    @InjectModel(DATASET_VERSION_MODEL_NAME)
    private readonly datasetVersionModel: Model<IDatasetVersion>,
  ) {}

  async reserveNextDatasetVersion(params: {
    dataset: VERSIONED_DATASET;
    sourceRunId: string;
  }): Promise<number> {
    const latest = await this.datasetVersionModel
      .findOne({
        dataset: params.dataset,
      })
      .sort({
        version: -1,
      })
      .exec();
    const version = (latest?.version ?? 0) + 1;
    const now = new Date();

    await this.datasetVersionModel.create({
      _id: new Types.ObjectId(),
      createdAt: now,
      dataset: params.dataset,
      metrics: {},
      publishedAt: null,
      sourceRunIds: [params.sourceRunId],
      status: DATASET_VERSION_STATUS.DRAFT,
      version,
    });

    return version;
  }

  async publishDatasetVersion(params: {
    dataset: VERSIONED_DATASET;
    version: number;
    metrics?: Record<string, number>;
  }): Promise<void> {
    await this.datasetVersionModel
      .updateOne(
        {
          dataset: params.dataset,
          version: params.version,
        },
        {
          $set: {
            metrics: params.metrics ?? {},
            publishedAt: new Date(),
            status: DATASET_VERSION_STATUS.PUBLISHED,
          },
        },
      )
      .exec();
  }
}
