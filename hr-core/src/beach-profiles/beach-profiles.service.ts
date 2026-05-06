import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../geo-import-runs/constants/geo-source-type.enum';
import { BEACH_GEOMETRY_KIND } from './constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from './constants/beach-profile-lifecycle-status.enum';
import { BEACH_PROFILE_MODEL_NAME } from './constants/beach-profile-model-name.constant';
import { BEACH_PROFILE_UPSERT_RESULT } from './constants/beach-profile-upsert-result.enum';
import { BEACH_QUALITY_CONFIDENCE } from './constants/beach-quality-confidence.enum';
import { BEACH_QUALITY_STATUS } from './constants/beach-quality-status.enum';
import { BEACH_TYPE } from './constants/beach-type.enum';
import { IBeachProfile } from './types/beach-profile.interface';
import { IBeachProfileListFilters } from './types/beach-profile-list-filters.interface';
import { IBeachProfilesStats } from './types/beach-profiles-stats.interface';
import { IUpsertOsmOverpassBeachProfile } from './types/upsert-osm-overpass-beach-profile.interface';

interface IStringCountAggregationResult {
  _id: string | null;
  count: number;
}

@Injectable()
export class BeachProfilesService {
  constructor(
    @InjectModel(BEACH_PROFILE_MODEL_NAME)
    private readonly beachProfileModel: Model<IBeachProfile>,
  ) {}

  async upsertFromOsmOverpassFeature(
    params: IUpsertOsmOverpassBeachProfile,
  ): Promise<BEACH_PROFILE_UPSERT_RESULT> {
    const now = new Date();
    const filter = {
      'source.dataset': GEO_SOURCE_DATASET.OVERPASS_TURBO,
      'source.id': params.sourceId,
      'source.type': GEO_SOURCE_TYPE.OSM,
    };
    const existing = await this.beachProfileModel.findOne(filter).exec();

    if (existing === null) {
      await this.beachProfileModel.create({
        _id: new Types.ObjectId(),
        beachType: params.beachType,
        createdAt: now,
        geometry: params.geometry,
        geometryKind: params.geometryKind,
        lifecycle: {
          firstSeenAt: now,
          lastSeenAt: now,
          notSeenSince: null,
          status: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
        },
        name: params.name,
        normalizedName: params.normalizedName,
        point: params.point,
        quality: {
          confidence: BEACH_QUALITY_CONFIDENCE.MEDIUM,
          reasons: [],
          status: BEACH_QUALITY_STATUS.RAW,
        },
        source: {
          dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
          id: params.sourceId,
          importRunId: params.importRunId,
          type: GEO_SOURCE_TYPE.OSM,
        },
        sourceHashes: {
          geometryHash: params.geometryHash,
          propertiesHash: params.propertiesHash,
        },
        sourceProperties: params.sourceProperties,
        updatedAt: now,
      });

      return BEACH_PROFILE_UPSERT_RESULT.INSERTED;
    }

    const hashesChanged =
      existing.sourceHashes.geometryHash !== params.geometryHash ||
      existing.sourceHashes.propertiesHash !== params.propertiesHash;
    const updateFields: Partial<IBeachProfile> = {
      lifecycle: {
        ...existing.lifecycle,
        lastSeenAt: now,
        notSeenSince: null,
        status: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
      },
      source: {
        ...existing.source,
        importRunId: params.importRunId,
      },
      updatedAt: now,
    };

    if (hashesChanged) {
      updateFields.beachType = params.beachType;
      updateFields.geometry = params.geometry;
      updateFields.geometryKind = params.geometryKind;
      updateFields.name = params.name;
      updateFields.normalizedName = params.normalizedName;
      updateFields.point = params.point;
      updateFields.sourceHashes = {
        geometryHash: params.geometryHash,
        propertiesHash: params.propertiesHash,
      };
      updateFields.sourceProperties = params.sourceProperties;
    }

    await this.beachProfileModel
      .updateOne(filter, {
        $set: updateFields,
      })
      .exec();

    return hashesChanged
      ? BEACH_PROFILE_UPSERT_RESULT.UPDATED
      : BEACH_PROFILE_UPSERT_RESULT.UNCHANGED;
  }

