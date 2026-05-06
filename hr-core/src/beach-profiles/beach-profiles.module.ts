import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BEACH_PROFILE_MODEL_NAME } from './constants/beach-profile-model-name.constant';
import { BEACH_PROFILES_COLLECTION_NAME } from './constants/beach-profiles-collection-name.constant';
import { BeachProfilesService } from './beach-profiles.service';
import { beachProfileSchema } from './schemas/beach-profile.schema';

@Module({
  exports: [BeachProfilesService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: BEACH_PROFILES_COLLECTION_NAME,
        name: BEACH_PROFILE_MODEL_NAME,
        schema: beachProfileSchema,
      },
    ]),
  ],
  providers: [BeachProfilesService],
})
export class BeachProfilesModule {}
