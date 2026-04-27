import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PROMPT_MODEL_NAME } from './constants/prompt-model-name.constant';
import { PROMPT_TYPE } from './constants/prompt-type.enum';
import { PromptsService } from './prompts.service';
import { IPrompt } from './types/prompt.interface';

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface IPromptModelMock {
  findOne: jest.Mock<IExecable<IPrompt | null> & { sort: jest.Mock<IExecable<IPrompt | null>, [Record<string, number>]> }, [Record<string, unknown>]>;
}

describe('PromptsService', () => {
  let service: PromptsService;
  let promptModel: IPromptModelMock;

  const promptFixture: IPrompt = {
    content: 'Prompt text',
    createdAt: new Date('2026-04-21T00:00:00.000Z'),
    type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
    updatedAt: new Date('2026-04-21T00:00:00.000Z'),
    version: 2,
  };

  beforeEach(async () => {
    promptModel = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptsService,
        {
          provide: getModelToken(PROMPT_MODEL_NAME),
          useValue: promptModel,
        },
      ],
    }).compile();

    service = module.get<PromptsService>(PromptsService);
  });

  it('reads latest prompt by type ordered by version and updatedAt', async () => {
    const exec = jest.fn<Promise<IPrompt | null>, []>().mockResolvedValue(promptFixture);
    const sort = jest.fn().mockReturnValue({ exec });

    promptModel.findOne.mockReturnValue({ exec, sort });

    const result = await service.readLatestByType(PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM);

    expect(promptModel.findOne).toHaveBeenCalledWith({
      type: PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
    });
    expect(sort).toHaveBeenCalledWith({
      version: -1,
      updatedAt: -1,
    });
    expect(result).toEqual(promptFixture);
  });
});
