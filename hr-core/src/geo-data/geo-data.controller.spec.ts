import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { BEACH_GEOMETRY_KIND } from '../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../beach-profiles/constants/beach-profile-lifecycle-status.enum';
import { BEACH_QUALITY_STATUS } from '../beach-profiles/constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../beach-profiles/constants/beach-type.enum';
import { GEO_SOURCE_DATASET } from '../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../geo-import-runs/constants/geo-source-type.enum';
import { GEO_MATCH_ACTION } from '../geo-matching/constants/geo-match-action.enum';
import { AutoMatchHotelGeoCandidatesUseCase } from '../geo-matching/use-cases/auto-match-hotel-geo-candidates.use-case';
import { IAutoMatchHotelGeoCandidatesResult } from '../geo-matching/types/auto-match-hotel-geo-candidates-result.interface';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { GeoDataController } from './geo-data.controller';
import { BeachProfileNotFoundError } from './errors/beach-profile-not-found.error';
import { HotelGeoCandidateNotFoundError } from './errors/hotel-geo-candidate-not-found.error';
import { IGetBeachProfileResult } from './types/get-beach-profile-result.interface';
import { IGetBeachProfilesStatsResult } from './types/get-beach-profiles-stats-result.interface';
import { IGetHotelGeoCandidateResult } from './types/get-hotel-geo-candidate-result.interface';
import { IGetHotelGeoCandidatesStatsResult } from './types/get-hotel-geo-candidates-stats-result.interface';
import { IListBeachProfilesResult } from './types/list-beach-profiles-result.interface';
import { IListHotelGeoCandidatesResult } from './types/list-hotel-geo-candidates-result.interface';
import { GetBeachProfileUseCase } from './use-cases/get-beach-profile.use-case';
import { GetBeachProfilesStatsUseCase } from './use-cases/get-beach-profiles-stats.use-case';
import { GetHotelGeoCandidateUseCase } from './use-cases/get-hotel-geo-candidate.use-case';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';
import { ListBeachProfilesUseCase } from './use-cases/list-beach-profiles.use-case';
import { ListHotelGeoCandidatesUseCase } from './use-cases/list-hotel-geo-candidates.use-case';

