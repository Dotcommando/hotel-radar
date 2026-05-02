import { Schema } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { HOTEL_REGISTRY_ENTRIES_COLLECTION_NAME } from '../constants/hotel-registry-entries-collection-name.constant';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../constants/hotel-registry-entry-status.enum';
import { IHotelRegistryEntry } from '../types/hotel-registry-entry.interface';

const hotelRegistryEntryNameSchema = new Schema(
  {
    baseName: {
      required: true,
      type: String,
    },
    normalized: {
      required: true,
      type: String,
    },
    original: {
      required: true,
      type: String,
    },
    suffix: {
      default: null,
      required: false,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const hotelLocationSchema = new Schema(
  {
    address: {
      default: null,
      required: false,
      type: String,
    },
    district: {
      default: null,
      required: false,
      type: String,
    },
    locality: {
      default: null,
      required: false,
      type: String,
    },
    postcode: {
      default: null,
      required: false,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const hotelCapacitySchema = new Schema(
  {
    beds: {
      default: null,
      required: false,
      type: Number,
    },
    rooms: {
      default: null,
      required: false,
      type: Number,
    },
  },
  {
    _id: false,
  },
);

const hotelContactsSchema = new Schema(
  {
    domains: {
      default: [],
      required: true,
      type: [String],
    },
    emails: {
      default: [],
      required: true,
      type: [String],
    },
    phones: {
      default: [],
      required: true,
      type: [String],
    },
    websites: {
      default: [],
      required: true,
      type: [String],
    },
  },
  {
    _id: false,
  },
);

const hotelRegistryEntryProcessingSchema = new Schema(
  {
    canonicalHotelCandidateId: {
      default: null,
      required: false,
      type: Schema.Types.ObjectId,
    },
    claimedAt: {
      default: null,
      required: false,
      type: Date,
    },
    error: {
      default: null,
      required: false,
      type: String,
    },
    processedAt: {
      default: null,
      required: false,
      type: Date,
    },
    runId: {
      default: null,
      required: false,
      type: String,
    },
    status: {
      default: HOTEL_PROCESSING_STATUS.PENDING,
      enum: Object.values(HOTEL_PROCESSING_STATUS),
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

export const hotelRegistryEntrySchema = new Schema<IHotelRegistryEntry>(
  {
    capacity: {
      required: true,
      type: hotelCapacitySchema,
    },
    contacts: {
      required: true,
      type: hotelContactsSchema,
    },
    createdAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    establishmentType: {
      default: null,
      required: false,
      type: String,
    },
    issues: {
      default: [],
      required: true,
      type: [String],
    },
    location: {
      required: true,
      type: hotelLocationSchema,
    },
    name: {
      required: true,
      type: hotelRegistryEntryNameSchema,
    },
    operator: {
      default: null,
      required: false,
      type: String,
    },
    processing: {
      default: (): Record<string, unknown> => ({}),
      required: true,
      type: hotelRegistryEntryProcessingSchema,
    },
    registryKey: {
      required: true,
      type: String,
    },
    status: {
      enum: Object.values(HOTEL_REGISTRY_ENTRY_STATUS),
      required: true,
      type: String,
    },
    updatedAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
  },
  {
    collection: HOTEL_REGISTRY_ENTRIES_COLLECTION_NAME,
    strict: true,
  },
);

hotelRegistryEntrySchema.index({ registryKey: 1 }, { unique: true });
hotelRegistryEntrySchema.index({ 'processing.status': 1, _id: 1 });
