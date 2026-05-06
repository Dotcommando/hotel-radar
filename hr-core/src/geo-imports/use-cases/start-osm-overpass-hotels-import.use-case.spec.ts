import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoJsonHotelCandidatesImportService } from '../services/geo-json-hotel-candidates-import.service';
import { StartOsmOverpassHotelsImportUseCase } from './start-osm-overpass-hotels-import.use-case';

describe('StartOsmOverpassHotelsImportUseCase', () => {
  it('imports the configured OSM Overpass hotel candidates file', async () => {
    const importService = {
      importOsmOverpassHotels: jest.fn().mockResolvedValue({
        importKind: GEO_IMPORT_KIND.HOTELS,
        ok: true,
        runId: '2026-05-06T09-00-00-osm-overpass-hotels',
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
        stats: {
          failed: 0,
          inserted: 2,
          markedStale: 1,
          read: 3,
          unchanged: 0,
          updated: 1,
        },
        status: GEO_IMPORT_RUN_STATUS.COMPLETED,
      }),
    };
    const useCase = new StartOsmOverpassHotelsImportUseCase(
      importService as GeoJsonHotelCandidatesImportService,
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      importKind: GEO_IMPORT_KIND.HOTELS,
      ok: true,
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
      status: GEO_IMPORT_RUN_STATUS.COMPLETED,
    });
    expect(importService.importOsmOverpassHotels).toHaveBeenCalledWith(
      'data/raw/osm/overpass/hotels.geojson',
    );
  });
});
