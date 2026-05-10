import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DATASET_VERSION_MODEL_NAME } from './constants/dataset-version-model-name.constant';
import { DATASET_VERSIONS_COLLECTION_NAME } from './constants/dataset-versions-collection-name.constant';
import { DataVersioningService } from './data-versioning.service';
import { datasetVersionSchema } from './schemas/dataset-version.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        collection: DATASET_VERSIONS_COLLECTION_NAME,
        name: DATASET_VERSION_MODEL_NAME,
        schema: datasetVersionSchema,
      },
    ]),
  ],
  providers: [DataVersioningService],
  exports: [DataVersioningService],
})
export class DataVersioningModule {}
