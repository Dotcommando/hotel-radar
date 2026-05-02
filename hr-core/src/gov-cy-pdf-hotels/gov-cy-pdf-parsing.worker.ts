import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { GOV_CY_PDF_PARSING_JOB_NAME } from './constants/gov-cy-pdf-parsing-job-name.enum';
import { GOV_CY_PDF_PARSING_QUEUE_NAME } from './constants/gov-cy-pdf-parsing-queue.constant';
import { GovCyPdfParsingProcessor } from './gov-cy-pdf-parsing.processor';
import { IGovCyPdfParsingJobData } from './types/gov-cy-pdf-parsing-job-data.interface';

@Injectable()
export class GovCyPdfParsingWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<IGovCyPdfParsingJobData> | null = null;

  constructor(
    private readonly govCyPdfParsingProcessor: GovCyPdfParsingProcessor,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<IGovCyPdfParsingJobData>(
      GOV_CY_PDF_PARSING_QUEUE_NAME,
      async (job: Job<IGovCyPdfParsingJobData>) => {
        if (job.name === String(GOV_CY_PDF_PARSING_JOB_NAME.PARSE_RUN)) {
          await this.govCyPdfParsingProcessor.processParseRun(job.data);
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
