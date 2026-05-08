import { Injectable } from '@nestjs/common';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IAutoMatchHotelGeoCandidateResultItem } from '../types/auto-match-hotel-geo-candidates-result.interface';
import { IListCanonicalHotelsWithoutGeoQuery } from '../types/list-canonical-hotels-without-geo-query.interface';
import { IListCanonicalHotelsWithoutGeoResult } from '../types/list-canonical-hotels-without-geo-result.interface';
import { IUnmatchedCanonicalHotelResultItem } from '../types/list-unmatched-canonical-hotels-result.interface';
import { isCanonicalHotelEligibleForGeoMatching } from '../utils/canonical-hotel-geo-eligibility.util';
import { AutoMatchHotelGeoCandidatesUseCase } from './auto-match-hotel-geo-candidates.use-case';

@Injectable()
export class ListCanonicalHotelsWithoutGeoUseCase {
  constructor(
    private readonly repository: GeoHotelMatchingRepository,
    private readonly autoMatchHotelGeoCandidatesUseCase: AutoMatchHotelGeoCandidatesUseCase,
  ) {}

  async execute(
    query: IListCanonicalHotelsWithoutGeoQuery = {},
  ): Promise<IListCanonicalHotelsWithoutGeoResult> {
    const limit = this.parsePositiveInteger(query.limit, 50);
    const offset = this.parseNonNegativeInteger(query.offset, 0);
    const suggestionLimit = this.parsePositiveInteger(query.suggestionLimit, 5);
    const includeSuggestions = this.parseBoolean(
      query.includeSuggestions,
      true,
    );
    const hotels = await this.repository.listCanonicalHotelsForGeoMatching();
    const hotelsWithoutGeo = hotels.filter(
      (hotel) =>
        isCanonicalHotelEligibleForGeoMatching(hotel) &&
        hotel.geo.point === null,
    );
    const suggestionsByHotelId = includeSuggestions
      ? await this.buildSuggestionsByHotelId()
      : new Map<string, IAutoMatchHotelGeoCandidateResultItem[]>();
    const pagedHotels = hotelsWithoutGeo.slice(offset, offset + limit);

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
      total: hotelsWithoutGeo.length,
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
