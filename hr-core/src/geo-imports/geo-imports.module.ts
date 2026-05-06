import { Module } from '@nestjs/common';
import { BeachProfilesModule } from '../beach-profiles/beach-profiles.module';
import { GeoImportRunsModule } from '../geo-import-runs/geo-import-runs.module';
import { HotelGeoCandidatesModule } from '../hotel-geo-candidates/hotel-geo-candidates.module';
import { GeoImportsController } from './geo-imports.controller';
import { GeoJsonBeachProfilesImportService } from './services/geo-json-beach-profiles-import.service';
import { GeoJsonHotelCandidatesImportService } from './services/geo-json-hotel-candidates-import.service';
import { GetGeoImportRunUseCase } from './use-cases/get-geo-import-run.use-case';
import { StartOsmOverpassBeachesImportUseCase } from './use-cases/start-osm-overpass-beaches-import.use-case';
import { StartOsmOverpassHotelsImportUseCase } from './use-cases/start-osm-overpass-hotels-import.use-case';

@Module({
  controllers: [GeoImportsController],
  imports: [BeachProfilesModule, GeoImportRunsModule, HotelGeoCandidatesModule],
  providers: [
    GeoJsonBeachProfilesImportService,
    GeoJsonHotelCandidatesImportService,
    GetGeoImportRunUseCase,
    StartOsmOverpassBeachesImportUseCase,
    StartOsmOverpassHotelsImportUseCase,
  ],
})
export class GeoImportsModule {}
