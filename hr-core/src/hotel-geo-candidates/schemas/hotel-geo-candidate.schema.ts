import { Schema } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../constants/hotel-geo-candidate-match-status.enum';
import { HOTEL_GEO_CANDIDATES_COLLECTION_NAME } from '../constants/hotel-geo-candidates-collection-name.constant';
import { IHotelGeoCandidate } from '../types/hotel-geo-candidate.interface';

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
      enum: Object.values(HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

export const hotelGeoCandidateSchema = new Schema<IHotelGeoCandidate>(
  {
    canonicalHotelId: {
      default: null,
      required: false,
      type: Schema.Types.ObjectId,
    },
    componentId: {
      default: null,
      required: false,
      type: String,
    },
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    geometry: {
      required: true,
      type: geometrySchema,
    },
    lifecycle: {
      required: true,
      type: lifecycleSchema,
    },
    matchReasons: {
      default: [],
      required: true,
      type: [String],
    },
    matchStatus: {
      enum: Object.values(HOTEL_GEO_CANDIDATE_MATCH_STATUS),
      required: true,
      type: String,
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
    collection: HOTEL_GEO_CANDIDATES_COLLECTION_NAME,
    strict: true,
  },
);

hotelGeoCandidateSchema.index(
  {
    'source.dataset': 1,
    'source.id': 1,
    'source.type': 1,
  },
  {
    unique: true,
  },
);
hotelGeoCandidateSchema.index({ point: '2dsphere' });
hotelGeoCandidateSchema.index({
  canonicalHotelId: 1,
  componentId: 1,
  matchStatus: 1,
});
hotelGeoCandidateSchema.index({ normalizedName: 1 });
hotelGeoCandidateSchema.index({ matchStatus: 1, updatedAt: -1 });
