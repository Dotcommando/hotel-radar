import { Test, TestingModule } from '@nestjs/testing';
import { GovCyPdfHotelsController } from './gov-cy-pdf-hotels.controller';
import { RunGovCyPdfParsingUseCase } from './use-cases/run-gov-cy-pdf-parsing.use-case';
import { IGovCyPdfParsingResult } from './types/gov-cy-pdf-parsing-result.interface';

describe('GovCyPdfHotelsController', () => {
  let controller: GovCyPdfHotelsController;
  let runGovCyPdfParsingUseCase: {
    execute: jest.Mock<Promise<IGovCyPdfParsingResult>, []>;
  };

  const parsingResultFixture: IGovCyPdfParsingResult = {
    files: [
      {
        filename: 'HOTELS_POLIS_8.4.2026.pdf',
        recordsCount: 28,
      },
    ],
  };

  beforeEach(async () => {
    runGovCyPdfParsingUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GovCyPdfHotelsController],
      providers: [
        {
          provide: RunGovCyPdfParsingUseCase,
          useValue: runGovCyPdfParsingUseCase,
        },
      ],
    }).compile();

    controller = module.get<GovCyPdfHotelsController>(GovCyPdfHotelsController);
  });

  it('runs gov cy pdf parsing via post endpoint', async () => {
    runGovCyPdfParsingUseCase.execute.mockResolvedValue(parsingResultFixture);

    const result = await controller.parseGovCyPdfHotels();

    expect(runGovCyPdfParsingUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual(parsingResultFixture);
  });
});
