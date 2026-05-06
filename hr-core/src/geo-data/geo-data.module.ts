import { Module } from '@nestjs/common';
import { BeachProfilesModule } from '../beach-profiles/beach-profiles.module';
import { GeoMatchingModule } from '../geo-matching/geo-matching.module';
import { HotelGeoCandidatesModule } from '../hotel-geo-candidates/hotel-geo-candidates.module';
import { GeoDataController } from './geo-data.controller';
import { GetBeachProfileUseCase } from './use-cases/get-beach-profile.use-case';
import { GetBeachProfilesStatsUseCase } from './use-cases/get-beach-profiles-stats.use-case';
import { GetHotelGeoCandidateUseCase } from './use-cases/get-hotel-geo-candidate.use-case';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';
import { ListBeachProfilesUseCase } from './use-cases/list-beach-profiles.use-case';
import { ListHotelGeoCandidatesUseCase } from './use-cases/list-hotel-geo-candidates.use-case';
import { ListNearbyUnmatchedHotelGeoCandidatesUseCase } from './use-cases/list-nearby-unmatched-hotel-geo-candidates.use-case';

@Module({
  controllers: [GeoDataController],
  imports: [BeachProfilesModule, GeoMatchingModule, HotelGeoCandidatesModule],
  providers: [
    GetBeachProfileUseCase,
    GetBeachProfilesStatsUseCase,
    GetHotelGeoCandidateUseCase,
    GetHotelGeoCandidatesStatsUseCase,
    ListBeachProfilesUseCase,
    ListHotelGeoCandidatesUseCase,
    ListNearbyUnmatchedHotelGeoCandidatesUseCase,
  ],
})
export class GeoDataModule {}
