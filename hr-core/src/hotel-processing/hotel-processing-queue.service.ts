import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HOTEL_PROCESSING_JOB_NAME } from './constants/hotel-processing-job-name.enum';
import { HOTEL_PROCESSING_QUEUE_NAME } from './constants/hotel-processing-queue.constant';
import { IHotelProcessingBatchJobData } from './types/hotel-processing-batch-job-data.interface';

@Injectable()
export class HotelProcessingQueueService implements OnModuleDestroy {
  private readonly queue: Queue<IHotelProcessingBatchJobData>;

  constructor() {
    this.queue = new Queue<IHotelProcessingBatchJobData>(
      HOTEL_PROCESSING_QUEUE_NAME,
      {
        connection: {
          db: Number(process.env.BULLMQ_REDIS_DB ?? 0),
          host: process.env.BULLMQ_REDIS_HOST ?? '127.0.0.1',
          password: process.env.BULLMQ_REDIS_PASSWORD,
          port: Number(process.env.BULLMQ_REDIS_PORT ?? 6379),
        },
      },
    );
  }

  async addRawToRegistryBatch(
    data: IHotelProcessingBatchJobData,
  ): Promise<void> {
    await this.queue.add(
      HOTEL_PROCESSING_JOB_NAME.RAW_TO_REGISTRY_BATCH,
      data,
      {
        attempts: 3,
        backoff: {
          delay: 5000,
          type: 'fixed',
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
