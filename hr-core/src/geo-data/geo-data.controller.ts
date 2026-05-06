import { Controller, Get } from '@nestjs/common';
import { IGetHotelGeoCandidatesStatsResult } from './types/get-hotel-geo-candidates-stats-result.interface';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';

@Controller('geo-data')
export class GeoDataController {
  constructor(
    private readonly getHotelGeoCandidatesStatsUseCase: GetHotelGeoCandidatesStatsUseCase,
  ) {}

  @Get('hotel-candidates/stats')
  async getHotelCandidateStats(): Promise<IGetHotelGeoCandidatesStatsResult> {
    return this.getHotelGeoCandidatesStatsUseCase.execute();
  }
}
