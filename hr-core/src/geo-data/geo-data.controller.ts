import {
  Controller,
  Body,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AutoMatchHotelGeoCandidatesUseCase } from '../geo-matching/use-cases/auto-match-hotel-geo-candidates.use-case';
import type { IAutoMatchHotelGeoCandidatesRequest } from '../geo-matching/types/auto-match-hotel-geo-candidates-request.interface';
import type { IAutoMatchHotelGeoCandidatesResult } from '../geo-matching/types/auto-match-hotel-geo-candidates-result.interface';
import { BeachProfileNotFoundError } from './errors/beach-profile-not-found.error';
import { HotelGeoCandidateNotFoundError } from './errors/hotel-geo-candidate-not-found.error';
import { IGetBeachProfileResult } from './types/get-beach-profile-result.interface';
import { IGetBeachProfilesStatsResult } from './types/get-beach-profiles-stats-result.interface';
import { IGetHotelGeoCandidateResult } from './types/get-hotel-geo-candidate-result.interface';
import { IGetHotelGeoCandidatesStatsResult } from './types/get-hotel-geo-candidates-stats-result.interface';
import { IListBeachProfilesResult } from './types/list-beach-profiles-result.interface';
import { IListHotelGeoCandidatesResult } from './types/list-hotel-geo-candidates-result.interface';
import { GetBeachProfileUseCase } from './use-cases/get-beach-profile.use-case';
import { GetBeachProfilesStatsUseCase } from './use-cases/get-beach-profiles-stats.use-case';
import { GetHotelGeoCandidateUseCase } from './use-cases/get-hotel-geo-candidate.use-case';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';
import { ListBeachProfilesUseCase } from './use-cases/list-beach-profiles.use-case';
import { ListHotelGeoCandidatesUseCase } from './use-cases/list-hotel-geo-candidates.use-case';
import type { IListBeachProfilesQuery } from './types/list-beach-profiles-query.interface';
import type { IListHotelGeoCandidatesQuery } from './types/list-hotel-geo-candidates-query.interface';

@Controller('geo-data')
export class GeoDataController {
  constructor(
    private readonly autoMatchHotelGeoCandidatesUseCase: AutoMatchHotelGeoCandidatesUseCase,
    private readonly getBeachProfileUseCase: GetBeachProfileUseCase,
    private readonly getBeachProfilesStatsUseCase: GetBeachProfilesStatsUseCase,
    private readonly getHotelGeoCandidateUseCase: GetHotelGeoCandidateUseCase,
    private readonly getHotelGeoCandidatesStatsUseCase: GetHotelGeoCandidatesStatsUseCase,
    private readonly listBeachProfilesUseCase: ListBeachProfilesUseCase,
    private readonly listHotelGeoCandidatesUseCase: ListHotelGeoCandidatesUseCase,
  ) {}

  @Post('hotel-candidates/match/auto')
  async autoMatchHotelCandidates(
    @Body() body: IAutoMatchHotelGeoCandidatesRequest = {},
  ): Promise<IAutoMatchHotelGeoCandidatesResult> {
    return this.autoMatchHotelGeoCandidatesUseCase.execute(body);
  }

  @Get('beaches')
  async listBeaches(
    @Query() query: IListBeachProfilesQuery,
  ): Promise<IListBeachProfilesResult> {
    return this.listBeachProfilesUseCase.execute(query);
  }

  @Get('beaches/stats')
  async getBeachStats(): Promise<IGetBeachProfilesStatsResult> {
    return this.getBeachProfilesStatsUseCase.execute();
  }

  @Get('beaches/:id')
  async getBeach(@Param('id') id: string): Promise<IGetBeachProfileResult> {
    try {
      return await this.getBeachProfileUseCase.execute(id);
    } catch (error) {
      if (error instanceof BeachProfileNotFoundError) {
        throw new NotFoundException({
          code: 'BEACH_PROFILE_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Get('hotel-candidates')
  async listHotelCandidates(
    @Query() query: IListHotelGeoCandidatesQuery,
  ): Promise<IListHotelGeoCandidatesResult> {
    return this.listHotelGeoCandidatesUseCase.execute(query);
  }

  @Get('hotel-candidates/stats')
  async getHotelCandidateStats(): Promise<IGetHotelGeoCandidatesStatsResult> {
    return this.getHotelGeoCandidatesStatsUseCase.execute();
  }

  @Get('hotel-candidates/:id')
  async getHotelCandidate(
    @Param('id') id: string,
  ): Promise<IGetHotelGeoCandidateResult> {
    try {
      return await this.getHotelGeoCandidateUseCase.execute(id);
    } catch (error) {
      if (error instanceof HotelGeoCandidateNotFoundError) {
        throw new NotFoundException({
          code: 'HOTEL_GEO_CANDIDATE_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }
}
