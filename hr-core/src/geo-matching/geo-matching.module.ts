import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CANONICAL_HOTEL_MODEL_NAME } from '../canonical-hotels/constants/canonical-hotel-model-name.constant';
import { CANONICAL_HOTELS_COLLECTION_NAME } from '../canonical-hotels/constants/canonical-hotels-collection-name.constant';
import { canonicalHotelSchema } from '../canonical-hotels/schemas/canonical-hotel.schema';
import { HOTEL_GEO_CANDIDATE_MODEL_NAME } from '../hotel-geo-candidates/constants/hotel-geo-candidate-model-name.constant';
import { HOTEL_GEO_CANDIDATES_COLLECTION_NAME } from '../hotel-geo-candidates/constants/hotel-geo-candidates-collection-name.constant';
import { hotelGeoCandidateSchema } from '../hotel-geo-candidates/schemas/hotel-geo-candidate.schema';
import { GeoHotelMatchingRepository } from './repositories/geo-hotel-matching.repository';
import { MongooseGeoHotelMatchingRepository } from './repositories/mongoose-geo-hotel-matching.repository';
import { AutoMatchHotelGeoCandidatesUseCase } from './use-cases/auto-match-hotel-geo-candidates.use-case';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        collection: CANONICAL_HOTELS_COLLECTION_NAME,
        name: CANONICAL_HOTEL_MODEL_NAME,
        schema: canonicalHotelSchema,
      },
      {
        collection: HOTEL_GEO_CANDIDATES_COLLECTION_NAME,
        name: HOTEL_GEO_CANDIDATE_MODEL_NAME,
        schema: hotelGeoCandidateSchema,
      },
    ]),
  ],
  providers: [
    AutoMatchHotelGeoCandidatesUseCase,
    {
      provide: GeoHotelMatchingRepository,
      useClass: MongooseGeoHotelMatchingRepository,
    },
  ],
  exports: [AutoMatchHotelGeoCandidatesUseCase],
})
export class GeoMatchingModule {}
