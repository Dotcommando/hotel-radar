import { Injectable } from '@nestjs/common';
import { IGeoImportRunResult } from '../types/geo-import-run-result.interface';
import { GeoJsonHotelCandidatesImportService } from '../services/geo-json-hotel-candidates-import.service';

@Injectable()
export class StartOsmOverpassHotelsImportUseCase {
  constructor(
    private readonly geoJsonHotelCandidatesImportService: GeoJsonHotelCandidatesImportService,
  ) {}

  async execute(): Promise<IGeoImportRunResult> {
    return this.geoJsonHotelCandidatesImportService.importOsmOverpassHotels(
      'data/raw/osm/overpass/hotels.geojson',
    );
  }
}
