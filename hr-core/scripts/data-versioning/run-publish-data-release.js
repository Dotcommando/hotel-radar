const mongoose = require('mongoose');
const { loadProjectEnv } = require('../utils/load-project-env.js');
const { publishDataRelease } = require('./publish-data-release.js');

function getReleaseVersion() {
  const rawValue = process.env.DATA_PUBLICATION_RELEASE_VERSION;

  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return undefined;
  }

  const releaseVersion = Number(rawValue);

  if (!Number.isInteger(releaseVersion)) {
    throw new Error('DATA_PUBLICATION_RELEASE_VERSION must be an integer.');
  }

  return releaseVersion;
}

async function main() {
  loadProjectEnv();

  const sourceMongodbUri = process.env.MONGODB_URI;
  const targetMongodbUri = process.env.DATA_PUBLICATION_MONGODB_URI;

  if (
    typeof sourceMongodbUri !== 'string' ||
    sourceMongodbUri.length === 0
  ) {
    throw new Error('MONGODB_URI is required.');
  }

  if (
    typeof targetMongodbUri !== 'string' ||
    targetMongodbUri.length === 0
  ) {
    throw new Error('DATA_PUBLICATION_MONGODB_URI is required.');
  }

  const sourceConnection = await mongoose.createConnection(sourceMongodbUri)
    .asPromise();
  const targetConnection = await mongoose.createConnection(targetMongodbUri)
    .asPromise();

  if (sourceConnection.db === undefined) {
    throw new Error('Source MongoDB connection db is unavailable.');
  }

  if (targetConnection.db === undefined) {
    throw new Error('Target MongoDB connection db is unavailable.');
  }

  const report = await publishDataRelease(
    sourceConnection.db,
    targetConnection.db,
    {
      releaseKey: process.env.DATA_PUBLICATION_RELEASE_KEY,
      releaseVersion: getReleaseVersion(),
    },
  );

  console.log(JSON.stringify(report, null, 2));
  await sourceConnection.close();
  await targetConnection.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

