import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { HOTEL_BEACH_ACCESS_JOB_NAME } from './constants/hotel-beach-access-job-name.enum';
import { HOTEL_BEACH_ACCESS_QUEUE_NAME } from './constants/hotel-beach-access-queue.constant';
import { HotelBeachAccessBatchProcessor } from './hotel-beach-access-batch.processor';
import { IHotelBeachAccessBatchJobData } from './types/hotel-beach-access-batch-job-data.interface';

@Injectable()
export class HotelBeachAccessBatchWorker
  implements OnModuleInit, OnModuleDestroy
{
  private worker: Worker<IHotelBeachAccessBatchJobData> | null = null;

  constructor(private readonly batchProcessor: HotelBeachAccessBatchProcessor) {}

  onModuleInit(): void {
    this.worker = new Worker<IHotelBeachAccessBatchJobData>(
      HOTEL_BEACH_ACCESS_QUEUE_NAME,
      async (job: Job<IHotelBeachAccessBatchJobData>) => {
        if (job.name === String(HOTEL_BEACH_ACCESS_JOB_NAME.BATCH)) {
          await this.batchProcessor.processBatch(job.data);
        }
      },
      {
        concurrency: 1,
        connection: {
          db: Number(process.env.BULLMQ_REDIS_DB ?? 0),
          host: process.env.BULLMQ_REDIS_HOST ?? '127.0.0.1',
          password: process.env.BULLMQ_REDIS_PASSWORD,
          port: Number(process.env.BULLMQ_REDIS_PORT ?? 6379),
        },
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
