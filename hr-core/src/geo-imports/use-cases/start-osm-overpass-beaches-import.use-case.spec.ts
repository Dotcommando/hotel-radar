import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoJsonBeachProfilesImportService } from '../services/geo-json-beach-profiles-import.service';
import { StartOsmOverpassBeachesImportUseCase } from './start-osm-overpass-beaches-import.use-case';

describe('StartOsmOverpassBeachesImportUseCase', () => {
  it('imports the configured OSM Overpass beaches file', async () => {
    const importService = {
      importOsmOverpassBeaches: jest.fn().mockResolvedValue({
        importKind: GEO_IMPORT_KIND.BEACHES,
        ok: true,
        runId: '2026-05-06T09-10-00-overpass-turbo-beaches',
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
    const useCase = new StartOsmOverpassBeachesImportUseCase(
      importService as GeoJsonBeachProfilesImportService,
    );

    await expect(useCase.execute()).resolves.toMatchObject({
      importKind: GEO_IMPORT_KIND.BEACHES,
      ok: true,
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
      status: GEO_IMPORT_RUN_STATUS.COMPLETED,
    });
    expect(importService.importOsmOverpassBeaches).toHaveBeenCalledWith(
      'data/raw/osm/overpass/beaches.geojson',
    );
  });
});
