import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { GOV_CY_PDF_PARSING_JOB_NAME } from '../constants/gov-cy-pdf-parsing-job-name.enum';
import { GOV_CY_PDF_PARSING_QUEUE_NAME } from '../constants/gov-cy-pdf-parsing-queue.constant';
import { IGovCyPdfParsingJobData } from '../types/gov-cy-pdf-parsing-job-data.interface';

@Injectable()
export class GovCyPdfParsingQueueService implements OnModuleDestroy {
  private readonly queue: Queue<IGovCyPdfParsingJobData>;

  constructor() {
    this.queue = new Queue<IGovCyPdfParsingJobData>(
      GOV_CY_PDF_PARSING_QUEUE_NAME,
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

  async addParseRun(data: IGovCyPdfParsingJobData): Promise<void> {
    await this.queue.add(GOV_CY_PDF_PARSING_JOB_NAME.PARSE_RUN, data, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
