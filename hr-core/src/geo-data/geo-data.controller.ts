import {
  Controller,
  BadRequestException,
  Body,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { AutoMatchHotelGeoCandidatesUseCase } from '../geo-matching/use-cases/auto-match-hotel-geo-candidates.use-case';
import { ListUnmatchedCanonicalHotelsUseCase } from '../geo-matching/use-cases/list-unmatched-canonical-hotels.use-case';
import type { IAutoMatchHotelGeoCandidatesRequest } from '../geo-matching/types/auto-match-hotel-geo-candidates-request.interface';
import type { IAutoMatchHotelGeoCandidatesResult } from '../geo-matching/types/auto-match-hotel-geo-candidates-result.interface';
import type { IListUnmatchedCanonicalHotelsQuery } from '../geo-matching/types/list-unmatched-canonical-hotels-query.interface';
import type { IListUnmatchedCanonicalHotelsResult } from '../geo-matching/types/list-unmatched-canonical-hotels-result.interface';
import { BeachProfileNotFoundError } from './errors/beach-profile-not-found.error';
import { HotelGeoCandidateNotFoundError } from './errors/hotel-geo-candidate-not-found.error';
import { InvalidNearbyHotelGeoCandidatesQueryError } from './errors/invalid-nearby-hotel-geo-candidates-query.error';
import { IGetBeachProfileResult } from './types/get-beach-profile-result.interface';
import { IGetBeachProfilesStatsResult } from './types/get-beach-profiles-stats-result.interface';
import { IGetHotelGeoCandidateResult } from './types/get-hotel-geo-candidate-result.interface';
import { IGetHotelGeoCandidatesStatsResult } from './types/get-hotel-geo-candidates-stats-result.interface';
import { IListBeachProfilesResult } from './types/list-beach-profiles-result.interface';
import { IListHotelGeoCandidatesResult } from './types/list-hotel-geo-candidates-result.interface';
import { IListNearbyUnmatchedHotelGeoCandidatesResult } from './types/list-nearby-unmatched-hotel-geo-candidates-result.interface';
import { GetBeachProfileUseCase } from './use-cases/get-beach-profile.use-case';
import { GetBeachProfilesStatsUseCase } from './use-cases/get-beach-profiles-stats.use-case';
import { GetHotelGeoCandidateUseCase } from './use-cases/get-hotel-geo-candidate.use-case';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';
import { ListBeachProfilesUseCase } from './use-cases/list-beach-profiles.use-case';
import { ListHotelGeoCandidatesUseCase } from './use-cases/list-hotel-geo-candidates.use-case';
import { ListNearbyUnmatchedHotelGeoCandidatesUseCase } from './use-cases/list-nearby-unmatched-hotel-geo-candidates.use-case';
import type { IListBeachProfilesQuery } from './types/list-beach-profiles-query.interface';
import type { IListHotelGeoCandidatesQuery } from './types/list-hotel-geo-candidates-query.interface';
import type { IListNearbyUnmatchedHotelGeoCandidatesQuery } from './types/list-nearby-unmatched-hotel-geo-candidates-query.interface';

@Controller('geo-data')
export class GeoDataController {
  constructor(
    private readonly autoMatchHotelGeoCandidatesUseCase: AutoMatchHotelGeoCandidatesUseCase,
    private readonly getBeachProfileUseCase: GetBeachProfileUseCase,
    private readonly getBeachProfilesStatsUseCase: GetBeachProfilesStatsUseCase,
    private readonly getHotelGeoCandidateUseCase: GetHotelGeoCandidateUseCase,
    private readonly getHotelGeoCandidatesStatsUseCase: GetHotelGeoCandidatesStatsUseCase,
    private readonly listUnmatchedCanonicalHotelsUseCase: ListUnmatchedCanonicalHotelsUseCase,
    private readonly listBeachProfilesUseCase: ListBeachProfilesUseCase,
    private readonly listHotelGeoCandidatesUseCase: ListHotelGeoCandidatesUseCase,
    private readonly listNearbyUnmatchedHotelGeoCandidatesUseCase: ListNearbyUnmatchedHotelGeoCandidatesUseCase,
  ) {}

  @Post('hotel-candidates/match/auto')
  async autoMatchHotelCandidates(
    @Body() body: IAutoMatchHotelGeoCandidatesRequest = {},
  ): Promise<IAutoMatchHotelGeoCandidatesResult> {
    return this.autoMatchHotelGeoCandidatesUseCase.execute(body);
  }

  @Get('canonical-hotels/without-geo-candidates')
  async listCanonicalHotelsWithoutGeoCandidates(
    @Query() query: IListUnmatchedCanonicalHotelsQuery,
  ): Promise<IListUnmatchedCanonicalHotelsResult> {
    return this.listUnmatchedCanonicalHotelsUseCase.execute(query);
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

  @Get('hotel-candidates/nearby-unmatched')
  async listNearbyUnmatchedHotelCandidates(
    @Query() query: IListNearbyUnmatchedHotelGeoCandidatesQuery,
  ): Promise<IListNearbyUnmatchedHotelGeoCandidatesResult> {
    try {
      return await this.listNearbyUnmatchedHotelGeoCandidatesUseCase.execute(
        query,
      );
    } catch (error) {
      if (error instanceof InvalidNearbyHotelGeoCandidatesQueryError) {
        throw new BadRequestException({
          code: 'INVALID_NEARBY_HOTEL_GEO_CANDIDATES_QUERY',
          field: error.field,
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Get('hotel-candidates/stats')
  async getHotelCandidateStats(): Promise<IGetHotelGeoCandidatesStatsResult> {
    return this.getHotelGeoCandidatesStatsUseCase.execute();
  }

  @Get('hotel-candidates/by-id')
  async getHotelCandidateByQuery(
    @Query('id') id: string | undefined,
  ): Promise<IGetHotelGeoCandidateResult> {
    if (id === undefined || id.trim().length === 0) {
      throw new BadRequestException({
        code: 'HOTEL_GEO_CANDIDATE_ID_REQUIRED',
        message: 'Hotel geo candidate id is required.',
        ok: false,
      });
    }

    return this.getHotelCandidateById(id);
  }

  @Get('hotel-candidates/:id')
  async getHotelCandidate(
    @Param('id') id: string,
  ): Promise<IGetHotelGeoCandidateResult> {
    return this.getHotelCandidateById(id);
  }

  private async getHotelCandidateById(
    id: string,
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
