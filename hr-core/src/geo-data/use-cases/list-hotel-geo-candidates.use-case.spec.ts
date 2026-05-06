import { Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { ListHotelGeoCandidatesUseCase } from './list-hotel-geo-candidates.use-case';

describe('ListHotelGeoCandidatesUseCase', () => {
  it('normalizes query filters and returns paged candidates', async () => {
    const candidate = buildHotelGeoCandidateFixture();
    const hotelGeoCandidatesService = {
      countByFilters: jest.fn().mockResolvedValue(1),
      listByFilters: jest.fn().mockResolvedValue([candidate]),
    };
    const useCase = new ListHotelGeoCandidatesUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(
      useCase.execute({
        lifecycleStatus: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
        limit: '25',
        matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
        offset: '5',
        q: ' sunny ',
        sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
        sourceType: GEO_SOURCE_TYPE.OSM,
      }),
    ).resolves.toEqual({
      items: [candidate],
      limit: 25,
      offset: 5,
      ok: true,
      total: 1,
    });
    expect(hotelGeoCandidatesService.countByFilters).toHaveBeenCalledWith({
      lifecycleStatus: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
      limit: 25,
      matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
      offset: 5,
      q: 'sunny',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
    expect(hotelGeoCandidatesService.listByFilters).toHaveBeenCalledWith({
      lifecycleStatus: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
      limit: 25,
      matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
      offset: 5,
      q: 'sunny',
      sourceDataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      sourceType: GEO_SOURCE_TYPE.OSM,
    });
  });
});

function buildHotelGeoCandidateFixture() {
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
