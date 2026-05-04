import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { HotelProcessingActiveRunExistsError } from './errors/hotel-processing-active-run-exists.error';
import { HotelProcessingNoPendingSourceDocumentsError } from './errors/hotel-processing-no-pending-source-documents.error';
import { HotelProcessingNoRollbackRunFoundError } from './errors/hotel-processing-no-rollback-run-found.error';
import { HotelProcessingPreviousStageNotCompletedError } from './errors/hotel-processing-previous-stage-not-completed.error';
import { HotelProcessingRunNotFoundError } from './errors/hotel-processing-run-not-found.error';
import { HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE } from './constants/hotel-processing-rollback-target-stage.enum';
import { IGetHotelProcessingRunResult } from './types/get-hotel-processing-run-result.interface';
import { IHotelProcessingRollbackResult } from './types/hotel-processing-rollback-result.interface';
import { IStartHotelProcessingRunResult } from './types/start-hotel-processing-run-result.interface';
import { GetHotelProcessingRunUseCase } from './use-cases/get-hotel-processing-run.use-case';
import { RollbackHotelProcessingUseCase } from './use-cases/rollback-hotel-processing.use-case';
import { StartCandidatesToCanonicalRunUseCase } from './use-cases/start-candidates-to-canonical-run.use-case';
import { StartRawToRegistryRunUseCase } from './use-cases/start-raw-to-registry-run.use-case';
import { StartRegistryToCandidatesRunUseCase } from './use-cases/start-registry-to-candidates-run.use-case';

@Controller('hotel-processing')
export class HotelProcessingController {
  constructor(
    private readonly startRawToRegistryRunUseCase: StartRawToRegistryRunUseCase,
    private readonly startRegistryToCandidatesRunUseCase: StartRegistryToCandidatesRunUseCase,
    private readonly startCandidatesToCanonicalRunUseCase: StartCandidatesToCanonicalRunUseCase,
    private readonly getHotelProcessingRunUseCase: GetHotelProcessingRunUseCase,
    private readonly rollbackHotelProcessingUseCase: RollbackHotelProcessingUseCase,
  ) {}

  @Post('runs/raw-to-registry')
  @HttpCode(HttpStatus.ACCEPTED)
  async startRawToRegistryRun(): Promise<IStartHotelProcessingRunResult> {
    try {
      return await this.startRawToRegistryRunUseCase.execute();
    } catch (error) {
      if (error instanceof HotelProcessingActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelProcessingNoPendingSourceDocumentsError) {
        throw new ConflictException({
          code: 'NO_PENDING_SOURCE_DOCUMENTS',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Post('runs/registry-to-candidates')
  @HttpCode(HttpStatus.ACCEPTED)
  async startRegistryToCandidatesRun(): Promise<IStartHotelProcessingRunResult> {
    try {
      return await this.startRegistryToCandidatesRunUseCase.execute();
    } catch (error) {
      if (error instanceof HotelProcessingActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelProcessingPreviousStageNotCompletedError) {
        throw new ConflictException({
          code: 'PREVIOUS_STAGE_NOT_COMPLETED',
          details: error.details,
          message:
            'Cannot start registry_to_candidates because raw_to_registry is not fully completed.',
          ok: false,
        });
      }

      if (error instanceof HotelProcessingNoPendingSourceDocumentsError) {
        throw new ConflictException({
          code: 'NO_PENDING_SOURCE_DOCUMENTS',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Post('runs/candidates-to-canonical')
  @HttpCode(HttpStatus.ACCEPTED)
  async startCandidatesToCanonicalRun(): Promise<IStartHotelProcessingRunResult> {
    return this.startCandidatesToCanonicalRunWithOptions(false);
  }

  @Post('runs/candidates-to-canonical/retry-review-required')
  @HttpCode(HttpStatus.ACCEPTED)
  async retryReviewRequiredCandidatesToCanonicalRun(): Promise<IStartHotelProcessingRunResult> {
    return this.startCandidatesToCanonicalRunWithOptions(true);
  }

  private async startCandidatesToCanonicalRunWithOptions(
    retryReviewRequired: boolean,
  ): Promise<IStartHotelProcessingRunResult> {
    try {
      return await this.startCandidatesToCanonicalRunUseCase.execute({
        retryReviewRequired,
      });
    } catch (error) {
      if (error instanceof HotelProcessingActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelProcessingNoPendingSourceDocumentsError) {
        throw new ConflictException({
          code: 'NO_PENDING_SOURCE_DOCUMENTS',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Get('runs/:runId')
  async getRun(
    @Param('runId') runId: string,
  ): Promise<IGetHotelProcessingRunResult> {
    try {
      return await this.getHotelProcessingRunUseCase.execute(runId);
    } catch (error) {
      if (error instanceof HotelProcessingRunNotFoundError) {
        throw new NotFoundException({
          code: 'RUN_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Post('rollback/stage-2')
  @HttpCode(HttpStatus.OK)
  async rollbackToStage2(): Promise<IHotelProcessingRollbackResult> {
    return this.rollbackToTargetStage(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_2,
    );
  }

  @Post('rollback/stage-1')
  @HttpCode(HttpStatus.OK)
  async rollbackToStage1(): Promise<IHotelProcessingRollbackResult> {
    return this.rollbackToTargetStage(
      HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE.STAGE_1,
    );
  }

  private async rollbackToTargetStage(
    targetStage: HOTEL_PROCESSING_ROLLBACK_TARGET_STAGE,
  ): Promise<IHotelProcessingRollbackResult> {
    try {
      return await this.rollbackHotelProcessingUseCase.execute(targetStage);
    } catch (error) {
      if (error instanceof HotelProcessingActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelProcessingNoRollbackRunFoundError) {
        throw new ConflictException({
          code: 'NO_ROLLBACK_RUN_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }
}
