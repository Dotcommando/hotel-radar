import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { GovCyPdfHotelsController } from './gov-cy-pdf-hotels.controller';
import { HOTEL_PROCESSING_RUN_STATUS } from '../hotel-processing/constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from '../hotel-processing/constants/hotel-processing-stage.enum';
import { HotelProcessingActiveRunExistsError } from '../hotel-processing/errors/hotel-processing-active-run-exists.error';
import { IStartHotelProcessingRunResult } from '../hotel-processing/types/start-hotel-processing-run-result.interface';
import { StartGovCyPdfParsingRunUseCase } from './use-cases/start-gov-cy-pdf-parsing-run.use-case';

describe('GovCyPdfHotelsController', () => {
  let controller: GovCyPdfHotelsController;
  let startGovCyPdfParsingRunUseCase: {
    execute: jest.Mock<Promise<IStartHotelProcessingRunResult>, []>;
  };

  const startRunResultFixture: IStartHotelProcessingRunResult = {
    batchSize: 1,
    ok: true,
    runId: '2026-05-02T18-30-00-gov-cy-pdf-parse',
    stage: HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE,
    status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
  };

  beforeEach(async () => {
    startGovCyPdfParsingRunUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GovCyPdfHotelsController],
      providers: [
        {
          provide: StartGovCyPdfParsingRunUseCase,
          useValue: startGovCyPdfParsingRunUseCase,
        },
      ],
    }).compile();

    controller = module.get<GovCyPdfHotelsController>(GovCyPdfHotelsController);
  });

  it('starts gov cy pdf parsing run via post endpoint', async () => {
    startGovCyPdfParsingRunUseCase.execute.mockResolvedValue(
      startRunResultFixture,
    );

    const result = await controller.parseGovCyPdfHotels();

    expect(startGovCyPdfParsingRunUseCase.execute).toHaveBeenCalledTimes(1);
    expect(result).toEqual(startRunResultFixture);
  });

  it('maps active parsing run to conflict response', async () => {
    startGovCyPdfParsingRunUseCase.execute.mockRejectedValue(
      new HotelProcessingActiveRunExistsError(),
    );

    await expect(controller.parseGovCyPdfHotels()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
