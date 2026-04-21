import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { RAW_HOTELS_COLLECTION_NAME } from './constants/raw-hotels-collection-name.constant';
import { rawHotelSchema } from './schemas/raw-hotel.schema';
import { RawHotelsService } from './raw-hotels.service';

@Module({
  exports: [RawHotelsService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: RAW_HOTELS_COLLECTION_NAME,
        name: RAW_HOTEL_MODEL_NAME,
        schema: rawHotelSchema,
      },
    ]),
  ],
  providers: [RawHotelsService],
})
export class RawHotelsModule {}
