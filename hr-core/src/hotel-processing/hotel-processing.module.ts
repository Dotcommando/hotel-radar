import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CanonicalHotelCandidatesModule } from '../canonical-hotel-candidates/canonical-hotel-candidates.module';
import { HotelRegistryEntriesModule } from '../hotel-registry-entries/hotel-registry-entries.module';
import { RawHotelsModule } from '../raw-hotels/raw-hotels.module';
import { HOTEL_PROCESSING_RUN_MODEL_NAME } from './constants/hotel-processing-run-model-name.constant';
import { HOTEL_PROCESSING_RUNS_COLLECTION_NAME } from './constants/hotel-processing-runs-collection-name.constant';
import { HotelProcessingBatchProcessor } from './hotel-processing-batch.processor';
import { HotelProcessingBatchWorker } from './hotel-processing-batch.worker';
import { HotelProcessingController } from './hotel-processing.controller';
import { HotelProcessingQueueService } from './hotel-processing-queue.service';
import { HotelProcessingRunsService } from './hotel-processing-runs.service';
import { hotelProcessingRunSchema } from './schemas/hotel-processing-run.schema';
import { GetHotelProcessingRunUseCase } from './use-cases/get-hotel-processing-run.use-case';
import { RollbackHotelProcessingUseCase } from './use-cases/rollback-hotel-processing.use-case';
import { StartRawToRegistryRunUseCase } from './use-cases/start-raw-to-registry-run.use-case';
import { StartRegistryToCandidatesRunUseCase } from './use-cases/start-registry-to-candidates-run.use-case';

@Module({
  controllers: [HotelProcessingController],
  imports: [
    CanonicalHotelCandidatesModule,
    HotelRegistryEntriesModule,
    RawHotelsModule,
    MongooseModule.forFeature([
      {
        collection: HOTEL_PROCESSING_RUNS_COLLECTION_NAME,
        name: HOTEL_PROCESSING_RUN_MODEL_NAME,
        schema: hotelProcessingRunSchema,
      },
    ]),
  ],
  providers: [
    GetHotelProcessingRunUseCase,
    HotelProcessingBatchProcessor,
    HotelProcessingBatchWorker,
    HotelProcessingQueueService,
    HotelProcessingRunsService,
    RollbackHotelProcessingUseCase,
    StartRawToRegistryRunUseCase,
    StartRegistryToCandidatesRunUseCase,
  ],
  exports: [HotelProcessingRunsService],
})
export class HotelProcessingModule {}
