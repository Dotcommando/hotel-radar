import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { HotelBeachAccessActiveRunExistsError } from './errors/hotel-beach-access-active-run-exists.error';
import { HotelBeachAccessNoEligibleHotelsError } from './errors/hotel-beach-access-no-eligible-hotels.error';
import { HotelBeachAccessRunNotFoundError } from './errors/hotel-beach-access-run-not-found.error';
import { GetActiveHotelBeachAccessRunUseCase } from './use-cases/get-active-hotel-beach-access-run.use-case';
import { GetHotelBeachAccessProgressUseCase } from './use-cases/get-hotel-beach-access-progress.use-case';
import { GetHotelBeachAccessRunUseCase } from './use-cases/get-hotel-beach-access-run.use-case';
import { ListBeachHotelsUseCase } from './use-cases/list-beach-hotels.use-case';
import { ListHotelBeachesUseCase } from './use-cases/list-hotel-beaches.use-case';
import { StartHotelBeachAccessRunUseCase } from './use-cases/start-hotel-beach-access-run.use-case';

@Controller('hotel-beach-access')
export class HotelBeachAccessController {
  constructor(
    private readonly startRunUseCase: StartHotelBeachAccessRunUseCase,
    private readonly getActiveRunUseCase: GetActiveHotelBeachAccessRunUseCase,
    private readonly getRunUseCase: GetHotelBeachAccessRunUseCase,
    private readonly getProgressUseCase: GetHotelBeachAccessProgressUseCase,
    private readonly listHotelBeachesUseCase: ListHotelBeachesUseCase,
    private readonly listBeachHotelsUseCase: ListBeachHotelsUseCase,
  ) {}

  @Post('runs')
  @HttpCode(HttpStatus.ACCEPTED)
  async startRun() {
    try {
      return await this.startRunUseCase.execute();
    } catch (error) {
      if (error instanceof HotelBeachAccessActiveRunExistsError) {
        throw new ConflictException({
          code: 'ACTIVE_RUN_EXISTS',
          message: error.message,
          ok: false,
        });
      }

      if (error instanceof HotelBeachAccessNoEligibleHotelsError) {
        throw new ConflictException({
          code: 'NO_ELIGIBLE_HOTELS',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Get('runs/active')
  async getActiveRun() {
    return this.getActiveRunUseCase.execute();
  }

  @Get('runs/:runId')
  async getRun(@Param('runId') runId: string) {
    try {
      return await this.getRunUseCase.execute(runId);
    } catch (error) {
      if (error instanceof HotelBeachAccessRunNotFoundError) {
        throw new NotFoundException({
          code: 'RUN_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }

  @Get('progress')
  async getProgress() {
    return this.getProgressUseCase.execute();
  }

  @Get('hotels/:canonicalHotelId/beaches')
  async listHotelBeaches(
    @Param('canonicalHotelId') canonicalHotelId: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.listHotelBeachesUseCase.execute(
      canonicalHotelId,
      this.normalizeLimit(limit),
    );
  }

  @Get('beaches/:beachProfileId/hotels')
  async listBeachHotels(
    @Param('beachProfileId') beachProfileId: string,
    @Query('limit') limit: string | undefined,
  ) {
    return this.listBeachHotelsUseCase.execute(
      beachProfileId,
      this.normalizeLimit(limit),
    );
  }

  private normalizeLimit(value: string | undefined): number {
    if (value === undefined) {
      return 20;
    }

    const parsed = Number.parseInt(value, 10);

    return Number.isFinite(parsed) ? parsed : 20;
  }
}
