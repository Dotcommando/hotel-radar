import {
  BadRequestException,
  ConflictException,
  Controller,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { CanonicalHotelForGeoMatchNotFoundError } from './errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualMatchConflictError } from './errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from './errors/geo-hotel-match-invalid-id.error';
import { HotelGeoCandidateForMatchNotFoundError } from './errors/hotel-geo-candidate-for-match-not-found.error';
import type { IManualMatchHotelGeoCandidateQuery } from './types/manual-match-hotel-geo-candidate-query.interface';
import type { IManualMatchHotelGeoCandidateResult } from './types/manual-match-hotel-geo-candidate-result.interface';
import { ManualMatchHotelGeoCandidateUseCase } from './use-cases/manual-match-hotel-geo-candidate.use-case';

@Controller('geo-matching')
export class GeoMatchingController {
  constructor(
    private readonly manualMatchHotelGeoCandidateUseCase: ManualMatchHotelGeoCandidateUseCase,
  ) {}

  @Post('hotel-candidates/match/by-id')
  async manualMatchHotelCandidateById(
    @Query() query: IManualMatchHotelGeoCandidateQuery,
  ): Promise<IManualMatchHotelGeoCandidateResult> {
    try {
      return await this.manualMatchHotelGeoCandidateUseCase.execute(query);
    } catch (error) {
      if (error instanceof GeoHotelMatchInvalidIdError) {
        throw new BadRequestException({
          code: 'GEO_MATCH_INVALID_ID',
          field: error.field,
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof CanonicalHotelForGeoMatchNotFoundError) {
        throw new NotFoundException({
          code: 'CANONICAL_HOTEL_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelGeoCandidateForMatchNotFoundError) {
        throw new NotFoundException({
          code: 'HOTEL_GEO_CANDIDATE_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof GeoHotelManualMatchConflictError) {
        throw new ConflictException({
          code: 'GEO_HOTEL_MATCH_CONFLICT',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }
}
