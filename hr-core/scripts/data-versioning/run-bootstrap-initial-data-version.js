const mongoose = require('mongoose');
const { loadProjectEnv } = require('../utils/load-project-env.js');
const {
  bootstrapInitialDataVersion,
} = require('./bootstrap-initial-data-version.js');

async function main() {
  loadProjectEnv();

  const mongodbUri = process.env.MONGODB_URI;

  if (typeof mongodbUri !== 'string' || mongodbUri.length === 0) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(mongodbUri);

  if (mongoose.connection.db === undefined) {
    throw new Error('MongoDB connection db is unavailable.');
  }

  const report = await bootstrapInitialDataVersion(mongoose.connection.db, {
    now: new Date(),
    releaseKey: process.env.DATA_PUBLICATION_RELEASE_KEY ?? 'initial-v1',
  });

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});

