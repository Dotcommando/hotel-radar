import { Types } from 'mongoose';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { IHotelGeoCandidateWithDistance } from '../../hotel-geo-candidates/types/hotel-geo-candidate-with-distance.interface';
import { InvalidNearbyHotelGeoCandidatesQueryError } from '../errors/invalid-nearby-hotel-geo-candidates-query.error';
import { ListNearbyUnmatchedHotelGeoCandidatesUseCase } from './list-nearby-unmatched-hotel-geo-candidates.use-case';

describe('ListNearbyUnmatchedHotelGeoCandidatesUseCase', () => {
  it('uses Google lat/lng query order and returns unmatched candidates in radius', async () => {
    const candidate = buildHotelGeoCandidateWithDistanceFixture();
    const hotelGeoCandidatesService = {
      listNearbyUnmatched: jest.fn().mockResolvedValue([candidate]),
    };
    const useCase = new ListNearbyUnmatchedHotelGeoCandidatesUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(
      useCase.execute({
        lat: '35.1695948',
        limit: '25',
        lng: '33.3632663',
        radiusMeters: '750',
      }),
    ).resolves.toEqual({
      center: {
        lat: 35.1695948,
        lng: 33.3632663,
      },
      items: [candidate],
      limit: 25,
      ok: true,
      radiusMeters: 750,
      total: 1,
    });
    expect(hotelGeoCandidatesService.listNearbyUnmatched).toHaveBeenCalledWith({
      lat: 35.1695948,
      limit: 25,
      lng: 33.3632663,
      radiusMeters: 750,
    });
  });

  it('rejects missing coordinates', async () => {
    const hotelGeoCandidatesService = {
      listNearbyUnmatched: jest.fn(),
    };
    const useCase = new ListNearbyUnmatchedHotelGeoCandidatesUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(
      useCase.execute({
        lng: '33.3632663',
      }),
    ).rejects.toBeInstanceOf(InvalidNearbyHotelGeoCandidatesQueryError);
    expect(hotelGeoCandidatesService.listNearbyUnmatched).not.toHaveBeenCalled();
  });

  it('normalizes default radius and limit', async () => {
    const hotelGeoCandidatesService = {
      listNearbyUnmatched: jest.fn().mockResolvedValue([]),
    };
    const useCase = new ListNearbyUnmatchedHotelGeoCandidatesUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await useCase.execute({
      lat: '35.1695948',
      lng: '33.3632663',
    });

    expect(hotelGeoCandidatesService.listNearbyUnmatched).toHaveBeenCalledWith({
      lat: 35.1695948,
      limit: 50,
      lng: 33.3632663,
      radiusMeters: 100,
    });
  });
});

function buildHotelGeoCandidateWithDistanceFixture(): IHotelGeoCandidateWithDistance {
  const now = new Date('2026-05-06T09:00:00.000Z');

  return {
    _id: new Types.ObjectId(),
    canonicalHotelId: null,
    componentId: null,
    createdAt: now,
    distanceMeters: 123.45,
    geometry: {
      coordinates: [33.3632663, 35.1695948],
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
    name: 'Nearby Hotel',
    normalizedName: 'NEARBY HOTEL',
    point: {
      coordinates: [33.3632663, 35.1695948],
      type: 'Point',
    },
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'node/1',
      importRunId: new Types.ObjectId(),
      type: GEO_SOURCE_TYPE.OSM,
    },
    sourceHashes: {
      geometryHash: 'geometry-hash',
      propertiesHash: 'properties-hash',
    },
    sourceProperties: {
      name: 'Nearby Hotel',
      tourism: 'hotel',
    },
    updatedAt: now,
  };
}
