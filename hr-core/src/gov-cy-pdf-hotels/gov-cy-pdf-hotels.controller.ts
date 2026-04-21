import { Controller, Post } from '@nestjs/common';
import { IGovCyPdfParsingResult } from './types/gov-cy-pdf-parsing-result.interface';
import { RunGovCyPdfParsingUseCase } from './use-cases/run-gov-cy-pdf-parsing.use-case';

@Controller('gov-cy-pdf-hotels')
export class GovCyPdfHotelsController {
  constructor(
    private readonly runGovCyPdfParsingUseCase: RunGovCyPdfParsingUseCase,
  ) {}

  @Post('parse')
  async parseGovCyPdfHotels(): Promise<IGovCyPdfParsingResult> {
    console.log('[GovCyPdfHotelsController] POST /gov-cy-pdf-hotels/parse started');

    return this.runGovCyPdfParsingUseCase.execute();
  }
}
