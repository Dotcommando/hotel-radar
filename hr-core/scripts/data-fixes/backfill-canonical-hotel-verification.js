const CANONICAL_HOTEL_VERIFICATION_STATUS = Object.freeze({
  LOCATION_UNVERIFIED: 'location_unverified',
  LOCATION_VERIFIED: 'location_verified',
  UNREVIEWED: 'unreviewed',
});

const CANONICAL_HOTEL_VERIFICATION_ISSUE = Object.freeze({
  EMAIL_NO_RESPONSE: 'email_no_response',
  GOOGLE_MAPS_NOT_FOUND: 'google_maps_not_found',
  NO_EMAIL_FOR_VERIFICATION: 'no_email_for_verification',
});

const CANONICAL_HOTEL_GEO_SOURCE = Object.freeze({
  MANUAL: 'manual',
});

const HOTEL_GEO_CANDIDATE_MATCH_STATUS = Object.freeze({
  CONFIRMED: 'CONFIRMED',
});

const TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID =
  '69f8842f878f7fca1f7e0aa0';
const TARGET_LOCATION_UNVERIFIED_ISSUES = [
  CANONICAL_HOTEL_VERIFICATION_ISSUE.GOOGLE_MAPS_NOT_FOUND,
  CANONICAL_HOTEL_VERIFICATION_ISSUE.EMAIL_NO_RESPONSE,
];
const DEFERRED_LOCATION_UNVERIFIED_CANONICAL_HOTEL_IDS = [
  '69f88431878f7fca1f7e0b86',
  '69f88431878f7fca1f7e0b7e',
  '69f88431878f7fca1f7e0b7c',
  '69f88431878f7fca1f7e0b78',
  '69f88431878f7fca1f7e0b76',
];
const DEFERRED_LOCATION_UNVERIFIED_ISSUES = [
  CANONICAL_HOTEL_VERIFICATION_ISSUE.GOOGLE_MAPS_NOT_FOUND,
  CANONICAL_HOTEL_VERIFICATION_ISSUE.NO_EMAIL_FOR_VERIFICATION,
];

async function applyCanonicalHotelVerificationDataFix(db, options) {
  const now = options.now ?? new Date();
  const canonicalHotels = db.collection('canonical_hotels');
  const hotelGeoCandidates = db.collection('hotel_geo_candidates');
  const missingBackfillResult = await canonicalHotels.updateMany(
    {
      'verification.status': {
        $exists: false,
      },
    },
    {
      $set: {
        'verification.issues': [],
        'verification.status': CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
        'verification.updatedAt': null,
      },
    },
  );
  const manualGeoResult = await canonicalHotels.updateMany(
    {
      'geo.source': CANONICAL_HOTEL_GEO_SOURCE.MANUAL,
      $or: [
        {
          'verification.status': {
            $ne: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
          },
        },
        {
          'verification.issues': {
            $ne: [],
          },
        },
      ],
    },
    {
      $set: {
        'verification.issues': [],
        'verification.status':
          CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
        'verification.updatedAt': now,
      },
    },
  );
  const confirmedCanonicalHotelIds = await hotelGeoCandidates.distinct(
    'canonicalHotelId',
    {
      canonicalHotelId: {
        $ne: null,
      },
      matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED,
    },
  );
  const confirmedManualMatchResult =
    confirmedCanonicalHotelIds.length === 0
      ? {
          matchedCount: 0,
          modifiedCount: 0,
        }
      : await canonicalHotels.updateMany(
          {
            _id: {
              $in: confirmedCanonicalHotelIds,
            },
            $or: [
              {
                'verification.status': {
                  $ne: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
                },
              },
              {
                'verification.issues': {
                  $ne: [],
                },
              },
            ],
          },
          {
            $set: {
              'verification.issues': [],
              'verification.status':
                CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_VERIFIED,
              'verification.updatedAt': now,
            },
          },
        );
  const targetResult = await canonicalHotels.updateOne(
    {
      _id: options.ObjectId(TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID),
      $or: [
        {
          'verification.status': {
            $ne: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
          },
        },
        {
          'verification.issues': {
            $ne: TARGET_LOCATION_UNVERIFIED_ISSUES,
          },
        },
      ],
    },
    {
      $set: {
        'verification.issues': TARGET_LOCATION_UNVERIFIED_ISSUES,
        'verification.status':
          CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
        'verification.updatedAt': now,
      },
    },
  );
  const deferredTargetIds = DEFERRED_LOCATION_UNVERIFIED_CANONICAL_HOTEL_IDS.map(
    (id) => options.ObjectId(id),
  );
  const deferredTargetsResult = await canonicalHotels.updateMany(
    {
      _id: {
        $in: deferredTargetIds,
      },
      $or: [
        {
          'verification.status': {
            $ne: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
          },
        },
        {
          'verification.issues': {
            $ne: DEFERRED_LOCATION_UNVERIFIED_ISSUES,
          },
        },
      ],
    },
    {
      $set: {
        'verification.issues': DEFERRED_LOCATION_UNVERIFIED_ISSUES,
        'verification.status':
          CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
        'verification.updatedAt': now,
      },
    },
  );

  return {
    canonicalHotels: {
      confirmedManualMatchMatched: confirmedManualMatchResult.matchedCount,
      confirmedManualMatchModified: confirmedManualMatchResult.modifiedCount,
      deferredTargetsMatched: deferredTargetsResult.matchedCount,
      deferredTargetsModified: deferredTargetsResult.modifiedCount,
      manualGeoMatched: manualGeoResult.matchedCount,
      manualGeoModified: manualGeoResult.modifiedCount,
      missingBackfillMatched: missingBackfillResult.matchedCount,
      missingBackfillModified: missingBackfillResult.modifiedCount,
      targetMatched: targetResult.matchedCount,
      targetModified: targetResult.modifiedCount,
    },
    ok: true,
  };
}

module.exports = {
  applyCanonicalHotelVerificationDataFix,
  CANONICAL_HOTEL_GEO_SOURCE,
  CANONICAL_HOTEL_VERIFICATION_ISSUE,
  CANONICAL_HOTEL_VERIFICATION_STATUS,
  DEFERRED_LOCATION_UNVERIFIED_CANONICAL_HOTEL_IDS,
  DEFERRED_LOCATION_UNVERIFIED_ISSUES,
  HOTEL_GEO_CANDIDATE_MATCH_STATUS,
  TARGET_LOCATION_UNVERIFIED_CANONICAL_HOTEL_ID,
};
