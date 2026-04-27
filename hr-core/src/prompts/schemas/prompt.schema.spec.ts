import mongoose, { Model } from 'mongoose';
import { promptSchema } from './prompt.schema';
import { IPrompt } from '../types/prompt.interface';

describe('promptSchema', () => {
  const modelName = 'PromptSchemaSpecModel';
  let promptModel: Model<IPrompt>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    promptModel = mongoose.model<IPrompt>(modelName, promptSchema);
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores documents in the prompts collection', () => {
    expect(promptSchema.get('collection')).toBe('prompts');
  });

  it('requires type, version, content, createdAt and updatedAt', async () => {
    const prompt = new promptModel({
      content: 'Prompt text',
      createdAt: new Date('2026-04-21T00:00:00.000Z'),
      type: 'GOV_CY_PDF_PARSE_SYSTEM',
      updatedAt: new Date('2026-04-21T00:00:00.000Z'),
      version: 1,
    });

    await prompt.validate();

    expect(promptSchema.path('type').options.required).toBe(true);
    expect(promptSchema.path('version').options.required).toBe(true);
    expect(promptSchema.path('content').options.required).toBe(true);
    expect(promptSchema.path('createdAt').options.required).toBe(true);
    expect(promptSchema.path('updatedAt').options.required).toBe(true);
  });
});
