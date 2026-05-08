import { Schema } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTELS_COLLECTION_NAME } from '../constants/canonical-hotels-collection-name.constant';
import { CANONICAL_HOTEL_STATUS } from '../constants/canonical-hotel-status.enum';
import { CANONICAL_HOTEL_VERIFICATION_ISSUE } from '../constants/canonical-hotel-verification-issue.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../constants/canonical-hotel-verification-status.enum';
import { HOTEL_DECLARED_WEBSITE_KIND } from '../constants/hotel-declared-website-kind.enum';
import { HOTEL_WEB_PRESENCE_SOURCE } from '../constants/hotel-web-presence-source.enum';
import { ICanonicalHotel } from '../types/canonical-hotel.interface';

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
    capacity: {
      required: true,
      type: hotelCapacitySchema,
    },
    componentKey: {
      required: true,
      type: String,
    },
    contacts: {
      required: true,
      type: hotelContactsSchema,
    },
    establishmentType: {
      default: null,
      required: false,
      type: String,
    },
    location: {
      required: true,
      type: hotelLocationSchema,
    },
    name: {
      required: true,
      type: String,
    },
    normalizedName: {
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

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

const hotelGeoSchema = new Schema(
  {
    point: {
      default: null,
      required: false,
      type: geoPointSchema,
    },
    source: {
      default: null,
      required: false,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const webPresenceSchema = new Schema(
  {
    declaredWebsiteKind: {
      enum: Object.values(HOTEL_DECLARED_WEBSITE_KIND),
      required: true,
      type: String,
    },
    domains: {
      default: [],
      required: true,
      type: [String],
    },
    hasDeclaredWebsite: {
      required: true,
      type: Boolean,
    },
    issues: {
      default: [],
      required: true,
      type: [String],
    },
    source: {
      enum: Object.values(HOTEL_WEB_PRESENCE_SOURCE),
      required: true,
      type: String,
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

const sourceSchema = new Schema(
  {
    lastCandidateBuildRule: {
      required: true,
      type: String,
    },
    lastCandidateBuildRuleVersion: {
      required: true,
      type: Number,
    },
    lastCandidateKey: {
      required: true,
      type: String,
    },
    lastCandidateSeenAt: {
      required: true,
      type: Date,
    },
    origin: {
      enum: ['gov_registry'],
      required: true,
      type: String,
    },
  },
  {
    _id: false,
  },
);

const verificationSchema = new Schema(
  {
    issues: {
      default: [],
      enum: Object.values(CANONICAL_HOTEL_VERIFICATION_ISSUE),
      required: true,
      type: [String],
    },
    status: {
      default: CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
      enum: Object.values(CANONICAL_HOTEL_VERIFICATION_STATUS),
      required: true,
      type: String,
    },
    updatedAt: {
      default: null,
      required: false,
      type: Date,
    },
  },
  {
    _id: false,
  },
);

export const canonicalHotelSchema = new Schema<ICanonicalHotel>(
  {
    canonicalKey: {
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
    firstSeenAt: {
      required: true,
      type: Date,
    },
    geo: {
      default: (): Record<string, null> => ({
        point: null,
        source: null,
      }),
      required: true,
      type: hotelGeoSchema,
    },
    issues: {
      default: [],
      required: true,
      type: [String],
    },
    kind: {
      enum: Object.values(CANONICAL_HOTEL_KIND),
      required: true,
      type: String,
    },
    lastSeenAt: {
      required: true,
      type: Date,
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
    source: {
      required: true,
      type: sourceSchema,
    },
    status: {
      enum: Object.values(CANONICAL_HOTEL_STATUS),
      required: true,
      type: String,
    },
    updatedAt: {
      default: (): Date => new Date(),
      required: true,
      type: Date,
    },
    verification: {
      default: (): {
        issues: [];
        status: CANONICAL_HOTEL_VERIFICATION_STATUS;
        updatedAt: null;
      } => ({
        issues: [],
        status: CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
        updatedAt: null,
      }),
      required: true,
      type: verificationSchema,
    },
    webPresence: {
      required: true,
      type: webPresenceSchema,
    },
  },
  {
    collection: CANONICAL_HOTELS_COLLECTION_NAME,
    strict: true,
  },
);

canonicalHotelSchema.index({ canonicalKey: 1 }, { unique: true });
canonicalHotelSchema.index({ canonicalName: 1 });
canonicalHotelSchema.index({ kind: 1 });
canonicalHotelSchema.index({ 'location.postcode': 1 });
canonicalHotelSchema.index({ 'location.locality': 1 });
canonicalHotelSchema.index({ 'location.district': 1 });
canonicalHotelSchema.index({ 'contacts.phones': 1 });
canonicalHotelSchema.index({ 'contacts.emails': 1 });
canonicalHotelSchema.index({ 'contacts.domains': 1 });
canonicalHotelSchema.index({ lastSeenAt: 1 });
