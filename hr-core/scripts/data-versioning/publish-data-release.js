const PUBLICATION_COLLECTION_NAMES = Object.freeze([
  'canonical_hotels',
  'beach_profiles',
  'hotel_beach_access_edges',
  'dataset_versions',
  'data_releases',
]);

const RELEASE_COMPONENTS = Object.freeze({
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

async function findRelease(db, options) {
  const releases = db.collection('data_releases');

  if (typeof options.releaseKey === 'string' && options.releaseKey.length > 0) {
    return releases.findOne({
      key: options.releaseKey,
    });
  }

  if (typeof options.releaseVersion === 'number') {
    return releases.findOne({
      version: options.releaseVersion,
    });
  }

  const latestReleases = await releases
    .find({
      status: 'published',
    })
    .sort({
      publishedAt: -1,
      version: -1,
    })
    .limit(1)
    .toArray();

  return latestReleases[0] ?? null;
}

function getComponentDatasetVersion(release, componentName) {
  const component = release.components?.[componentName];
  const datasetVersion = component?.datasetVersion;

  if (typeof datasetVersion !== 'number') {
    throw new Error(`Release component ${componentName} has no datasetVersion.`);
  }

  return datasetVersion;
}

async function readDatasetDocuments(sourceDb, collectionName, datasetVersion) {
  return sourceDb
    .collection(collectionName)
    .find({
      datasetVersion,
    })
    .toArray();
}

async function readDatasetVersionDocuments(sourceDb, release) {
  const result = [];

  for (const [componentName, component] of Object.entries(RELEASE_COMPONENTS)) {
    const datasetVersion = getComponentDatasetVersion(release, componentName);
    const datasetVersionDocument = await sourceDb
      .collection('dataset_versions')
      .findOne({
        dataset: component.dataset,
        version: datasetVersion,
      });

    if (datasetVersionDocument !== null) {
      result.push(datasetVersionDocument);
    }
  }

  return result;
}

async function collectionExists(db, name) {
  const collections = await db
    .listCollections({
      name,
    })
    .toArray();

  return collections.length > 0;
}

async function recreateTargetCollection(db, name) {
  if (await collectionExists(db, name)) {
    if (typeof db.dropCollection === 'function') {
      await db.dropCollection(name);
    } else {
      await db.collection(name).drop();
    }
  }

  if (typeof db.createCollection === 'function') {
    return db.createCollection(name);
  }

  return db.collection(name);
}

async function insertDocuments(collection, documents) {
  if (documents.length === 0) {
    return 0;
  }

  const result = await collection.insertMany(documents);

  return result.insertedCount ?? documents.length;
}

async function createPublicationIndexes(targetDb) {
  await targetDb.collection('canonical_hotels').createIndex({
    datasetVersion: 1,
  });
  await targetDb.collection('beach_profiles').createIndex({
    datasetVersion: 1,
  });
  await targetDb.collection('hotel_beach_access_edges').createIndex({
    canonicalHotelId: 1,
    datasetVersion: 1,
  });
  await targetDb.collection('hotel_beach_access_edges').createIndex({
    beachProfileId: 1,
    datasetVersion: 1,
  });
  await targetDb.collection('hotel_beach_access_edges').createIndex(
    {
      canonicalHotelId: 1,
      beachProfileId: 1,
      datasetVersion: 1,
    },
    {
      unique: true,
    },
  );
  await targetDb.collection('hotel_beach_access_edges').createIndex({
    datasetVersion: 1,
  });
  await targetDb.collection('dataset_versions').createIndex({
    dataset: 1,
    version: 1,
  });
  await targetDb.collection('data_releases').createIndex({
    key: 1,
  });
  await targetDb.collection('data_releases').createIndex({
    version: 1,
  });
  await targetDb.collection('data_releases').createIndex({
    publishedAt: -1,
    status: 1,
  });
}

async function publishDataRelease(sourceDb, targetDb, options = {}) {
  const release = await findRelease(sourceDb, options);

  if (release === null) {
    throw new Error('Data release was not found.');
  }

  const canonicalHotelsVersion = getComponentDatasetVersion(
    release,
    'canonicalHotels',
  );
  const beachProfilesVersion = getComponentDatasetVersion(
    release,
    'beachProfiles',
  );
  const hotelBeachAccessEdgesVersion = getComponentDatasetVersion(
    release,
    'hotelBeachAccessEdges',
  );
  const canonicalHotels = await readDatasetDocuments(
    sourceDb,
    RELEASE_COMPONENTS.canonicalHotels.collectionName,
    canonicalHotelsVersion,
  );
  const beachProfiles = await readDatasetDocuments(
    sourceDb,
    RELEASE_COMPONENTS.beachProfiles.collectionName,
    beachProfilesVersion,
  );
  const hotelBeachAccessEdges = await readDatasetDocuments(
    sourceDb,
    RELEASE_COMPONENTS.hotelBeachAccessEdges.collectionName,
    hotelBeachAccessEdgesVersion,
  );
  const datasetVersions = await readDatasetVersionDocuments(sourceDb, release);
  const droppedCollections = [];

  for (const collectionName of PUBLICATION_COLLECTION_NAMES) {
    if (await collectionExists(targetDb, collectionName)) {
      droppedCollections.push(collectionName);
    }

    await recreateTargetCollection(targetDb, collectionName);
  }

  const copiedCanonicalHotels = await insertDocuments(
    targetDb.collection('canonical_hotels'),
    canonicalHotels,
  );
  const copiedBeachProfiles = await insertDocuments(
    targetDb.collection('beach_profiles'),
    beachProfiles,
  );
  const copiedHotelBeachAccessEdges = await insertDocuments(
    targetDb.collection('hotel_beach_access_edges'),
    hotelBeachAccessEdges,
  );
  const copiedDatasetVersions = await insertDocuments(
    targetDb.collection('dataset_versions'),
    datasetVersions,
  );
  const copiedDataReleases = await insertDocuments(
    targetDb.collection('data_releases'),
    [release],
  );

  await createPublicationIndexes(targetDb);

  return {
    copied: {
      beachProfiles: copiedBeachProfiles,
      canonicalHotels: copiedCanonicalHotels,
      dataReleases: copiedDataReleases,
      datasetVersions: copiedDatasetVersions,
      hotelBeachAccessEdges: copiedHotelBeachAccessEdges,
    },
    droppedCollections,
    ok: true,
    release: {
      key: release.key,
      version: release.version,
    },
  };
}

module.exports = {
  publishDataRelease,
};

