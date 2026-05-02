import { Schema } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_CANDIDATES_COLLECTION_NAME } from '../constants/canonical-hotel-candidates-collection-name.constant';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCandidate } from '../types/canonical-hotel-candidate.interface';

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

const canonicalHotelCapacitySchema = new Schema(
  {
    beds: {
      default: null,
      required: false,
      type: Number,
    },
    mode: {
      enum: Object.values(CANONICAL_HOTEL_CAPACITY_MODE),
      required: true,
      type: String,
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

const canonicalHotelComponentSchema = new Schema(
  {
    beds: {
      default: null,
      required: false,
      type: Number,
    },
    establishmentType: {
      default: null,
      required: false,
      type: String,
    },
    name: {
      required: true,
      type: String,
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

const canonicalHotelCandidateBuildSchema = new Schema(
  {
    issues: {
      default: [],
      required: true,
      type: [String],
    },
    rule: {
      required: true,
      type: String,
    },
    ruleVersion: {
      required: true,
      type: Number,
    },
  },
  {
    _id: false,
  },
);

const canonicalHotelCandidateProcessingSchema = new Schema(
  {
    canonicalHotelId: {
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

export const canonicalHotelCandidateSchema =
  new Schema<ICanonicalHotelCandidate>(
    {
      build: {
        required: true,
        type: canonicalHotelCandidateBuildSchema,
      },
      candidateKey: {
        required: true,
        type: String,
      },
      canonicalName: {
        required: true,
        type: String,
      },
      capacity: {
        required: true,
        type: canonicalHotelCapacitySchema,
      },
      components: {
        required: true,
        type: [canonicalHotelComponentSchema],
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
      kind: {
        enum: Object.values(CANONICAL_HOTEL_KIND),
        required: true,
        type: String,
      },
      location: {
        required: true,
        type: hotelLocationSchema,
      },
      operator: {
        default: null,
        required: false,
        type: String,
      },
      processing: {
        default: (): Record<string, unknown> => ({}),
        required: true,
        type: canonicalHotelCandidateProcessingSchema,
      },
      status: {
        enum: Object.values(CANONICAL_HOTEL_CANDIDATE_STATUS),
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
      collection: CANONICAL_HOTEL_CANDIDATES_COLLECTION_NAME,
      strict: true,
    },
  );

canonicalHotelCandidateSchema.index({ candidateKey: 1 }, { unique: true });
canonicalHotelCandidateSchema.index({ 'processing.status': 1, _id: 1 });
