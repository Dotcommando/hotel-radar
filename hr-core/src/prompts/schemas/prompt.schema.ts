import { Schema } from 'mongoose';
import { PROMPTS_COLLECTION_NAME } from '../constants/prompts-collection-name.constant';
import { IPrompt } from '../types/prompt.interface';

export const promptSchema = new Schema<IPrompt>(
  {
    content: {
      required: true,
      type: String,
    },
    createdAt: {
      required: true,
      type: Date,
    },
    type: {
      required: true,
      type: String,
    },
    updatedAt: {
      required: true,
      type: Date,
    },
    version: {
      required: true,
      type: Number,
    },
  },
  {
    collection: PROMPTS_COLLECTION_NAME,
    strict: true,
  },
);
