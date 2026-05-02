import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HOTEL_REGISTRY_ENTRIES_COLLECTION_NAME } from './constants/hotel-registry-entries-collection-name.constant';
import { HOTEL_REGISTRY_ENTRY_MODEL_NAME } from './constants/hotel-registry-entry-model-name.constant';
import { HotelRegistryEntriesService } from './hotel-registry-entries.service';
import { hotelRegistryEntrySchema } from './schemas/hotel-registry-entry.schema';

@Module({
  exports: [HotelRegistryEntriesService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: HOTEL_REGISTRY_ENTRIES_COLLECTION_NAME,
        name: HOTEL_REGISTRY_ENTRY_MODEL_NAME,
        schema: hotelRegistryEntrySchema,
      },
    ]),
  ],
  providers: [HotelRegistryEntriesService],
})
export class HotelRegistryEntriesModule {}
