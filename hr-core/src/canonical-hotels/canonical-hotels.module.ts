import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CANONICAL_HOTEL_MODEL_NAME } from './constants/canonical-hotel-model-name.constant';
import { CANONICAL_HOTELS_COLLECTION_NAME } from './constants/canonical-hotels-collection-name.constant';
import { canonicalHotelSchema } from './schemas/canonical-hotel.schema';
import { CanonicalHotelsService } from './services/canonical-hotels.service';
import { HotelDeclaredWebPresenceService } from './services/hotel-declared-web-presence.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        collection: CANONICAL_HOTELS_COLLECTION_NAME,
        name: CANONICAL_HOTEL_MODEL_NAME,
        schema: canonicalHotelSchema,
      },
    ]),
  ],
  providers: [CanonicalHotelsService, HotelDeclaredWebPresenceService],
  exports: [CanonicalHotelsService],
})
export class CanonicalHotelsModule {}
