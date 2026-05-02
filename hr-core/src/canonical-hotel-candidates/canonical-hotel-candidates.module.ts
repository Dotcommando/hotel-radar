import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CANONICAL_HOTEL_CANDIDATE_MODEL_NAME } from './constants/canonical-hotel-candidate-model-name.constant';
import { CANONICAL_HOTEL_CANDIDATES_COLLECTION_NAME } from './constants/canonical-hotel-candidates-collection-name.constant';
import { CanonicalHotelCandidatesService } from './canonical-hotel-candidates.service';
import { canonicalHotelCandidateSchema } from './schemas/canonical-hotel-candidate.schema';
import { CanonicalHotelCandidateBuilderService } from './services/canonical-hotel-candidate-builder.service';

@Module({
  exports: [CanonicalHotelCandidatesService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: CANONICAL_HOTEL_CANDIDATES_COLLECTION_NAME,
        name: CANONICAL_HOTEL_CANDIDATE_MODEL_NAME,
        schema: canonicalHotelCandidateSchema,
      },
    ]),
  ],
  providers: [
    CanonicalHotelCandidateBuilderService,
    CanonicalHotelCandidatesService,
  ],
})
export class CanonicalHotelCandidatesModule {}
