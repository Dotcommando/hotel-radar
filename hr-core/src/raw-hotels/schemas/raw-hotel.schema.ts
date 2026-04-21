import { Schema } from 'mongoose';
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

export const rawHotelSchema = new Schema<IRawHotel>(
  {
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
