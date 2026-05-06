import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../geo-import-runs/constants/geo-source-type.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from './constants/beach-profile-lifecycle-status.enum';
import { BEACH_PROFILE_MODEL_NAME } from './constants/beach-profile-model-name.constant';
import { BEACH_PROFILE_UPSERT_RESULT } from './constants/beach-profile-upsert-result.enum';
import { BEACH_QUALITY_CONFIDENCE } from './constants/beach-quality-confidence.enum';
import { BEACH_QUALITY_STATUS } from './constants/beach-quality-status.enum';
import { IBeachProfile } from './types/beach-profile.interface';
import { IUpsertOsmOverpassBeachProfile } from './types/upsert-osm-overpass-beach-profile.interface';

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
}
