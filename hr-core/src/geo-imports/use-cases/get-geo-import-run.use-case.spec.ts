import { Types } from 'mongoose';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { GeoImportRunNotFoundError } from '../errors/geo-import-run-not-found.error';
import { GetGeoImportRunUseCase } from './get-geo-import-run.use-case';

describe('GetGeoImportRunUseCase', () => {
  it('returns geo import run status by run id', async () => {
    const startedAt = new Date('2026-05-06T09:00:00.000Z');
    const finishedAt = new Date('2026-05-06T09:00:05.000Z');
    const geoImportRunsService = {
      findByRunId: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        createdAt: startedAt,
        error: null,
        fileName: 'hotels.geojson',
        filePath: 'data/raw/osm/overpass/hotels.geojson',
        fileSha256: 'sha',
        fileSizeBytes: 123,
        finishedAt,
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
        updatedAt: finishedAt,
      }),
    };
    const useCase = new GetGeoImportRunUseCase(
      geoImportRunsService as unknown as GeoImportRunsService,
    );

    await expect(
      useCase.execute('2026-05-06T09-00-00-overpass-turbo-hotels'),
    ).resolves.toEqual({
      error: null,
      fileName: 'hotels.geojson',
      filePath: 'data/raw/osm/overpass/hotels.geojson',
      fileSha256: 'sha',
      fileSizeBytes: 123,
      finishedAt,
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
    });
  });

  it('throws when geo import run does not exist', async () => {
    const geoImportRunsService = {
      findByRunId: jest.fn().mockResolvedValue(null),
    };
    const useCase = new GetGeoImportRunUseCase(
      geoImportRunsService as unknown as GeoImportRunsService,
    );

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      GeoImportRunNotFoundError,
    );
  });
});
