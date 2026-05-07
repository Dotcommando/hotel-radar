import {
  BadRequestException,
  ConflictException,
  Controller,
  NotFoundException,
  Post,
  Query,
} from '@nestjs/common';
import { CanonicalHotelForGeoMatchNotFoundError } from './errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualGeoConflictError } from './errors/geo-hotel-manual-geo-conflict.error';
import { GeoHotelManualGeoInvalidQueryError } from './errors/geo-hotel-manual-geo-invalid-query.error';
import { GeoHotelManualMatchConflictError } from './errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from './errors/geo-hotel-match-invalid-id.error';
import { HotelGeoCandidateForMatchNotFoundError } from './errors/hotel-geo-candidate-for-match-not-found.error';
import type { IManualMatchHotelGeoCandidateQuery } from './types/manual-match-hotel-geo-candidate-query.interface';
import type { IManualMatchHotelGeoCandidateResult } from './types/manual-match-hotel-geo-candidate-result.interface';
import type { ISetManualCanonicalHotelGeoQuery } from './types/set-manual-canonical-hotel-geo-query.interface';
import type { ISetManualCanonicalHotelGeoResult } from './types/set-manual-canonical-hotel-geo-result.interface';
import { ManualMatchHotelGeoCandidateUseCase } from './use-cases/manual-match-hotel-geo-candidate.use-case';
import { SetManualCanonicalHotelGeoUseCase } from './use-cases/set-manual-canonical-hotel-geo.use-case';

@Controller('geo-matching')
export class GeoMatchingController {
  constructor(
    private readonly manualMatchHotelGeoCandidateUseCase: ManualMatchHotelGeoCandidateUseCase,
    private readonly setManualCanonicalHotelGeoUseCase: SetManualCanonicalHotelGeoUseCase,
  ) {}

  @Post('canonical-hotels/geo/manual')
  async setManualCanonicalHotelGeo(
    @Query() query: ISetManualCanonicalHotelGeoQuery,
  ): Promise<ISetManualCanonicalHotelGeoResult> {
    try {
      return await this.setManualCanonicalHotelGeoUseCase.execute(query);
    } catch (error) {
      if (error instanceof GeoHotelMatchInvalidIdError) {
        throw new BadRequestException({
          code: 'GEO_MATCH_INVALID_ID',
          field: error.field,
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof GeoHotelManualGeoInvalidQueryError) {
        throw new BadRequestException({
          code: 'GEO_MANUAL_GEO_INVALID_QUERY',
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

      if (error instanceof GeoHotelManualGeoConflictError) {
        throw new ConflictException({
          code: 'GEO_MANUAL_GEO_CONFLICT',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

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
