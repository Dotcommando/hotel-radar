import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Types } from 'mongoose';
import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { HOTEL_GEO_CANDIDATE_UPSERT_RESULT } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-upsert-result.enum';
import { GeoJsonHotelCandidatesImportService } from './geo-json-hotel-candidates-import.service';

describe('GeoJsonHotelCandidatesImportService', () => {
  let geoImportRunsService: {
    createRunningRun: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
  };
  let hotelGeoCandidatesService: {
    markStaleMissingFromRun: jest.Mock;
    upsertFromOsmOverpassFeature: jest.Mock;
  };
  let service: GeoJsonHotelCandidatesImportService;

  beforeEach(() => {
    geoImportRunsService = {
      createRunningRun: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    hotelGeoCandidatesService = {
      markStaleMissingFromRun: jest.fn(),
      upsertFromOsmOverpassFeature: jest.fn(),
    };
    service = new GeoJsonHotelCandidatesImportService(
      geoImportRunsService as unknown as GeoImportRunsService,
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );
  });

  it('imports OSM Overpass hotel GeoJSON and completes the run with stats', async () => {
    const runId = new Types.ObjectId();
    const filePath = join(tmpdir(), `hotels-${Date.now()}.geojson`);

    await fs.writeFile(
      filePath,
      JSON.stringify({
        features: [
          {
            geometry: {
              coordinates: [34.0116723, 35.0542236],
              type: 'Point',
            },
            id: 'relation/2677825',
            properties: {
              '@id': 'relation/2677825',
              name: 'Sunny Coast Hotel Apts',
              phone: '+357 23822200',
              tourism: 'hotel',
            },
            type: 'Feature',
          },
          {
            geometry: {
              coordinates: [33.1, 34.9],
              type: 'Point',
            },
            properties: {
              '@id': 'node/10',
              name: 'Second Hotel',
              tourism: 'guest_house',
            },
            type: 'Feature',
          },
        ],
        type: 'FeatureCollection',
      }),
    );

    geoImportRunsService.createRunningRun.mockResolvedValue({
      _id: runId,
      runId: '2026-05-06T09-00-00-osm-overpass-hotels',
    });
    hotelGeoCandidatesService.upsertFromOsmOverpassFeature
      .mockResolvedValueOnce(HOTEL_GEO_CANDIDATE_UPSERT_RESULT.INSERTED)
      .mockResolvedValueOnce(HOTEL_GEO_CANDIDATE_UPSERT_RESULT.UPDATED);
    hotelGeoCandidatesService.markStaleMissingFromRun.mockResolvedValue(3);

    await expect(service.importOsmOverpassHotels(filePath)).resolves.toEqual({
      importKind: GEO_IMPORT_KIND.HOTELS,
      ok: true,
      runId: '2026-05-06T09-00-00-osm-overpass-hotels',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
      stats: {
        failed: 0,
        inserted: 1,
        markedStale: 3,
        read: 2,
        unchanged: 0,
        updated: 1,
      },
      status: GEO_IMPORT_RUN_STATUS.COMPLETED,
    });
    expect(geoImportRunsService.createRunningRun).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath,
        importKind: GEO_IMPORT_KIND.HOTELS,
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    );
    expect(
      hotelGeoCandidatesService.upsertFromOsmOverpassFeature,
    ).toHaveBeenCalledTimes(2);
    expect(hotelGeoCandidatesService.markStaleMissingFromRun).toHaveBeenCalledWith(
      runId,
      GEO_SOURCE_TYPE.OSM,
      GEO_SOURCE_DATASET.OVERPASS_TURBO,
    );
    expect(geoImportRunsService.markCompleted).toHaveBeenCalledWith(
      runId,
      expect.objectContaining({
        inserted: 1,
        markedStale: 3,
        read: 2,
        updated: 1,
      }),
    );

    await fs.unlink(filePath);
  });
});
