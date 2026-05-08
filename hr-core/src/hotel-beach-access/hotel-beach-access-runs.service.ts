import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HOTEL_BEACH_ACCESS_RUN_MODEL_NAME } from './constants/hotel-beach-access-run-model-name.constant';
import { HOTEL_BEACH_ACCESS_RUN_STATUS } from './constants/hotel-beach-access-run-status.enum';
import { IHotelBeachAccessRun } from './types/hotel-beach-access-run.interface';

@Injectable()
export class HotelBeachAccessRunsService {
  constructor(
    @InjectModel(HOTEL_BEACH_ACCESS_RUN_MODEL_NAME)
    private readonly runModel: Model<IHotelBeachAccessRun>,
  ) {}

  async hasActiveRun(): Promise<boolean> {
    const activeRun = await this.runModel
      .exists({
        status: {
          $in: [
            HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
            HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
          ],
        },
      })
      .exec();

    return activeRun !== null;
  }

  async findActiveRun(): Promise<IHotelBeachAccessRun | null> {
    return this.runModel
      .findOne({
        status: {
          $in: [
            HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
            HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
          ],
        },
      })
      .sort({
        createdAt: -1,
      })
      .exec();
  }

  async findLatestRun(): Promise<IHotelBeachAccessRun | null> {
    return this.runModel
      .findOne({})
      .sort({
        createdAt: -1,
      })
      .exec();
  }

  async findByRunId(runId: string): Promise<IHotelBeachAccessRun | null> {
    return this.runModel
      .findOne({
        runId,
      })
      .exec();
  }

  async createQueuedRun(params: {
    runId: string;
    batchSize: number;
    total: number;
    ineligibleHotelsWithoutGeo: number;
  }): Promise<IHotelBeachAccessRun> {
    const now = new Date();

    return this.runModel.create({
      batchSize: params.batchSize,
      activeLock: 'hotel_beach_access',
      createdAt: now,
      currentBatch: 0,
      error: null,
      finishedAt: null,
      ineligibleHotelsWithoutGeo: params.ineligibleHotelsWithoutGeo,
      runId: params.runId,
      startedAt: null,
      stats: {
        failed: 0,
        processed: 0,
        skipped: 0,
        total: params.total,
      },
      status: HOTEL_BEACH_ACCESS_RUN_STATUS.QUEUED,
      updatedAt: now,
    });
  }

  async markRunning(runId: string, currentBatch: number): Promise<void> {
    await this.runModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            currentBatch,
            startedAt: new Date(),
            status: HOTEL_BEACH_ACCESS_RUN_STATUS.RUNNING,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async incrementStats(
    runId: string,
    params: {
      processed: number;
      failed: number;
      skipped: number;
    },
  ): Promise<void> {
    await this.runModel
      .updateOne(
        {
          runId,
        },
        {
          $inc: {
            'stats.failed': params.failed,
            'stats.processed': params.processed,
            'stats.skipped': params.skipped,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async complete(runId: string): Promise<void> {
    await this.runModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            finishedAt: new Date(),
            activeLock: null,
            status: HOTEL_BEACH_ACCESS_RUN_STATUS.COMPLETED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async fail(runId: string, error: string): Promise<void> {
    await this.runModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            error,
            finishedAt: new Date(),
            activeLock: null,
            status: HOTEL_BEACH_ACCESS_RUN_STATUS.FAILED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }
}
