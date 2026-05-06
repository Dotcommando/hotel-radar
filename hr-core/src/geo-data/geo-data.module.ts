import { Module } from '@nestjs/common';
import { HotelGeoCandidatesModule } from '../hotel-geo-candidates/hotel-geo-candidates.module';
import { GeoDataController } from './geo-data.controller';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';

@Module({
  controllers: [GeoDataController],
  imports: [HotelGeoCandidatesModule],
  providers: [GetHotelGeoCandidatesStatsUseCase],
})
export class GeoDataModule {}
