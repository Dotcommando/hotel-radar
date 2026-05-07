import { Injectable } from '@nestjs/common';
import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IListUnmatchedCanonicalHotelsQuery } from '../types/list-unmatched-canonical-hotels-query.interface';
import {
  IListUnmatchedCanonicalHotelsResult,
  IUnmatchedCanonicalHotelResultItem,
} from '../types/list-unmatched-canonical-hotels-result.interface';
import { IAutoMatchHotelGeoCandidateResultItem } from '../types/auto-match-hotel-geo-candidates-result.interface';
import { AutoMatchHotelGeoCandidatesUseCase } from './auto-match-hotel-geo-candidates.use-case';

@Injectable()
export class ListUnmatchedCanonicalHotelsUseCase {
  constructor(
    private readonly repository: GeoHotelMatchingRepository,
    private readonly autoMatchHotelGeoCandidatesUseCase: AutoMatchHotelGeoCandidatesUseCase,
  ) {}

  async execute(
    query: IListUnmatchedCanonicalHotelsQuery = {},
  ): Promise<IListUnmatchedCanonicalHotelsResult> {
    const limit = this.parsePositiveInteger(query.limit, 50);
    const offset = this.parseNonNegativeInteger(query.offset, 0);
    const suggestionLimit = this.parsePositiveInteger(query.suggestionLimit, 5);
    const includeSuggestions = this.parseBoolean(
      query.includeSuggestions,
      true,
    );
    const [hotels, matchedCanonicalHotelIds] = await Promise.all([
      this.repository.listCanonicalHotelsForGeoMatching(),
      this.repository.listCanonicalHotelIdsWithMergedGeoCandidates(),
    ]);
    const matchedIdSet = new Set(matchedCanonicalHotelIds);
    const unmatchedHotels = hotels.filter(
      (hotel) =>
        hotel.status === CANONICAL_HOTEL_STATUS.ACTIVE &&
        !matchedIdSet.has(hotel._id.toString()),
    );
    const suggestionsByHotelId = includeSuggestions
      ? await this.buildSuggestionsByHotelId()
      : new Map<string, IAutoMatchHotelGeoCandidateResultItem[]>();
    const pagedHotels = unmatchedHotels.slice(offset, offset + limit);

    return {
      items: pagedHotels.map<IUnmatchedCanonicalHotelResultItem>((hotel) => ({
        canonicalHotel: {
          _id: hotel._id.toString(),
          canonicalName: hotel.canonicalName,
          geo: hotel.geo,
          location: hotel.location,
          status: hotel.status,
        },
        suggestions: (
          suggestionsByHotelId.get(hotel._id.toString()) ?? []
        ).slice(0, suggestionLimit),
      })),
      limit,
      offset,
      ok: true,
      total: unmatchedHotels.length,
    };
  }

  private async buildSuggestionsByHotelId(): Promise<
    Map<string, IAutoMatchHotelGeoCandidateResultItem[]>
  > {
    const dryRunResult = await this.autoMatchHotelGeoCandidatesUseCase.execute({
      dryRun: true,
      limit: 0,
    });
    const suggestions = [
      ...dryRunResult.matches,
      ...dryRunResult.reviewSuggestions,
    ];
    const result = new Map<string, IAutoMatchHotelGeoCandidateResultItem[]>();

    for (const suggestion of suggestions) {
      const hotelSuggestions = result.get(suggestion.canonicalHotelId) ?? [];
      hotelSuggestions.push(suggestion);
      hotelSuggestions.sort((left, right) => right.score - left.score);
      result.set(suggestion.canonicalHotelId, hotelSuggestions);
    }

    return result;
  }

  private parseBoolean(
    value: boolean | string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (value === undefined) {
      return defaultValue;
    }

    return value === true || value === 'true';
  }

  private parsePositiveInteger(
    value: number | string | undefined,
    defaultValue: number,
  ): number {
    const parsed = this.parseInteger(value, defaultValue);

    return parsed > 0 ? parsed : defaultValue;
  }

  private parseNonNegativeInteger(
    value: number | string | undefined,
    defaultValue: number,
  ): number {
    const parsed = this.parseInteger(value, defaultValue);

    return parsed >= 0 ? parsed : defaultValue;
  }

  private parseInteger(
    value: number | string | undefined,
    defaultValue: number,
  ): number {
    if (value === undefined || value === '') {
      return defaultValue;
    }

    const parsed =
      typeof value === 'number' ? value : Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
}
