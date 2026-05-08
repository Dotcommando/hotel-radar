import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { HOTEL_BEACH_ACCESS_JOB_NAME } from './constants/hotel-beach-access-job-name.enum';
import { HOTEL_BEACH_ACCESS_QUEUE_NAME } from './constants/hotel-beach-access-queue.constant';
import { IHotelBeachAccessBatchJobData } from './types/hotel-beach-access-batch-job-data.interface';

@Injectable()
export class HotelBeachAccessQueueService implements OnModuleDestroy {
  private readonly queue: Queue<IHotelBeachAccessBatchJobData>;

  constructor() {
    this.queue = new Queue<IHotelBeachAccessBatchJobData>(
      HOTEL_BEACH_ACCESS_QUEUE_NAME,
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

  async addBatch(data: IHotelBeachAccessBatchJobData): Promise<void> {
    await this.queue.add(HOTEL_BEACH_ACCESS_JOB_NAME.BATCH, data, {
      attempts: 3,
      backoff: {
        delay: 5000,
        type: 'fixed',
      },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
