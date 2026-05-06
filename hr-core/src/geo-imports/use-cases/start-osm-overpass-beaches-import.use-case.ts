import { Injectable } from '@nestjs/common';
import { GeoJsonBeachProfilesImportService } from '../services/geo-json-beach-profiles-import.service';
import { IGeoImportRunResult } from '../types/geo-import-run-result.interface';

@Injectable()
export class StartOsmOverpassBeachesImportUseCase {
  constructor(
    private readonly geoJsonBeachProfilesImportService: GeoJsonBeachProfilesImportService,
  ) {}

  async execute(): Promise<IGeoImportRunResult> {
    return this.geoJsonBeachProfilesImportService.importOsmOverpassBeaches(
      'data/raw/osm/overpass/beaches.geojson',
    );
  }
}
