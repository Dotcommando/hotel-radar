import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HOTEL_GEO_CANDIDATE_MODEL_NAME } from './constants/hotel-geo-candidate-model-name.constant';
import { HOTEL_GEO_CANDIDATES_COLLECTION_NAME } from './constants/hotel-geo-candidates-collection-name.constant';
import { HotelGeoCandidatesService } from './hotel-geo-candidates.service';
import { hotelGeoCandidateSchema } from './schemas/hotel-geo-candidate.schema';

@Module({
  exports: [HotelGeoCandidatesService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: HOTEL_GEO_CANDIDATES_COLLECTION_NAME,
        name: HOTEL_GEO_CANDIDATE_MODEL_NAME,
        schema: hotelGeoCandidateSchema,
      },
    ]),
  ],
  providers: [HotelGeoCandidatesService],
})
export class HotelGeoCandidatesModule {}
