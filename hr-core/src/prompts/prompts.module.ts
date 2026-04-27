import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PROMPT_MODEL_NAME } from './constants/prompt-model-name.constant';
import { PROMPTS_COLLECTION_NAME } from './constants/prompts-collection-name.constant';
import { promptSchema } from './schemas/prompt.schema';
import { PromptsService } from './prompts.service';

@Module({
  exports: [PromptsService],
  imports: [
    MongooseModule.forFeature([
      {
        collection: PROMPTS_COLLECTION_NAME,
        name: PROMPT_MODEL_NAME,
        schema: promptSchema,
      },
    ]),
  ],
  providers: [PromptsService],
})
export class PromptsModule {}
