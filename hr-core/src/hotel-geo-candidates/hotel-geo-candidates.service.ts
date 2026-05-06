import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from './constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from './constants/hotel-geo-candidate-match-status.enum';
import { HOTEL_GEO_CANDIDATE_MODEL_NAME } from './constants/hotel-geo-candidate-model-name.constant';
import { HOTEL_GEO_CANDIDATE_UPSERT_RESULT } from './constants/hotel-geo-candidate-upsert-result.enum';
import { IHotelGeoCandidate } from './types/hotel-geo-candidate.interface';
import { IHotelGeoCandidateListFilters } from './types/hotel-geo-candidate-list-filters.interface';
import { IHotelGeoCandidateNearbyFilters } from './types/hotel-geo-candidate-nearby-filters.interface';
import { IHotelGeoCandidateWithDistance } from './types/hotel-geo-candidate-with-distance.interface';
import { IHotelGeoCandidatesStats } from './types/hotel-geo-candidates-stats.interface';
import { IUpsertOsmOverpassHotelGeoCandidate } from './types/upsert-osm-overpass-hotel-geo-candidate.interface';

interface IStringCountAggregationResult {
  _id: string | null;
  count: number;
}

@Injectable()
export class HotelGeoCandidatesService {
  constructor(
    @InjectModel(HOTEL_GEO_CANDIDATE_MODEL_NAME)
    private readonly hotelGeoCandidateModel: Model<IHotelGeoCandidate>,
  ) {}

