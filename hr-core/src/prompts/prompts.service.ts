import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PROMPT_MODEL_NAME } from './constants/prompt-model-name.constant';
import { PROMPT_TYPE } from './constants/prompt-type.enum';
import { IPrompt } from './types/prompt.interface';

@Injectable()
export class PromptsService {
  constructor(
    @InjectModel(PROMPT_MODEL_NAME)
    private readonly promptModel: Model<IPrompt>,
  ) {}

  async readLatestByType(type: PROMPT_TYPE): Promise<IPrompt | null> {
    return this.promptModel.findOne({ type }).sort({
      version: -1,
      updatedAt: -1,
    }).exec();
  }
}
