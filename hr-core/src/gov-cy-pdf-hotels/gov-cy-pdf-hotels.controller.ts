import {
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { HotelProcessingActiveRunExistsError } from '../hotel-processing/errors/hotel-processing-active-run-exists.error';
import { IStartHotelProcessingRunResult } from '../hotel-processing/types/start-hotel-processing-run-result.interface';
import { StartGovCyPdfParsingRunUseCase } from './use-cases/start-gov-cy-pdf-parsing-run.use-case';

@Controller('gov-cy-pdf-hotels')
export class GovCyPdfHotelsController {
  constructor(
    private readonly startGovCyPdfParsingRunUseCase: StartGovCyPdfParsingRunUseCase,
  ) {}

  @Post('parse')
  @HttpCode(HttpStatus.ACCEPTED)
  async parseGovCyPdfHotels(): Promise<IStartHotelProcessingRunResult> {
    console.log(
      '[GovCyPdfHotelsController] POST /gov-cy-pdf-hotels/parse started',
    );

    try {
      return await this.startGovCyPdfParsingRunUseCase.execute();
    } catch (error) {
      if (error instanceof HotelProcessingActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }
}
