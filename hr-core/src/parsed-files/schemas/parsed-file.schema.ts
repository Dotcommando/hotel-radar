import { Schema } from 'mongoose';
import { PARSED_FILES_COLLECTION_NAME } from '../constants/parsed-files-collection-name.constant';
import { IParsedFile } from '../types/parsed-file.interface';

export const parsedFileSchema = new Schema<IParsedFile>(
  {
    filename: {
      required: true,
      type: String,
    },
    parsedAt: {
      required: true,
      type: Date,
    },
    recordsCount: {
      required: true,
      type: Number,
    },
  },
  {
    collection: PARSED_FILES_COLLECTION_NAME,
    strict: true,
  },
);
