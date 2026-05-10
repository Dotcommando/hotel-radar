const DATASET_VERSION = 1;
const RELEASE_VERSION = 1;
const RELEASE_STATUS = 'published';

const DATASETS = Object.freeze({
  beachProfiles: {
    collectionName: 'beach_profiles',
    dataset: 'beach_profiles',
  },
  canonicalHotels: {
    collectionName: 'canonical_hotels',
    dataset: 'canonical_hotels',
  },
  hotelBeachAccessEdges: {
    collectionName: 'hotel_beach_access_edges',
    dataset: 'hotel_beach_access_edges',
  },
});

async function markDatasetVersion(collection) {
  return collection.updateMany(
    {
      datasetVersion: {
        $exists: false,
      },
    },
    {
      $set: {
        datasetVersion: DATASET_VERSION,
      },
    },
  );
}

async function countDatasetDocuments(db, collectionName) {
  return db.collection(collectionName).countDocuments({
    datasetVersion: DATASET_VERSION,
  });
}

async function buildCanonicalHotelsMetrics(db) {
  const collection = db.collection(DATASETS.canonicalHotels.collectionName);

  return {
    manuallyChecked: await collection.countDocuments({
      datasetVersion: DATASET_VERSION,
      'verification.status': {
        $ne: 'unreviewed',
      },
    }),
    total: await countDatasetDocuments(
      db,
      DATASETS.canonicalHotels.collectionName,
    ),
    verified: await collection.countDocuments({
      datasetVersion: DATASET_VERSION,
      'verification.status': 'location_verified',
    }),
    withoutGeo: await collection.countDocuments({
      datasetVersion: DATASET_VERSION,
      'geo.point': null,
    }),
  };
}

async function buildBasicMetrics(db, collectionName) {
  return {
    total: await countDatasetDocuments(db, collectionName),
  };
}

async function upsertDatasetVersion(db, params) {
  await db.collection('dataset_versions').replaceOne(
    {
      dataset: params.dataset,
      version: DATASET_VERSION,
    },
    {
      createdAt: params.now,
      dataset: params.dataset,
      metrics: params.metrics,
      publishedAt: params.now,
      sourceRunIds: [],
      status: RELEASE_STATUS,
      version: DATASET_VERSION,
    },
    {
      upsert: true,
    },
  );
}

async function bootstrapInitialDataVersion(db, options = {}) {
  const now = options.now ?? new Date();
  const releaseKey = options.releaseKey ?? 'initial-v1';
  const canonicalHotelsUpdate = await markDatasetVersion(
    db.collection(DATASETS.canonicalHotels.collectionName),
  );
  const beachProfilesUpdate = await markDatasetVersion(
    db.collection(DATASETS.beachProfiles.collectionName),
  );
  const hotelBeachAccessEdgesUpdate = await markDatasetVersion(
    db.collection(DATASETS.hotelBeachAccessEdges.collectionName),
  );
  const canonicalHotelsMetrics = await buildCanonicalHotelsMetrics(db);
  const beachProfilesMetrics = await buildBasicMetrics(
    db,
    DATASETS.beachProfiles.collectionName,
  );
  const hotelBeachAccessEdgesMetrics = await buildBasicMetrics(
    db,
    DATASETS.hotelBeachAccessEdges.collectionName,
  );

  await upsertDatasetVersion(db, {
    dataset: DATASETS.canonicalHotels.dataset,
    metrics: canonicalHotelsMetrics,
    now,
  });
  await upsertDatasetVersion(db, {
    dataset: DATASETS.beachProfiles.dataset,
    metrics: beachProfilesMetrics,
    now,
  });
  await upsertDatasetVersion(db, {
    dataset: DATASETS.hotelBeachAccessEdges.dataset,
    metrics: hotelBeachAccessEdgesMetrics,
    now,
  });

  await db.collection('data_releases').replaceOne(
    {
      version: RELEASE_VERSION,
    },
    {
      components: {
        beachProfiles: {
          datasetVersion: DATASET_VERSION,
        },
        canonicalHotels: {
          datasetVersion: DATASET_VERSION,
        },
        hotelBeachAccessEdges: {
          datasetVersion: DATASET_VERSION,
        },
      },
      createdAt: now,
      key: releaseKey,
      metrics: {
        beaches: beachProfilesMetrics.total,
        hotelBeachEdges: hotelBeachAccessEdgesMetrics.total,
        hotels: canonicalHotelsMetrics.total,
        manuallyCheckedHotels: canonicalHotelsMetrics.manuallyChecked,
        verifiedHotels: canonicalHotelsMetrics.verified,
        hotelsWithoutGeo: canonicalHotelsMetrics.withoutGeo,
      },
      notes: 'Initial public data release from existing hr-core documents.',
      publishedAt: now,
      status: RELEASE_STATUS,
      version: RELEASE_VERSION,
    },
    {
      upsert: true,
    },
  );

  return {
    dataRelease: {
      key: releaseKey,
      version: RELEASE_VERSION,
    },
    datasets: {
      beachProfiles: {
        matched: beachProfilesUpdate.matchedCount,
        modified: beachProfilesUpdate.modifiedCount,
        totalVersionDocuments: beachProfilesMetrics.total,
      },
      canonicalHotels: {
        matched: canonicalHotelsUpdate.matchedCount,
        modified: canonicalHotelsUpdate.modifiedCount,
        totalVersionDocuments: canonicalHotelsMetrics.total,
      },
      hotelBeachAccessEdges: {
        matched: hotelBeachAccessEdgesUpdate.matchedCount,
        modified: hotelBeachAccessEdgesUpdate.modifiedCount,
        totalVersionDocuments: hotelBeachAccessEdgesMetrics.total,
      },
    },
    ok: true,
  };
}

module.exports = {
  bootstrapInitialDataVersion,
};