  async upsertFromOsmOverpassFeature(
    params: IUpsertOsmOverpassHotelGeoCandidate,
  ): Promise<HOTEL_GEO_CANDIDATE_UPSERT_RESULT> {
    const now = new Date();
    const filter = {
      'source.dataset': GEO_SOURCE_DATASET.OVERPASS_TURBO,
      'source.id': params.sourceId,
      'source.type': GEO_SOURCE_TYPE.OSM,
    };
    const existing = await this.hotelGeoCandidateModel.findOne(filter).exec();

    if (existing === null) {
      await this.hotelGeoCandidateModel.create({
        _id: new Types.ObjectId(),
        canonicalHotelId: null,
        componentId: null,
        createdAt: now,
        geometry: params.geometry,
        lifecycle: {
          firstSeenAt: now,
          lastSeenAt: now,
          notSeenSince: null,
          status: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
        },
        matchReasons: [],
        matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
        name: params.name,
        normalizedName: params.normalizedName,
        point: params.point,
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

      return HOTEL_GEO_CANDIDATE_UPSERT_RESULT.INSERTED;
    }

    const hashesChanged =
      existing.sourceHashes.geometryHash !== params.geometryHash ||
      existing.sourceHashes.propertiesHash !== params.propertiesHash;
    const updateFields: Partial<IHotelGeoCandidate> = {
      lifecycle: {
        ...existing.lifecycle,
        lastSeenAt: now,
        notSeenSince: null,
        status: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
      },
      source: {
        ...existing.source,
        importRunId: params.importRunId,
      },
      updatedAt: now,
    };

    if (hashesChanged) {
      updateFields.geometry = params.geometry;
      updateFields.name = params.name;
      updateFields.normalizedName = params.normalizedName;
      updateFields.point = params.point;
      updateFields.sourceHashes = {
        geometryHash: params.geometryHash,
        propertiesHash: params.propertiesHash,
      };
      updateFields.sourceProperties = params.sourceProperties;
    }

    await this.hotelGeoCandidateModel
      .updateOne(filter, {
        $set: updateFields,
      })
      .exec();

    return hashesChanged
      ? HOTEL_GEO_CANDIDATE_UPSERT_RESULT.UPDATED
      : HOTEL_GEO_CANDIDATE_UPSERT_RESULT.UNCHANGED;
  }

  async markStaleMissingFromRun(
    importRunId: Types.ObjectId,
    sourceType: GEO_SOURCE_TYPE,
    sourceDataset: GEO_SOURCE_DATASET,
  ): Promise<number> {
    const now = new Date();
    const result = await this.hotelGeoCandidateModel
      .updateMany(
        {
          'lifecycle.status': HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
          'source.dataset': sourceDataset,
          'source.importRunId': {
            $ne: importRunId,
          },
          'source.type': sourceType,
        },
        {
          $set: {
            'lifecycle.notSeenSince': now,
            'lifecycle.status': HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.STALE,
            updatedAt: now,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async findById(id: string): Promise<IHotelGeoCandidate | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return this.hotelGeoCandidateModel
      .findById(new Types.ObjectId(id))
      .exec();
  }

  async countByFilters(
    filters: IHotelGeoCandidateListFilters,
  ): Promise<number> {
    return this.hotelGeoCandidateModel
      .countDocuments(this.buildListFilter(filters))
      .exec();
  }

  async listByFilters(
    filters: IHotelGeoCandidateListFilters,
  ): Promise<IHotelGeoCandidate[]> {
    return this.hotelGeoCandidateModel
      .find(this.buildListFilter(filters))
      .sort({
        updatedAt: -1,
        _id: 1,
      })
      .skip(filters.offset)
      .limit(filters.limit)
      .exec();
  }

  async listNearbyUnmatched(
    filters: IHotelGeoCandidateNearbyFilters,
  ): Promise<IHotelGeoCandidateWithDistance[]> {
    return this.hotelGeoCandidateModel
      .aggregate<IHotelGeoCandidateWithDistance>([
        {
          $geoNear: {
            distanceField: 'distanceMeters',
            key: 'point',
            maxDistance: filters.radiusMeters,
            near: {
              coordinates: [filters.lng, filters.lat],
              type: 'Point',
            },
            query: {
              'lifecycle.status': HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
              matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
            },
            spherical: true,
          },
        },
        {
          $limit: filters.limit,
        },
      ])
      .exec();
  }

  async getStats(): Promise<IHotelGeoCandidatesStats> {
    const [
      total,
      withName,
      withPhone,
      withWebsite,
      byTourismTagRows,
      byLifecycleStatusRows,
      byMatchStatusRows,
    ] = await Promise.all([
      this.hotelGeoCandidateModel.countDocuments({}).exec(),
      this.hotelGeoCandidateModel
        .countDocuments({
          name: {
            $nin: [null, ''],
          },
        })
        .exec(),
      this.hotelGeoCandidateModel
        .countDocuments({
          $or: [
            this.existsNonEmptySourcePropertyFilter('phone'),
            this.existsNonEmptySourcePropertyFilter('contact:phone'),
          ],
        })
        .exec(),
      this.hotelGeoCandidateModel
        .countDocuments({
          $or: [
            this.existsNonEmptySourcePropertyFilter('website'),
            this.existsNonEmptySourcePropertyFilter('contact:website'),
            this.existsNonEmptySourcePropertyFilter('url'),
          ],
        })
        .exec(),
      this.countByField('sourceProperties.tourism'),
      this.countByField('lifecycle.status'),
      this.countByField('matchStatus'),
    ]);

    return {
      byLifecycleStatus: {
        [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE]:
          this.readCount(byLifecycleStatusRows, HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE),
        [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE]:
          this.readCount(
            byLifecycleStatusRows,
            HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE,
          ),
        [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.STALE]:
          this.readCount(byLifecycleStatusRows, HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.STALE),
      },
      byMatchStatus: {
        [HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED]: this.readCount(
          byMatchStatusRows,
          HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED,
        ),
        [HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED]: this.readCount(
          byMatchStatusRows,
          HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
        ),
        [HOTEL_GEO_CANDIDATE_MATCH_STATUS.NEEDS_REVIEW]: this.readCount(
          byMatchStatusRows,
          HOTEL_GEO_CANDIDATE_MATCH_STATUS.NEEDS_REVIEW,
        ),
        [HOTEL_GEO_CANDIDATE_MATCH_STATUS.REJECTED]: this.readCount(
          byMatchStatusRows,
          HOTEL_GEO_CANDIDATE_MATCH_STATUS.REJECTED,
        ),
        [HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED]: this.readCount(
          byMatchStatusRows,
          HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
        ),
      },
      byTourismTag: this.rowsToRecord(byTourismTagRows),
      total,
      withName,
      withPhone,
      withWebsite,
    };
  }

  private async countByField(
    fieldName: string,
  ): Promise<IStringCountAggregationResult[]> {
    return this.hotelGeoCandidateModel
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
    filters: IHotelGeoCandidateListFilters,
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

    if (filters.matchStatus !== undefined) {
      filter.matchStatus = filters.matchStatus;
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

  private existsNonEmptySourcePropertyFilter(
    key: string,
  ): Record<string, unknown> {
    return {
      [`sourceProperties.${key}`]: {
        $exists: true,
        $nin: [null, ''],
      },
    };
  }

  private rowsToRecord(rows: IStringCountAggregationResult[]): Record<string, number> {
    return rows.reduce<Record<string, number>>((result, row) => {
      if (row._id !== null && row._id.trim().length > 0) {
        result[row._id] = row.count;
      }

      return result;
    }, {});
  }

  private readCount(rows: IStringCountAggregationResult[], key: string): number {
    return rows.find((row) => row._id === key)?.count ?? 0;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
