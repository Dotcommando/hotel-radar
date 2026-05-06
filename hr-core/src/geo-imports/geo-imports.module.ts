import { Module } from '@nestjs/common';
import { GeoImportRunsModule } from '../geo-import-runs/geo-import-runs.module';
import { HotelGeoCandidatesModule } from '../hotel-geo-candidates/hotel-geo-candidates.module';
import { GeoImportsController } from './geo-imports.controller';
import { GeoJsonHotelCandidatesImportService } from './services/geo-json-hotel-candidates-import.service';
import { GetGeoImportRunUseCase } from './use-cases/get-geo-import-run.use-case';
import { StartOsmOverpassHotelsImportUseCase } from './use-cases/start-osm-overpass-hotels-import.use-case';

@Module({
  controllers: [GeoImportsController],
  imports: [GeoImportRunsModule, HotelGeoCandidatesModule],
  providers: [
    GeoJsonHotelCandidatesImportService,
    GetGeoImportRunUseCase,
    StartOsmOverpassHotelsImportUseCase,
  ],
})
export class GeoImportsModule {}
