import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PARSED_FILE_MODEL_NAME } from './constants/parsed-file-model-name.constant';
import { PARSED_FILES_COLLECTION_NAME } from './constants/parsed-files-collection-name.constant';
import { ParsedFilesService } from './parsed-files.service';
import { parsedFileSchema } from './schemas/parsed-file.schema';

@Module({
  exports: [ParsedFilesService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: PARSED_FILES_COLLECTION_NAME,
        name: PARSED_FILE_MODEL_NAME,
        schema: parsedFileSchema,
      },
    ]),
  ],
  providers: [ParsedFilesService],
})
export class ParsedFilesModule {}
