import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GEO_IMPORT_RUN_MODEL_NAME } from './constants/geo-import-run-model-name.constant';
import { GEO_IMPORT_RUNS_COLLECTION_NAME } from './constants/geo-import-runs-collection-name.constant';
import { GeoImportRunsService } from './geo-import-runs.service';
import { geoImportRunSchema } from './schemas/geo-import-run.schema';

@Module({
  exports: [GeoImportRunsService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: GEO_IMPORT_RUNS_COLLECTION_NAME,
        name: GEO_IMPORT_RUN_MODEL_NAME,
        schema: geoImportRunSchema,
      },
    ]),
  ],
  providers: [GeoImportRunsService],
})
export class GeoImportRunsModule {}
