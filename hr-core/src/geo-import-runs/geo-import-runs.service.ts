import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GEO_IMPORT_KIND } from './constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_MODEL_NAME } from './constants/geo-import-run-model-name.constant';
import { GEO_IMPORT_RUN_STATUS } from './constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from './constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from './constants/geo-source-type.enum';
import { IGeoImportRun } from './types/geo-import-run.interface';
import { IGeoImportRunStats } from './types/geo-import-run-stats.interface';

export interface ICreateGeoImportRunParams {
  sourceType: GEO_SOURCE_TYPE;
  sourceDataset: GEO_SOURCE_DATASET;
  importKind: GEO_IMPORT_KIND;
  filePath: string;
  fileName: string;
  fileSizeBytes: number | null;
  fileSha256: string | null;
}

@Injectable()
export class GeoImportRunsService {
  constructor(
    @InjectModel(GEO_IMPORT_RUN_MODEL_NAME)
    private readonly geoImportRunModel: Model<IGeoImportRun>,
  ) {}

  async createRunningRun(
    params: ICreateGeoImportRunParams,
  ): Promise<IGeoImportRun> {
    const now = new Date();

    return this.geoImportRunModel.create({
      _id: new Types.ObjectId(),
      createdAt: now,
      error: null,
      fileName: params.fileName,
      filePath: params.filePath,
      fileSha256: params.fileSha256,
      fileSizeBytes: params.fileSizeBytes,
      finishedAt: null,
      importKind: params.importKind,
      runId: this.makeRunId(now, params.sourceDataset, params.importKind),
      sourceDataset: params.sourceDataset,
      sourceType: params.sourceType,
      startedAt: now,
      stats: this.buildEmptyStats(),
      status: GEO_IMPORT_RUN_STATUS.RUNNING,
      updatedAt: now,
    });
  }

  async findByRunId(runId: string): Promise<IGeoImportRun | null> {
    return this.geoImportRunModel
      .findOne({
        runId,
      })
      .exec();
  }

  async listRecent(limit: number): Promise<IGeoImportRun[]> {
    return this.geoImportRunModel
      .find({})
      .sort({
        startedAt: -1,
      })
      .limit(limit)
      .exec();
  }

  async markCompleted(
    runId: Types.ObjectId,
    stats: IGeoImportRunStats,
  ): Promise<void> {
    await this.geoImportRunModel
      .updateOne(
        {
          _id: runId,
        },
        {
          $set: {
            finishedAt: new Date(),
            stats,
            status: GEO_IMPORT_RUN_STATUS.COMPLETED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async markFailed(
    runId: Types.ObjectId,
    error: string,
    stats: IGeoImportRunStats,
  ): Promise<void> {
    await this.geoImportRunModel
      .updateOne(
        {
          _id: runId,
        },
        {
          $set: {
            error,
            finishedAt: new Date(),
            stats,
            status: GEO_IMPORT_RUN_STATUS.FAILED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  private buildEmptyStats(): IGeoImportRunStats {
    return {
      failed: 0,
      inserted: 0,
      markedStale: 0,
      read: 0,
      unchanged: 0,
      updated: 0,
    };
  }

  private makeRunId(
    date: Date,
    sourceDataset: GEO_SOURCE_DATASET,
    importKind: GEO_IMPORT_KIND,
  ): string {
    return [
      date.toISOString().replace(/\.\d{3}Z$/u, '').replace(/:/g, '-'),
      sourceDataset.toLowerCase().replace(/_/g, '-'),
      importKind.toLowerCase().replace(/_/g, '-'),
    ].join('-');
  }
}
