import { Schema } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { BEACH_ACCESS_POINT_CONFIDENCE } from '../constants/beach-access-point-confidence.enum';
import { BEACH_ACCESS_POINT_SOURCE } from '../constants/beach-access-point-source.enum';
import { BEACH_GEOMETRY_KIND } from '../constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../constants/beach-profile-lifecycle-status.enum';
import { BEACH_PROFILES_COLLECTION_NAME } from '../constants/beach-profiles-collection-name.constant';
import { BEACH_QUALITY_CONFIDENCE } from '../constants/beach-quality-confidence.enum';
import { BEACH_QUALITY_STATUS } from '../constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../constants/beach-type.enum';
import { IBeachProfile } from '../types/beach-profile.interface';

const sourceSchema = new Schema(
  {
    dataset: {
      enum: Object.values(GEO_SOURCE_DATASET),
      required: true,
      type: String,
    },
    id: {
      required: true,
      type: String,
    },
    importRunId: {
      required: true,
      type: Schema.Types.ObjectId,
    },
    type: {
      enum: Object.values(GEO_SOURCE_TYPE),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const pointSchema = new Schema(
  {
    coordinates: {
      required: true,
      type: [Number],
    },
    type: {
      enum: ['Point'],
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const accessPointSchema = new Schema(
  {
    confidence: {
      enum: Object.values(BEACH_ACCESS_POINT_CONFIDENCE),
      required: true,
      type: String,
    },
    createdAt: {
      required: true,
      type: Date,
    },
    label: {
      default: null,
      required: false,
      type: String,
    },
    point: {
      required: true,
      type: pointSchema,
    },
    source: {
      enum: Object.values(BEACH_ACCESS_POINT_SOURCE),
      required: true,
      type: String,
    },
    updatedAt: {
      required: true,
      type: Date,
    },
  },
  {
    _id: false,
  },
);

const geometrySchema = new Schema(
  {
    coordinates: {
      required: true,
      type: Schema.Types.Mixed,
    },
    type: {
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const sourceHashesSchema = new Schema(
  {
    geometryHash: {
      required: true,
      type: String,
    },
    propertiesHash: {
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const qualitySchema = new Schema(
  {
    confidence: {
      enum: Object.values(BEACH_QUALITY_CONFIDENCE),
      required: true,
      type: String,
    },
    reasons: {
      default: [],
      required: true,
      type: [String],
    },
    status: {
      enum: Object.values(BEACH_QUALITY_STATUS),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const lifecycleSchema = new Schema(
  {
    firstSeenAt: {
      required: true,
      type: Date,
    },
    lastSeenAt: {
      required: true,
      type: Date,
    },
    notSeenSince: {
      default: null,
      required: false,
      type: Date,
    },
    status: {
      enum: Object.values(BEACH_PROFILE_LIFECYCLE_STATUS),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

export const beachProfileSchema = new Schema<IBeachProfile>(
  {
    accessPoints: {
      default: [],
      required: true,
      type: [accessPointSchema],
    },
    beachType: {
      enum: Object.values(BEACH_TYPE),
      required: true,
      type: String,
    },
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    datasetVersion: {
      default: 1,
      required: true,
      type: Number,
    },
    geometry: {
      required: true,
      type: geometrySchema,
    },
    geometryKind: {
      enum: Object.values(BEACH_GEOMETRY_KIND),
      required: true,
      type: String,
    },
    lifecycle: {
      required: true,
      type: lifecycleSchema,
    },
    name: {
      default: null,
      required: false,
      type: String,
    },
    normalizedName: {
      default: null,
      required: false,
      type: String,
    },
    point: {
      required: true,
      type: pointSchema,
    },
    quality: {
      required: true,
      type: qualitySchema,
    },
    source: {
      required: true,
      type: sourceSchema,
    },
    sourceHashes: {
      required: true,
      type: sourceHashesSchema,
    },
    sourceProperties: {
      default: (): Record<string, unknown> => ({}),
      required: true,
      type: Schema.Types.Mixed,
    },
    updatedAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
  },
  {
    collection: BEACH_PROFILES_COLLECTION_NAME,
    strict: true,
  },
);

beachProfileSchema.index(
  {
    'source.dataset': 1,
    'source.id': 1,
    'source.type': 1,
  },
  {
    unique: true,
  },
);
beachProfileSchema.index({ point: '2dsphere' });
beachProfileSchema.index({ datasetVersion: 1 });
beachProfileSchema.index({ geometryKind: 1 });
beachProfileSchema.index({ normalizedName: 1 });
beachProfileSchema.index({ 'quality.status': 1, updatedAt: -1 });
