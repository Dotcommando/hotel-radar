import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Types } from 'mongoose';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { BEACH_PROFILE_UPSERT_RESULT } from '../../beach-profiles/constants/beach-profile-upsert-result.enum';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { GeoJsonBeachProfilesImportService } from './geo-json-beach-profiles-import.service';

describe('GeoJsonBeachProfilesImportService', () => {
  let beachProfilesService: {
    markStaleMissingFromRun: jest.Mock;
    upsertFromOsmOverpassFeature: jest.Mock;
  };
  let geoImportRunsService: {
    createRunningRun: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };
  let service: GeoJsonBeachProfilesImportService;

  beforeEach(() => {
    beachProfilesService = {
      markStaleMissingFromRun: jest.fn(),
      upsertFromOsmOverpassFeature: jest.fn(),
    };
    geoImportRunsService = {
      createRunningRun: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    service = new GeoJsonBeachProfilesImportService(
      geoImportRunsService as unknown as GeoImportRunsService,
      beachProfilesService as unknown as BeachProfilesService,
    );
  });

  it('imports OSM Overpass beach GeoJSON and completes the run with stats', async () => {
    const runId = new Types.ObjectId();
    const filePath = join(tmpdir(), `beaches-${Date.now()}.geojson`);

    await fs.writeFile(
      filePath,
      JSON.stringify({
        features: [
          {
            geometry: {
              coordinates: [
                [
                  [33.1, 34.9],
                  [33.2, 34.9],
                  [33.2, 35.0],
                  [33.1, 34.9],
                ],
              ],
              type: 'Polygon',
            },
            id: 'way/100',
            properties: {
              '@id': 'way/100',
              name: 'Fig Tree Bay',
              natural: 'beach',
            },
            type: 'Feature',
          },
          {
            geometry: {
              coordinates: [34.1, 35.1],
              type: 'Point',
            },
            properties: {
              '@id': 'node/200',
              leisure: 'beach_resort',
              name: 'Small Beach',
            },
            type: 'Feature',
          },
        ],
        type: 'FeatureCollection',
      }),
    );

    geoImportRunsService.createRunningRun.mockResolvedValue({
      _id: runId,
      runId: '2026-05-06T09-10-00-overpass-turbo-beaches',
    });
    beachProfilesService.upsertFromOsmOverpassFeature
      .mockResolvedValueOnce(BEACH_PROFILE_UPSERT_RESULT.INSERTED)
      .mockResolvedValueOnce(BEACH_PROFILE_UPSERT_RESULT.UPDATED);
    beachProfilesService.markStaleMissingFromRun.mockResolvedValue(2);

    await expect(service.importOsmOverpassBeaches(filePath)).resolves.toEqual({
      importKind: GEO_IMPORT_KIND.BEACHES,
      ok: true,
      runId: '2026-05-06T09-10-00-overpass-turbo-beaches',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
      stats: {
        failed: 0,
        inserted: 1,
        markedStale: 2,
        read: 2,
        unchanged: 0,
        updated: 1,
      },
      status: GEO_IMPORT_RUN_STATUS.COMPLETED,
    });
    expect(geoImportRunsService.createRunningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath,
        importKind: GEO_IMPORT_KIND.BEACHES,
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    );
    expect(beachProfilesService.upsertFromOsmOverpassFeature).toHaveBeenCalledTimes(
      2,
    );
    expect(beachProfilesService.markStaleMissingFromRun).toHaveBeenCalledWith(
      runId,
      GEO_SOURCE_TYPE.OSM,
      GEO_SOURCE_DATASET.OVERPASS_TURBO,
    );
    expect(geoImportRunsService.markCompleted).toHaveBeenCalledWith(
      runId,
      expect.objectContaining({
        inserted: 1,
        markedStale: 2,
        read: 2,
        updated: 1,
      }),
    );

    await fs.unlink(filePath);
  });
});
