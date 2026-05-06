import { Types } from 'mongoose';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { ListGeoImportRunsUseCase } from './list-geo-import-runs.use-case';

describe('ListGeoImportRunsUseCase', () => {
  it('returns recent geo import runs', async () => {
    const startedAt = new Date('2026-05-06T09:00:00.000Z');
    const geoImportRunsService = {
      listRecent: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          createdAt: startedAt,
          error: null,
          fileName: 'hotels.geojson',
          filePath: 'data/raw/osm/overpass/hotels.geojson',
          fileSha256: 'sha',
          fileSizeBytes: 123,
          finishedAt: null,
          importKind: GEO_IMPORT_KIND.HOTELS,
          runId: '2026-05-06T09-00-00-overpass-turbo-hotels',
          sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
          sourceType: GEO_SOURCE_TYPE.OSM,
          startedAt,
          stats: {
            failed: 0,
            inserted: 1,
            markedStale: 0,
            read: 1,
            unchanged: 0,
            updated: 0,
          },
          status: GEO_IMPORT_RUN_STATUS.COMPLETED,
          updatedAt: startedAt,
        },
      ]),
    };
    const useCase = new ListGeoImportRunsUseCase(
      geoImportRunsService as unknown as GeoImportRunsService,
    );

    await expect(useCase.execute()).resolves.toEqual({
      ok: true,
      runs: [
        {
          error: null,
          fileName: 'hotels.geojson',
          filePath: 'data/raw/osm/overpass/hotels.geojson',
          fileSha256: 'sha',
          fileSizeBytes: 123,
          finishedAt: null,
          importKind: GEO_IMPORT_KIND.HOTELS,
          ok: true,
          runId: '2026-05-06T09-00-00-overpass-turbo-hotels',
          sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
          sourceType: GEO_SOURCE_TYPE.OSM,
          startedAt,
          stats: {
            failed: 0,
            inserted: 1,
            markedStale: 0,
            read: 1,
            unchanged: 0,
            updated: 0,
          },
          status: GEO_IMPORT_RUN_STATUS.COMPLETED,
        },
      ],
    });
    expect(geoImportRunsService.listRecent).toHaveBeenCalledWith(50);
  });
});
