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
import { HotelProcessingPreviousStageNotCompletedError } from './errors/hotel-processing-previous-stage-not-completed.error';
import { HotelProcessingRunNotFoundError } from './errors/hotel-processing-run-not-found.error';
import { IGetHotelProcessingRunResult } from './types/get-hotel-processing-run-result.interface';
import { IStartHotelProcessingRunResult } from './types/start-hotel-processing-run-result.interface';
import { GetHotelProcessingRunUseCase } from './use-cases/get-hotel-processing-run.use-case';
import { StartRawToRegistryRunUseCase } from './use-cases/start-raw-to-registry-run.use-case';
import { StartRegistryToCandidatesRunUseCase } from './use-cases/start-registry-to-candidates-run.use-case';

@Controller('hotel-processing')
export class HotelProcessingController {
  constructor(
    private readonly startRawToRegistryRunUseCase: StartRawToRegistryRunUseCase,
    private readonly startRegistryToCandidatesRunUseCase: StartRegistryToCandidatesRunUseCase,
    private readonly getHotelProcessingRunUseCase: GetHotelProcessingRunUseCase,
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
}
