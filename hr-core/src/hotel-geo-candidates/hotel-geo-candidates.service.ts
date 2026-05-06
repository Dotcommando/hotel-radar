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
import { IUpsertOsmOverpassHotelGeoCandidate } from './types/upsert-osm-overpass-hotel-geo-candidate.interface';

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
}
