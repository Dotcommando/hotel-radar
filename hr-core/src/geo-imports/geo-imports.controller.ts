import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { GeoImportRunNotFoundError } from './errors/geo-import-run-not-found.error';
import { IGetGeoImportRunResult } from './types/get-geo-import-run-result.interface';
import { IGeoImportRunResult } from './types/geo-import-run-result.interface';
import { IListGeoImportRunsResult } from './types/list-geo-import-runs-result.interface';
import { GetGeoImportRunUseCase } from './use-cases/get-geo-import-run.use-case';
import { ListGeoImportRunsUseCase } from './use-cases/list-geo-import-runs.use-case';
import { StartOsmOverpassBeachesImportUseCase } from './use-cases/start-osm-overpass-beaches-import.use-case';
import { StartOsmOverpassHotelsImportUseCase } from './use-cases/start-osm-overpass-hotels-import.use-case';

@Controller('geo-imports')
export class GeoImportsController {
  constructor(
    private readonly getGeoImportRunUseCase: GetGeoImportRunUseCase,
    private readonly listGeoImportRunsUseCase: ListGeoImportRunsUseCase,
    private readonly startOsmOverpassBeachesImportUseCase: StartOsmOverpassBeachesImportUseCase,
    private readonly startOsmOverpassHotelsImportUseCase: StartOsmOverpassHotelsImportUseCase,
  ) {}

  @Post('runs/osm-overpass/hotels')
  @HttpCode(HttpStatus.ACCEPTED)
  async importOsmOverpassHotels(): Promise<IGeoImportRunResult> {
    return this.startOsmOverpassHotelsImportUseCase.execute();
  }

  @Post('runs/osm-overpass/beaches')
  @HttpCode(HttpStatus.ACCEPTED)
  async importOsmOverpassBeaches(): Promise<IGeoImportRunResult> {
    return this.startOsmOverpassBeachesImportUseCase.execute();
  }

  @Get('runs')
  async listRuns(): Promise<IListGeoImportRunsResult> {
    return this.listGeoImportRunsUseCase.execute();
  }

  @Get('runs/:runId')
  async getRun(
    @Param('runId') runId: string,
  ): Promise<IGetGeoImportRunResult> {
    try {
      return await this.getGeoImportRunUseCase.execute(runId);
    } catch (error) {
      if (error instanceof GeoImportRunNotFoundError) {
        throw new NotFoundException({
          code: 'GEO_IMPORT_RUN_NOT_FOUND',
          message: error.message,
          ok: false,
        });
      }

      throw error;
    }
  }
}
