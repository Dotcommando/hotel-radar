import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BeachProfilesModule } from '../beach-profiles/beach-profiles.module';
import { CanonicalHotelsModule } from '../canonical-hotels/canonical-hotels.module';
import { DataVersioningModule } from '../data-versioning/data-versioning.module';
import { HOTEL_BEACH_ACCESS_EDGE_MODEL_NAME } from './constants/hotel-beach-access-edge-model-name.constant';
import { HOTEL_BEACH_ACCESS_EDGES_COLLECTION_NAME } from './constants/hotel-beach-access-edges-collection-name.constant';
import { HOTEL_BEACH_ACCESS_RUN_ITEM_MODEL_NAME } from './constants/hotel-beach-access-run-item-model-name.constant';
import { HOTEL_BEACH_ACCESS_RUN_ITEMS_COLLECTION_NAME } from './constants/hotel-beach-access-run-items-collection-name.constant';
import { HOTEL_BEACH_ACCESS_RUN_MODEL_NAME } from './constants/hotel-beach-access-run-model-name.constant';
import { HOTEL_BEACH_ACCESS_RUNS_COLLECTION_NAME } from './constants/hotel-beach-access-runs-collection-name.constant';
import { HotelBeachAccessBatchProcessor } from './hotel-beach-access-batch.processor';
import { HotelBeachAccessBatchWorker } from './hotel-beach-access-batch.worker';
import { HotelBeachAccessController } from './hotel-beach-access.controller';
import { HotelBeachAccessEdgesService } from './hotel-beach-access-edges.service';
import { HotelBeachAccessQueueService } from './hotel-beach-access-queue.service';
import { HotelBeachAccessRunItemsService } from './hotel-beach-access-run-items.service';
import { HotelBeachAccessRunsService } from './hotel-beach-access-runs.service';
import { hotelBeachAccessEdgeSchema } from './schemas/hotel-beach-access-edge.schema';
import { hotelBeachAccessRunItemSchema } from './schemas/hotel-beach-access-run-item.schema';
import { hotelBeachAccessRunSchema } from './schemas/hotel-beach-access-run.schema';
import { BeachRoutingTargetPointService } from './services/beach-routing-target-point.service';
import { GeoDistanceService } from './services/geo-distance.service';
import { StraightLineWalkingRouteProvider } from './services/straight-line-walking-route.provider';
import { GetActiveHotelBeachAccessRunUseCase } from './use-cases/get-active-hotel-beach-access-run.use-case';
import { GetHotelBeachAccessProgressUseCase } from './use-cases/get-hotel-beach-access-progress.use-case';
import { GetHotelBeachAccessRunUseCase } from './use-cases/get-hotel-beach-access-run.use-case';
import { ListBeachHotelsUseCase } from './use-cases/list-beach-hotels.use-case';
import { ListHotelBeachesUseCase } from './use-cases/list-hotel-beaches.use-case';
import { StartHotelBeachAccessRunUseCase } from './use-cases/start-hotel-beach-access-run.use-case';

@Module({
  controllers: [HotelBeachAccessController],
  imports: [
    BeachProfilesModule,
    CanonicalHotelsModule,
    DataVersioningModule,
    MongooseModule.forFeature([
      {
        collection: HOTEL_BEACH_ACCESS_EDGES_COLLECTION_NAME,
        name: HOTEL_BEACH_ACCESS_EDGE_MODEL_NAME,
        schema: hotelBeachAccessEdgeSchema,
      },
      {
        collection: HOTEL_BEACH_ACCESS_RUN_ITEMS_COLLECTION_NAME,
        name: HOTEL_BEACH_ACCESS_RUN_ITEM_MODEL_NAME,
        schema: hotelBeachAccessRunItemSchema,
      },
      {
        collection: HOTEL_BEACH_ACCESS_RUNS_COLLECTION_NAME,
        name: HOTEL_BEACH_ACCESS_RUN_MODEL_NAME,
        schema: hotelBeachAccessRunSchema,
      },
    ]),
  ],
  providers: [
    BeachRoutingTargetPointService,
    GeoDistanceService,
    GetActiveHotelBeachAccessRunUseCase,
    GetHotelBeachAccessProgressUseCase,
    GetHotelBeachAccessRunUseCase,
    HotelBeachAccessBatchProcessor,
    HotelBeachAccessBatchWorker,
    HotelBeachAccessEdgesService,
    HotelBeachAccessQueueService,
    HotelBeachAccessRunItemsService,
    HotelBeachAccessRunsService,
    ListBeachHotelsUseCase,
    ListHotelBeachesUseCase,
    StartHotelBeachAccessRunUseCase,
    StraightLineWalkingRouteProvider,
  ],
})
export class HotelBeachAccessModule {}
