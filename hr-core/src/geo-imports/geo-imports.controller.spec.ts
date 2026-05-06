import { Test, TestingModule } from '@nestjs/testing';
import { GEO_IMPORT_KIND } from '../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../geo-import-runs/constants/geo-source-type.enum';
import { GeoImportsController } from './geo-imports.controller';
import { GeoImportRunNotFoundError } from './errors/geo-import-run-not-found.error';
import { IGetGeoImportRunResult } from './types/get-geo-import-run-result.interface';
import { IGeoImportRunResult } from './types/geo-import-run-result.interface';
import { GetGeoImportRunUseCase } from './use-cases/get-geo-import-run.use-case';
import { StartOsmOverpassHotelsImportUseCase } from './use-cases/start-osm-overpass-hotels-import.use-case';
import { NotFoundException } from '@nestjs/common';

describe('GeoImportsController', () => {
  let controller: GeoImportsController;
  let getGeoImportRunUseCase: {
    execute: jest.Mock<Promise<IGetGeoImportRunResult>, [string]>;
  };
  let startOsmOverpassHotelsImportUseCase: {
    execute: jest.Mock<Promise<IGeoImportRunResult>, []>;
  };

  beforeEach(async () => {
    getGeoImportRunUseCase = {
      execute: jest.fn(),
    };
    startOsmOverpassHotelsImportUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoImportsController],
      providers: [
        {
          provide: GetGeoImportRunUseCase,
          useValue: getGeoImportRunUseCase,
        },
        {
          provide: StartOsmOverpassHotelsImportUseCase,
          useValue: startOsmOverpassHotelsImportUseCase,
        },
      ],
    }).compile();

    controller = module.get<GeoImportsController>(GeoImportsController);
  });

  it('starts OSM Overpass hotel import', async () => {
    const resultFixture: IGeoImportRunResult = {
      importKind: GEO_IMPORT_KIND.HOTELS,
      ok: true,
      runId: '2026-05-06T09-00-00-osm-overpass-hotels',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
      stats: {
        failed: 0,
        inserted: 1,
        markedStale: 0,
        read: 1,
        unchanged: 0,
        updated: 0,
      },
      status: GEO_IMPORT_RUN_STATUS.COMPLETED,
    };

    startOsmOverpassHotelsImportUseCase.execute.mockResolvedValue(
      resultFixture,
    );

    await expect(controller.importOsmOverpassHotels()).resolves.toEqual(
      resultFixture,
    );
    expect(startOsmOverpassHotelsImportUseCase.execute).toHaveBeenCalledWith();
  });

  it('returns geo import run status by id', async () => {
    const startedAt = new Date('2026-05-06T09:00:00.000Z');
    const resultFixture: IGetGeoImportRunResult = {
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
      status: GEO_IMPORT_RUN_STATUS.RUNNING,
    };

    getGeoImportRunUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.getRun('2026-05-06T09-00-00-overpass-turbo-hotels'),
    ).resolves.toEqual(resultFixture);
    expect(getGeoImportRunUseCase.execute).toHaveBeenCalledWith(
      '2026-05-06T09-00-00-overpass-turbo-hotels',
    );
  });

  it('maps missing geo import run to not found response', async () => {
    getGeoImportRunUseCase.execute.mockRejectedValue(
      new GeoImportRunNotFoundError(),
    );

    await expect(controller.getRun('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
