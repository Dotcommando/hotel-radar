import { Injectable } from '@nestjs/common';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { IBeachProfileListFilters } from '../../beach-profiles/types/beach-profile-list-filters.interface';
import { IListBeachProfilesQuery } from '../types/list-beach-profiles-query.interface';
import { IListBeachProfilesResult } from '../types/list-beach-profiles-result.interface';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListBeachProfilesUseCase {
  constructor(private readonly beachProfilesService: BeachProfilesService) {}

  async execute(
    query: IListBeachProfilesQuery,
  ): Promise<IListBeachProfilesResult> {
    const filters = this.normalizeFilters(query);
    const [total, items] = await Promise.all([
      this.beachProfilesService.countByFilters(filters),
      this.beachProfilesService.listByFilters(filters),
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
    query: IListBeachProfilesQuery,
  ): IBeachProfileListFilters {
    return {
      geometryKind: query.geometryKind,
      lifecycleStatus: query.lifecycleStatus,
      limit: this.normalizeNumber(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
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
