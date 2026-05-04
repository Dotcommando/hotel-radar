import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from './constants/hotel-processing-rollback-target-stage.enum';
import { HOTEL_PROCESSING_RUN_STATUS } from './constants/hotel-processing-run-status.enum';
import { HOTEL_PROCESSING_STAGE } from './constants/hotel-processing-stage.enum';
import { HotelProcessingActiveRunExistsError } from './errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoRollbackRunFoundError } from './errors/hotel-processing-no-rollback-run-found.error';
import { HotelProcessingRunNotFoundError } from './errors/hotel-processing-run-not-found.error';
import { HotelProcessingController } from './hotel-processing.controller';
import { IGetHotelProcessingRunResult } from './types/get-hotel-processing-run-result.interface';
import { IHotelProcessingRollbackResult } from './types/hotel-processing-rollback-result.interface';
import { IStartHotelProcessingRunResult } from './types/start-hotel-processing-run-result.interface';
import { GetHotelProcessingRunUseCase } from './use-cases/get-hotel-processing-run.use-case';
import { RollbackHotelProcessingUseCase } from './use-cases/rollback-hotel-processing.use-case';
import { StartRawToRegistryRunUseCase } from './use-cases/start-raw-to-registry-run.use-case';
import { StartRegistryToCandidatesRunUseCase } from './use-cases/start-registry-to-candidates-run.use-case';

describe('HotelProcessingController', () => {
  let controller: HotelProcessingController;
  let startRawToRegistryRunUseCase: {
    execute: jest.Mock<Promise<IStartHotelProcessingRunResult>, []>;
  };
  let startRegistryToCandidatesRunUseCase: {
    execute: jest.Mock<Promise<IStartHotelProcessingRunResult>, []>;
  };
  let getHotelProcessingRunUseCase: {
    execute: jest.Mock<Promise<IGetHotelProcessingRunResult>, [string]>;
  };
  let rollbackHotelProcessingUseCase: {
    execute: jest.Mock<
      Promise<IHotelProcessingRollbackResult>,
      [HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE]
    >;
  };

  beforeEach(async () => {
    startRawToRegistryRunUseCase = {
      execute: jest.fn(),
    };
    startRegistryToCandidatesRunUseCase = {
      execute: jest.fn(),
    };
    getHotelProcessingRunUseCase = {
      execute: jest.fn(),
    };
    rollbackHotelProcessingUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HotelProcessingController],
      providers: [
        {
          provide: StartRawToRegistryRunUseCase,
          useValue: startRawToRegistryRunUseCase,
        },
        {
          provide: StartRegistryToCandidatesRunUseCase,
          useValue: startRegistryToCandidatesRunUseCase,
        },
        {
          provide: GetHotelProcessingRunUseCase,
          useValue: getHotelProcessingRunUseCase,
        },
        {
          provide: RollbackHotelProcessingUseCase,
          useValue: rollbackHotelProcessingUseCase,
        },
      ],
    }).compile();

    controller = module.get<HotelProcessingController>(
      HotelProcessingController,
    );
  });

  it('rolls back to stage 2 via endpoint', async () => {
    const resultFixture: IHotelProcessingRollbackResult = {
      ok: true,
      steps: [
        {
          deletedTargetDocuments: 12,
          resetSourceDocuments: 15,
          runId: '2026-05-03T17-15-15-registry-to-candidates',
          stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
        },
      ],
      targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2,
    };

    rollbackHotelProcessingUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.rollbackToStage2()).resolves.toEqual(resultFixture);
    expect(rollbackHotelProcessingUseCase.execute).toHaveBeenCalledWith(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2,
    );
  });

  it('rolls back to stage 1 via endpoint', async () => {
    const resultFixture: IHotelProcessingRollbackResult = {
      ok: true,
      steps: [
        {
          deletedTargetDocuments: 12,
          resetSourceDocuments: 15,
          runId: '2026-05-03T17-15-15-registry-to-candidates',
          stage: HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
        },
        {
          deletedTargetDocuments: 15,
          resetSourceDocuments: 15,
          runId: '2026-05-03T17-15-04-raw-to-registry',
          stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
        },
      ],
      targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
    };

    rollbackHotelProcessingUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.rollbackToStage1()).resolves.toEqual(resultFixture);
    expect(rollbackHotelProcessingUseCase.execute).toHaveBeenCalledWith(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
    );
  });

  it('maps rollback active run errors to conflict response', async () => {
    rollbackHotelProcessingUseCase.execute.mockRejectedValue(
      new HotelProcessingActiveRunExistsError(),
    );

    await expect(controller.rollbackToStage2()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('maps missing rollback run errors to conflict response', async () => {
    rollbackHotelProcessingUseCase.execute.mockRejectedValue(
      new HotelProcessingNoRollbackRunFoundError(
        HOTEL_PROCESSING_STAGE.REGISTRY_TO_CANDIDATES,
      ),
    );

    await expect(controller.rollbackToStage2()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('keeps existing run not found mapping', async () => {
    getHotelProcessingRunUseCase.execute.mockRejectedValue(
      new HotelProcessingRunNotFoundError(),
    );

    await expect(controller.getRun('missing-run')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('keeps existing run start mapping available', async () => {
    const resultFixture: IStartHotelProcessingRunResult = {
      batchSize: 50,
      ok: true,
      runId: '2026-05-03T17-15-04-raw-to-registry',
      stage: HOTEL_PROCESSING_STAGE.RAW_TO_REGISTRY,
      status: HOTEL_PROCESSING_RUN_STATUS.QUEUED,
    };

    startRawToRegistryRunUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.startRawToRegistryRun()).resolves.toEqual(
      resultFixture,
    );
  });
});