describe('GeoDataController', () => {
  let controller: GeoDataController;
  let autoMatchHotelGeoCandidatesUseCase: {
    execute: jest.Mock<Promise<IAutoMatchHotelGeoCandidatesResult>, [unknown]>;
  };
  let getBeachProfileUseCase: {
    execute: jest.Mock<Promise<IGetBeachProfileResult>, [string]>;
  };
  let getBeachProfilesStatsUseCase: {
    execute: jest.Mock<Promise<IGetBeachProfilesStatsResult>, []>;
  };
  let getHotelGeoCandidateUseCase: {
    execute: jest.Mock<Promise<IGetHotelGeoCandidateResult>, [string]>;
  };
  let getHotelGeoCandidatesStatsUseCase: {
    execute: jest.Mock<Promise<IGetHotelGeoCandidatesStatsResult>, []>;
  };
  let listHotelGeoCandidatesUseCase: {
    execute: jest.Mock<Promise<IListHotelGeoCandidatesResult>, [unknown]>;
  };
  let listBeachProfilesUseCase: {
    execute: jest.Mock<Promise<IListBeachProfilesResult>, [unknown]>;
  };

  beforeEach(async () => {
    autoMatchHotelGeoCandidatesUseCase = {
      execute: jest.fn(),
    };
    getBeachProfileUseCase = {
      execute: jest.fn(),
    };
    getBeachProfilesStatsUseCase = {
      execute: jest.fn(),
    };
    getHotelGeoCandidateUseCase = {
      execute: jest.fn(),
    };
    getHotelGeoCandidatesStatsUseCase = {
      execute: jest.fn(),
    };
    listHotelGeoCandidatesUseCase = {
      execute: jest.fn(),
    };
    listBeachProfilesUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoDataController],
      providers: [
        {
          provide: AutoMatchHotelGeoCandidatesUseCase,
          useValue: autoMatchHotelGeoCandidatesUseCase,
        },
        {
          provide: GetBeachProfileUseCase,
          useValue: getBeachProfileUseCase,
        },
        {
          provide: GetBeachProfilesStatsUseCase,
          useValue: getBeachProfilesStatsUseCase,
        },
        {
          provide: GetHotelGeoCandidateUseCase,
          useValue: getHotelGeoCandidateUseCase,
        },
        {
          provide: GetHotelGeoCandidatesStatsUseCase,
          useValue: getHotelGeoCandidatesStatsUseCase,
        },
        {
          provide: ListHotelGeoCandidatesUseCase,
          useValue: listHotelGeoCandidatesUseCase,
        },
        {
          provide: ListBeachProfilesUseCase,
          useValue: listBeachProfilesUseCase,
        },
      ],
    }).compile();

    controller = module.get<GeoDataController>(GeoDataController);
  });

  it('starts automatic hotel geo candidate matching', async () => {
    const resultFixture: IAutoMatchHotelGeoCandidatesResult = {
      conflicts: [],
      dryRun: true,
      matches: [
        {
          action: GEO_MATCH_ACTION.AUTO_MATCHED,
          canonicalHotelId: new Types.ObjectId().toString(),
          hotelGeoCandidateId: new Types.ObjectId().toString(),
          reasons: [],
          score: 100,
        },
      ],
      ok: true,
      reviewSuggestions: [],
      stats: {
        alreadyMatched: 0,
        autoMatched: 1,
        conflicts: 0,
        eligibleCandidates: 1,
        needsReview: 0,
        noDeterministicMatch: 0,
        skippedConfirmed: 0,
        skippedRejected: 0,
        skippedStale: 0,
      },
    };

    autoMatchHotelGeoCandidatesUseCase.execute.mockResolvedValue(
      resultFixture,
    );

    await expect(
      controller.autoMatchHotelCandidates({
        dryRun: 'true',
      }),
    ).resolves.toEqual(resultFixture);
    expect(autoMatchHotelGeoCandidatesUseCase.execute).toHaveBeenCalledWith({
      dryRun: 'true',
    });
  });

  it('returns hotel geo candidate stats', async () => {
    const resultFixture: IGetHotelGeoCandidatesStatsResult = {
      ok: true,
      stats: {
        byLifecycleStatus: {
          [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE]: 10,
          [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE]: 0,
          [HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.STALE]: 1,
        },
        byMatchStatus: {
          [HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED]: 0,
          [HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED]: 0,
          [HOTEL_GEO_CANDIDATE_MATCH_STATUS.NEEDS_REVIEW]: 0,
          [HOTEL_GEO_CANDIDATE_MATCH_STATUS.REJECTED]: 0,
          [HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED]: 11,
        },
        byTourismTag: {
          guest_house: 1,
          hotel: 10,
        },
        total: 11,
        withName: 10,
        withPhone: 4,
        withWebsite: 3,
      },
    };

    getHotelGeoCandidatesStatsUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.getHotelCandidateStats()).resolves.toEqual(
      resultFixture,
    );
    expect(getHotelGeoCandidatesStatsUseCase.execute).toHaveBeenCalledWith();
  });

  it('returns beach profile stats', async () => {
    const resultFixture: IGetBeachProfilesStatsResult = {
      ok: true,
      stats: {
        byBeachType: {
          [BEACH_TYPE.MIXED]: 0,
          [BEACH_TYPE.PEBBLE]: 0,
          [BEACH_TYPE.ROCKY]: 0,
          [BEACH_TYPE.SAND]: 2,
          [BEACH_TYPE.UNKNOWN]: 1,
        },
        byGeometryKind: {
          [BEACH_GEOMETRY_KIND.AREA]: 2,
          [BEACH_GEOMETRY_KIND.LINE]: 0,
          [BEACH_GEOMETRY_KIND.POINT]: 1,
        },
        byLifecycleStatus: {
          [BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE]: 3,
          [BEACH_PROFILE_LIFECYCLE_STATUS.REMOVED_FROM_SOURCE]: 0,
          [BEACH_PROFILE_LIFECYCLE_STATUS.STALE]: 0,
        },
        byQualityStatus: {
          [BEACH_QUALITY_STATUS.NEEDS_REVIEW]: 0,
          [BEACH_QUALITY_STATUS.NORMALIZED]: 0,
          [BEACH_QUALITY_STATUS.RAW]: 3,
          [BEACH_QUALITY_STATUS.VERIFIED]: 0,
        },
        total: 3,
        withName: 2,
      },
    };

    getBeachProfilesStatsUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.getBeachStats()).resolves.toEqual(resultFixture);
    expect(getBeachProfilesStatsUseCase.execute).toHaveBeenCalledWith();
  });

  it('lists beach profiles with filters', async () => {
    const resultFixture: IListBeachProfilesResult = {
      items: [buildBeachProfileFixture()],
      limit: 25,
      offset: 5,
      ok: true,
      total: 1,
    };

    listBeachProfilesUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.listBeaches({
        geometryKind: BEACH_GEOMETRY_KIND.AREA,
        lifecycleStatus: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
        limit: '25',
        offset: '5',
        q: 'fig',
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    ).resolves.toEqual(resultFixture);
    expect(listBeachProfilesUseCase.execute).toHaveBeenCalledWith({
      geometryKind: BEACH_GEOMETRY_KIND.AREA,
      lifecycleStatus: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
      limit: '25',
      offset: '5',
      q: 'fig',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
  });

  it('returns beach profile by id', async () => {
    const beach = buildBeachProfileFixture();
    const resultFixture: IGetBeachProfileResult = {
      item: beach,
      ok: true,
    };

    getBeachProfileUseCase.execute.mockResolvedValue(resultFixture);

    await expect(controller.getBeach(beach._id.toString())).resolves.toEqual(
      resultFixture,
    );
    expect(getBeachProfileUseCase.execute).toHaveBeenCalledWith(
      beach._id.toString(),
    );
  });

  it('maps missing beach profile to not found response', async () => {
    getBeachProfileUseCase.execute.mockRejectedValue(
      new BeachProfileNotFoundError(),
    );

    await expect(controller.getBeach(new Types.ObjectId().toString()))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists hotel geo candidates with filters', async () => {
    const resultFixture: IListHotelGeoCandidatesResult = {
      items: [buildHotelGeoCandidateFixture()],
      limit: 25,
      offset: 5,
      ok: true,
      total: 1,
    };

    listHotelGeoCandidatesUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.listHotelCandidates({
        lifecycleStatus: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
        limit: '25',
        matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
        offset: '5',
        q: 'sunny',
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    ).resolves.toEqual(resultFixture);
    expect(listHotelGeoCandidatesUseCase.execute).toHaveBeenCalledWith({
      lifecycleStatus: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
      limit: '25',
      matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
      offset: '5',
      q: 'sunny',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
  });

  it('returns hotel geo candidate by id', async () => {
    const candidate = buildHotelGeoCandidateFixture();
    const resultFixture: IGetHotelGeoCandidateResult = {
      item: candidate,
      ok: true,
    };

    getHotelGeoCandidateUseCase.execute.mockResolvedValue(resultFixture);

    await expect(
      controller.getHotelCandidate(candidate._id.toString()),
    ).resolves.toEqual(resultFixture);
    expect(getHotelGeoCandidateUseCase.execute).toHaveBeenCalledWith(
      candidate._id.toString(),
    );
  });

  it('maps missing hotel geo candidate to not found response', async () => {
    getHotelGeoCandidateUseCase.execute.mockRejectedValue(
      new HotelGeoCandidateNotFoundError(),
    );

    await expect(controller.getHotelCandidate(new Types.ObjectId().toString()))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

function buildHotelGeoCandidateFixture(): IGetHotelGeoCandidateResult['item'] {
  const now = new Date('2026-05-06T09:00:00.000Z');

  return {
    _id: new Types.ObjectId(),
    canonicalHotelId: null,
    componentId: null,
    createdAt: now,
    geometry: {
      coordinates: [34.0116723, 35.0542236],
      type: 'Point',
    },
    lifecycle: {
      firstSeenAt: now,
      lastSeenAt: now,
      notSeenSince: null,
      status: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
    },
    matchReasons: [],
    matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
    name: 'Sunny Coast Hotel Apts',
    normalizedName: 'SUNNY COAST HOTEL APTS',
    point: {
      coordinates: [34.0116723, 35.0542236],
      type: 'Point',
    },
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'relation/2677825',
      importRunId: new Types.ObjectId(),
      type: GEO_SOURCE_TYPE.OSM,
    },
    sourceHashes: {
      geometryHash: 'geometry-hash',
      propertiesHash: 'properties-hash',
    },
    sourceProperties: {
      name: 'Sunny Coast Hotel Apts',
      tourism: 'hotel',
    },
    updatedAt: now,
  };
}

function buildBeachProfileFixture(): IListBeachProfilesResult['items'][number] {
  const now = new Date('2026-05-06T09:00:00.000Z');

  return {
    _id: new Types.ObjectId(),
    beachType: BEACH_TYPE.SAND,
    createdAt: now,
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
    geometryKind: BEACH_GEOMETRY_KIND.AREA,
    lifecycle: {
      firstSeenAt: now,
      lastSeenAt: now,
      notSeenSince: null,
      status: BEACH_PROFILE_LIFECYCLE_STATUS.ACTIVE,
    },
    name: 'Fig Tree Bay',
    normalizedName: 'FIG TREE BAY',
    point: {
      coordinates: [33.15, 34.925],
      type: 'Point',
    },
    quality: {
      confidence: 'MEDIUM',
      reasons: [],
      status: BEACH_QUALITY_STATUS.RAW,
    },
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'way/100',
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
