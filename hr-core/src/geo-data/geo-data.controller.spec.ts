import { Test, TestingModule } from '@nestjs/testing';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { GeoDataController } from './geo-data.controller';
import { IGetHotelGeoCandidatesStatsResult } from './types/get-hotel-geo-candidates-stats-result.interface';
import { GetHotelGeoCandidatesStatsUseCase } from './use-cases/get-hotel-geo-candidates-stats.use-case';

describe('GeoDataController', () => {
  let controller: GeoDataController;
  let getHotelGeoCandidatesStatsUseCase: {
    execute: jest.Mock<Promise<IGetHotelGeoCandidatesStatsResult>, []>;
  };

  beforeEach(async () => {
    getHotelGeoCandidatesStatsUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeoDataController],
      providers: [
        {
          provide: GetHotelGeoCandidatesStatsUseCase,
          useValue: getHotelGeoCandidatesStatsUseCase,
        },
      ],
    }).compile();

    controller = module.get<GeoDataController>(GeoDataController);
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
});
