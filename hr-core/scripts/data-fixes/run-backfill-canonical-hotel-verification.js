const mongoose = require('mongoose');
const {
  applyCanonicalHotelVerificationDataFix,
} = require('./backfill-canonical-hotel-verification.js');

async function main() {
  const mongodbUri = process.env.MONGODB_URI;

  if (typeof mongodbUri !== 'string' || mongodbUri.length === 0) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(mongodbUri);

  if (mongoose.connection.db === undefined) {
    throw new Error('MongoDB connection db is unavailable.');
  }

  const report = await applyCanonicalHotelVerificationDataFix(
    mongoose.connection.db,
    {
      ObjectId: (value) => new mongoose.Types.ObjectId(value),
      now: new Date(),
    },
  );

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
