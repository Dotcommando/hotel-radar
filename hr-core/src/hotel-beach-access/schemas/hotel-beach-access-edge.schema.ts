import { Schema } from 'mongoose';
import { HOTEL_BEACH_ACCESS_EDGE_STATUS } from '../constants/hotel-beach-access-edge-status.enum';
import { HOTEL_BEACH_ACCESS_EDGES_COLLECTION_NAME } from '../constants/hotel-beach-access-edges-collection-name.constant';
import { HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE } from '../constants/hotel-beach-access-target-point-source.enum';
import { IHotelBeachAccessEdge } from '../types/hotel-beach-access-edge.interface';

const geoPointSchema = new Schema(
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

const targetPointSchema = new Schema(
  {
    label: {
      default: null,
      required: false,
      type: String,
    },
    point: {
      required: true,
      type: geoPointSchema,
    },
    source: {
      enum: Object.values(HOTEL_BEACH_ACCESS_TARGET_POINT_SOURCE),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const routeSchema = new Schema(
  {
    geometry: {
      default: [],
      required: true,
      type: [geoPointSchema],
    },
    originPoint: {
      required: true,
      type: geoPointSchema,
    },
    targetPoint: {
      required: true,
      type: targetPointSchema,
    },
    walkingDistanceMeters: {
      required: true,
      type: Number,
    },
    walkingDurationSeconds: {
      required: true,
      type: Number,
    },
  },
  {
    _id: false,
  },
);

export const hotelBeachAccessEdgeSchema =
  new Schema<IHotelBeachAccessEdge>(
    {
      algorithmVersion: {
        required: true,
        type: String,
      },
      beachPoint: {
        required: true,
        type: geoPointSchema,
      },
      beachProfileId: {
        required: true,
        type: Schema.Types.ObjectId,
      },
      bestRoute: {
        default: null,
        required: false,
        type: routeSchema,
      },
      canonicalHotelId: {
        required: true,
        type: Schema.Types.ObjectId,
      },
      computedAt: {
        required: true,
        type: Date,
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
      error: {
        default: null,
        required: false,
        type: String,
      },
      hotelPoint: {
        required: true,
        type: geoPointSchema,
      },
      routeAlternatives: {
        default: [],
        required: true,
        type: [routeSchema],
      },
      runId: {
        required: true,
        type: String,
      },
      status: {
        enum: Object.values(HOTEL_BEACH_ACCESS_EDGE_STATUS),
        required: true,
        type: String,
      },
      straightDistanceMeters: {
        required: true,
        type: Number,
      },
      updatedAt: {
        default: (): Date => new Date(),
        required: true,
        type: Date,
      },
      walkingDistanceMeters: {
        default: null,
        required: false,
        type: Number,
      },
      walkingDurationSeconds: {
        default: null,
        required: false,
        type: Number,
      },
    },
    {
      collection: HOTEL_BEACH_ACCESS_EDGES_COLLECTION_NAME,
      strict: true,
    },
  );

hotelBeachAccessEdgeSchema.index(
  {
    beachProfileId: 1,
    canonicalHotelId: 1,
    datasetVersion: 1,
  },
  {
    unique: true,
  },
);
hotelBeachAccessEdgeSchema.index({
  canonicalHotelId: 1,
  walkingDistanceMeters: 1,
});
hotelBeachAccessEdgeSchema.index({
  beachProfileId: 1,
  walkingDistanceMeters: 1,
});
hotelBeachAccessEdgeSchema.index({
  datasetVersion: 1,
});
