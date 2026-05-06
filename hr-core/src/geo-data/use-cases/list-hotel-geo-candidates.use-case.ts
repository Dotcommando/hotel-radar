import { Injectable } from '@nestjs/common';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { IHotelGeoCandidateListFilters } from '../../hotel-geo-candidates/types/hotel-geo-candidate-list-filters.interface';
import { IListHotelGeoCandidatesQuery } from '../types/list-hotel-geo-candidates-query.interface';
import { IListHotelGeoCandidatesResult } from '../types/list-hotel-geo-candidates-result.interface';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListHotelGeoCandidatesUseCase {
  constructor(
    private readonly hotelGeoCandidatesService: HotelGeoCandidatesService,
  ) {}

  async execute(
    query: IListHotelGeoCandidatesQuery,
  ): Promise<IListHotelGeoCandidatesResult> {
    const filters = this.normalizeFilters(query);
    const [total, items] = await Promise.all([
      this.hotelGeoCandidatesService.countByFilters(filters),
      this.hotelGeoCandidatesService.listByFilters(filters),
    ]);

    return {
      items,
      limit: filters.limit,
      offset: filters.offset,
      ok: true,
      total,
    };
  }

  private normalizeFilters(
    query: IListHotelGeoCandidatesQuery,
  ): IHotelGeoCandidateListFilters {
    return {
      lifecycleStatus: query.lifecycleStatus,
      limit: this.normalizeNumber(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
      matchStatus: query.matchStatus,
      offset: this.normalizeNumber(query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
      q: this.normalizeQueryText(query.q),
      sourceDataset: query.sourceDataset,
      sourceType: query.sourceType,
    };
  }

  private normalizeQueryText(value: string | undefined): string | undefined {
    const normalized = value?.trim();

    return normalized === undefined || normalized.length === 0
      ? undefined
      : normalized;
  }

  private normalizeNumber(
    value: string | undefined,
    defaultValue: number,
    min: number,
    max: number,
  ): number {
    if (value === undefined) {
      return defaultValue;
    }

    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }

    return Math.min(Math.max(parsed, min), max);
  }
}
