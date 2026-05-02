import { Schema } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { RAW_HOTELS_COLLECTION_NAME } from '../constants/raw-hotels-collection-name.constant';
import { IRawHotel } from '../types/raw-hotel.interface';

const rawHotelContactsSchema = new Schema(
  {
    domain: {
      default: null,
      required: false,
      type: String,
    },
    emails: {
      default: [],
      required: true,
      type: [String],
    },
    faxes: {
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

const rawHotelSourceFileSchema = new Schema(
  {
    filename: {
      required: true,
      type: String,
    },
    localPath: {
      required: true,
      type: String,
    },
    pdfUrl: {
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const rawHotelProcessingSchema = new Schema(
  {
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
    hotelRegistryEntryId: {
      default: null,
      required: false,
      type: Schema.Types.ObjectId,
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

export const rawHotelSchema = new Schema<IRawHotel>(
  {
    addressMergeDedupeKey: {
      required: false,
      type: String,
    },
    address: {
      default: null,
      required: false,
      type: String,
    },
    beds: {
      default: null,
      required: false,
      type: Number,
    },
    classRaw: {
      default: null,
      required: false,
      type: String,
    },
    contacts: {
      required: true,
      type: rawHotelContactsSchema,
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
    licenseStatus: {
      required: true,
      type: String,
    },
    locality: {
      default: null,
      required: false,
      type: String,
    },
    managerName: {
      default: null,
      required: false,
      type: String,
    },
    name: {
      required: true,
      type: String,
    },
    nameMatchKey: {
      required: false,
      type: String,
    },
    nameNormalized: {
      required: true,
      type: String,
    },
    operatorName: {
      default: null,
      required: false,
      type: String,
    },
    postcode: {
      default: null,
      required: false,
      type: String,
    },
    processing: {
      default: (): Record<string, unknown> => ({}),
      required: true,
      type: rawHotelProcessingSchema,
    },
    region: {
      default: null,
      required: false,
      type: String,
    },
    rooms: {
      default: null,
      required: false,
      type: Number,
    },
    sourceFile: {
      required: true,
      type: rawHotelSourceFileSchema,
    },
    stars: {
      default: null,
      required: false,
      type: Number,
    },
    strictHotelDedupeKey: {
      required: false,
      type: String,
    },
    updatedAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
  },
  {
    collection: RAW_HOTELS_COLLECTION_NAME,
    strict: true,
  },
);

rawHotelSchema.index({ 'processing.status': 1, _id: 1 });
rawHotelSchema.index({ 'processing.runId': 1 });
rawHotelSchema.index({ 'processing.claimedAt': 1 });
rawHotelSchema.index({ 'sourceFile.filename': 1, addressMergeDedupeKey: 1 });
