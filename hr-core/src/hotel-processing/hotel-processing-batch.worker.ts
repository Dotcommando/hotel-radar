import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { HotelProcessingBatchProcessor } from './hotel-processing-batch.processor';
import { HOTEL_PROCESSING_JOB_NAME } from './constants/hotel-processing-job-name.enum';
import { HOTEL_PROCESSING_QUEUE_NAME } from './constants/hotel-processing-queue.constant';
import { IHotelProcessingBatchJobData } from './types/hotel-processing-batch-job-data.interface';

@Injectable()
export class HotelProcessingBatchWorker
  implements OnModuleInit, OnModuleDestroy
{
  private worker: Worker<IHotelProcessingBatchJobData> | null = null;

  constructor(
    private readonly hotelProcessingBatchProcessor: HotelProcessingBatchProcessor,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<IHotelProcessingBatchJobData>(
      HOTEL_PROCESSING_QUEUE_NAME,
      async (job: Job<IHotelProcessingBatchJobData>) => {
        if (
          job.name === String(HOTEL_PROCESSING_JOB_NAME.RAW_TO_REGISTRY_BATCH)
        ) {
          await this.hotelProcessingBatchProcessor.processRawToRegistryBatch(
            job.data,
          );
        }

        if (
          job.name ===
          String(HOTEL_PROCESSING_JOB_NAME.REGISTRY_TO_CANDIDATES_BATCH)
        ) {
          await this.hotelProcessingBatchProcessor.processRegistryToCandidatesBatch(
            job.data,
          );
        }

        if (
          job.name ===
          String(HOTEL_PROCESSING_JOB_NAME.CANDIDATES_TO_CANONICAL_BATCH)
        ) {
          await this.hotelProcessingBatchProcessor.processCandidatesToCanonicalBatch(
            job.data,
          );
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
