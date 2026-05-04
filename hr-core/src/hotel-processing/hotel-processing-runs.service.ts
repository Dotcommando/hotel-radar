import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HOTEL_PROCESSING_RUN_MODEL_NAME } from './constants/hotel-processing-run-model-name.constant';
import { HOTEL_PROCESSING_RUN_STATUS } from './constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from './constants/hotel-processing-stage.enum';
import { IHotelProcessingRun } from './types/hotel-processing-run.interface';

@Injectable()
export class HotelProcessingRunsService {
  constructor(
    @InjectModel(HOTEL_PROCESSING_RUN_MODEL_NAME)
    private readonly hotelProcessingRunModel: Model<IHotelProcessingRun>,
  ) {}

  async hasActiveRun(stage: HOTEL_PROCESSING_STAGE): Promise<boolean> {
    const activeRun = await this.hotelProcessingRunModel
      .exists({
        stage,
        status: {
          $in: [
            HOTEL_PROCESSING_RUN_STATUS.QUEUED,
            HOTEL_PROCESSING_RUN_STATUS.RUNNING,
          ],
        },
      })
      .exec();

    return activeRun !== null;
  }

  async createQueuedRun(params: {
    runId: string;
    stage: HOTEL_PROCESSING_STAGE;
    batchSize: number;
    total: number;
  }): Promise<IHotelProcessingRun> {
    const now = new Date();

    return this.hotelProcessingRunModel.create({
      batchSize: params.batchSize,
      createdAt: now,
      currentBatch: 0,
      error: null,
      finishedAt: null,
      runId: params.runId,
      stage: params.stage,
      startedAt: null,
      stats: {
        failed: 0,
        ignored: 0,
        processed: 0,
        total: params.total,
      },
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
      updatedAt: now,
    });
  }

  async findByRunId(runId: string): Promise<IHotelProcessingRun | null> {
    return this.hotelProcessingRunModel
      .findOne({
        runId,
      })
      .exec();
  }

  async markRunning(runId: string, currentBatch: number): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            currentBatch,
            startedAt: new Date(),
            status: HOTEL_PROCESSING_RUN_STATUS.RUNNING,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async incrementProcessed(
    runId: string,
    processed: number,
    failed: number,
  ): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $inc: {
            'stats.failed': failed,
            'stats.processed': processed,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async incrementIgnored(runId: string, ignored: number): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $inc: {
            'stats.ignored': ignored,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async incrementReviewRequired(
    runId: string,
    reviewRequired: number,
  ): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $inc: {
            'stats.reviewRequired': reviewRequired,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async setTotal(runId: string, total: number): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            'stats.total': total,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async complete(runId: string): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            finishedAt: new Date(),
            status: HOTEL_PROCESSING_RUN_STATUS.COMPLETED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }

  async fail(runId: string, error: string): Promise<void> {
    await this.hotelProcessingRunModel
      .updateOne(
        {
          runId,
        },
        {
          $set: {
            error,
            finishedAt: new Date(),
            status: HOTEL_PROCESSING_RUN_STATUS.FAILED,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }
}