  async markStaleMissingFromRun(
    importRunId: Types.ObjectId,
    sourceType: GEO_SOURCE_TYPE,
    sourceDataset: GEO_SOURCE_DATASET,
  ): Promise<number> {
    const now = new Date();
    const result = await this.beachProfileModel
      .updateMany(
        {
          'lifecycle.status': BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
          'source.dataset': sourceDataset,
          'source.importRunId': {
            $ne: importRunId,
          },
          'source.type': sourceType,
        },
        {
          $set: {
            'lifecycle.notSeenSince': now,
            'lifecycle.status': BEACH_PROFILE_LIFECYCLE_STATUS.STALE,
            updatedAt: now,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async findById(id: string): Promise<IBeachProfile | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.beachProfileModel.findById(new Types.ObjectId(id)).exec();
  }

  async countByFilters(filters: IBeachProfileListFilters): Promise<number> {
    return this.beachProfileModel
      .countDocuments(this.buildListFilter(filters))
      .exec();
  }

  async listByFilters(
    filters: IBeachProfileListFilters,
  ): Promise<IBeachProfile[]> {
    return this.beachProfileModel
      .find(this.buildListFilter(filters))
      .sort({
        updatedAt: -1,
        _id: 1,
      })
      .skip(filters.offset)
      .limit(filters.limit)
      .exec();
  }

  async getStats(): Promise<IBeachProfilesStats> {
    const [
      total,
      withName,
      byGeometryKindRows,
      byLifecycleStatusRows,
      byQualityStatusRows,
      byBeachTypeRows,
    ] = await Promise.all([
      this.beachProfileModel.countDocuments({}).exec(),
      this.beachProfileModel
        .countDocuments({
          name: {
            $nin: [null, ''],
          },
        })
        .exec(),
      this.countByField('geometryKind'),
      this.countByField('lifecycle.status'),
      this.countByField('quality.status'),
      this.countByField('beachType'),
    ]);

    return {
      byBeachType: {
        [BEACH_TYPE.MIXED]: this.readCount(byBeachTypeRows, BEACH_TYPE.MIXED),
        [BEACH_TYPE.PEBBLE]: this.readCount(byBeachTypeRows, BEACH_TYPE.PEBBLE),
        [BEACH_TYPE.ROCKY]: this.readCount(byBeachTypeRows, BEACH_TYPE.ROCKY),
        [BEACH_TYPE.SAND]: this.readCount(byBeachTypeRows, BEACH_TYPE.SAND),
        [BEACH_TYPE.UNKNOWN]: this.readCount(byBeachTypeRows, BEACH_TYPE.UNKNOWN),
      },
      byGeometryKind: {
        [BEACH_GEOMETRY_KIND.AREA]: this.readCount(
          byGeometryKindRows,
          BEACH_GEOMETRY_KIND.AREA,
        ),
        [BEACH_GEOMETRY_KIND.LINE]: this.readCount(
          byGeometryKindRows,
          BEACH_GEOMETRY_KIND.LINE,
        ),
        [BEACH_GEOMETRY_KIND.POINT]: this.readCount(
          byGeometryKindRows,
          BEACH_GEOMETRY_KIND.POINT,
        ),
      },
      byLifecycleStatus: {
        [BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE]: this.readCount(
          byLifecycleStatusRows,
          BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
        ),
        [BEACH_PROFILE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE]: this.readCount(
          byLifecycleStatusRows,
          BEACH_PROFILE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE,
        ),
        [BEACH_PROFILE_LIFECYCLE_STATUS.STALE]: this.readCount(
          byLifecycleStatusRows,
          BEACH_PROFILE_LIFECYCLE_STATUS.STALE,
        ),
      },
      byQualityStatus: {
        [BEACH_QUALITY_STATUS.NEEDS_REVIEW]: this.readCount(
          byQualityStatusRows,
          BEACH_QUALITY_STATUS.NEEDS_REVIEW,
        ),
        [BEACH_QUALITY_STATUS.NORMALIZED]: this.readCount(
          byQualityStatusRows,
          BEACH_QUALITY_STATUS.NORMALIZED,
        ),
        [BEACH_QUALITY_STATUS.RAW]: this.readCount(
          byQualityStatusRows,
          BEACH_QUALITY_STATUS.RAW,
        ),
        [BEACH_QUALITY_STATUS.VERIFIED]: this.readCount(
          byQualityStatusRows,
          BEACH_QUALITY_STATUS.VERIFIED,
        ),
      },
      total,
      withName,
    };
  }

  private async countByField(
    fieldName: string,
  ): Promise<IStringCountAggregationResult[]> {
    return this.beachProfileModel
      .aggregate<IStringCountAggregationResult>([
        {
          $group: {
            _id: `$${fieldName}`,
            count: {
              $sum: 1,
            },
          },
        },
      ])
      .exec();
  }

  private buildListFilter(
    filters: IBeachProfileListFilters,
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (filters.sourceType !== undefined) {
      filter['source.type'] = filters.sourceType;
    }

    if (filters.sourceDataset !== undefined) {
      filter['source.dataset'] = filters.sourceDataset;
    }

    if (filters.lifecycleStatus !== undefined) {
      filter['lifecycle.status'] = filters.lifecycleStatus;
    }

    if (filters.geometryKind !== undefined) {
      filter.geometryKind = filters.geometryKind;
    }

    if (filters.q !== undefined) {
      filter.$or = [
        {
          name: {
            $options: 'i',
            $regex: this.escapeRegExp(filters.q),
          },
        },
        {
          normalizedName: {
            $options: 'i',
            $regex: this.escapeRegExp(filters.q),
          },
        },
        {
          'source.id': {
            $options: 'i',
            $regex: this.escapeRegExp(filters.q),
          },
        },
      ];
    }

    return filter;
  }

  private readCount(rows: IStringCountAggregationResult[], key: string): number {
    return rows.find((row) => row._id === key)?.count ?? 0;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
