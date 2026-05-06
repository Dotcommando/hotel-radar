import { Types } from 'mongoose';
import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../../beach-profiles/constants/beach-profile-lifecycle-status.enum';
import { BEACH_QUALITY_STATUS } from '../../beach-profiles/constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../../beach-profiles/constants/beach-type.enum';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { ListBeachProfilesUseCase } from './list-beach-profiles.use-case';

describe('ListBeachProfilesUseCase', () => {
  it('normalizes query filters and returns paged beaches', async () => {
    const beach = buildBeachProfileFixture();
    const beachProfilesService = {
      countByFilters: jest.fn().mockResolvedValue(1),
      listByFilters: jest.fn().mockResolvedValue([beach]),
    };
    const useCase = new ListBeachProfilesUseCase(
      beachProfilesService as unknown as BeachProfilesService,
    );

    await expect(
      useCase.execute({
        geometryKind: BEACH_GEOMETRY_KIND.AREA,
        lifecycleStatus: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
        limit: '25',
        offset: '5',
        q: ' fig ',
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    ).resolves.toEqual({
      items: [beach],
      limit: 25,
      offset: 5,
      ok: true,
      total: 1,
    });
    expect(beachProfilesService.countByFilters).toHaveBeenCalledWith({
      geometryKind: BEACH_GEOMETRY_KIND.AREA,
      lifecycleStatus: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
      limit: 25,
      offset: 5,
      q: 'fig',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
    expect(beachProfilesService.listByFilters).toHaveBeenCalledWith({
      geometryKind: BEACH_GEOMETRY_KIND.AREA,
      lifecycleStatus: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
      limit: 25,
      offset: 5,
      q: 'fig',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
  });
});

function buildBeachProfileFixture() {
  const now = new Date('2026-05-06T09:00:00.000Z');

  return {
    _id: new Types.ObjectId(),
    beachType: BEACH_TYPE.SAND,
    createdAt: now,
    geometry: {
      coordinates: [33.1, 34.9],
      type: 'Point',
    },
    geometryKind: BEACH_GEOMETRY_KIND.POINT,
    lifecycle: {
      firstSeenAt: now,
      lastSeenAt: now,
      notSeenSince: null,
      status: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
    },
    name: 'Fig Tree Bay',
    normalizedName: 'FIG TREE BAY',
    point: {
      coordinates: [33.1, 34.9],
      type: 'Point',
    },
    quality: {
      confidence: 'MEDIUM',
      reasons: [],
      status: BEACH_QUALITY_STATUS.RAW,
    },
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'node/100',
      importRunId: new Types.ObjectId(),
      type: GEO_SOURCE_TYPE.OSM,
    },
    sourceHashes: {
      geometryHash: 'geometry-hash',
      propertiesHash: 'properties-hash',
    },
    sourceProperties: {
      name: 'Fig Tree Bay',
      natural: 'beach',
    },
    updatedAt: now,
  };
}
