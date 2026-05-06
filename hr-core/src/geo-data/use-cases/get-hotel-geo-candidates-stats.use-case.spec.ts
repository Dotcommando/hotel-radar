import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { GetHotelGeoCandidatesStatsUseCase } from './get-hotel-geo-candidates-stats.use-case';

describe('GetHotelGeoCandidatesStatsUseCase', () => {
  it('returns service stats', async () => {
    const hotelGeoCandidatesService = {
      getStats: jest.fn().mockResolvedValue({
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
      }),
    };
    const useCase = new GetHotelGeoCandidatesStatsUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(useCase.execute()).resolves.toEqual({
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
    });
    expect(hotelGeoCandidatesService.getStats).toHaveBeenCalledWith();
  });
});
