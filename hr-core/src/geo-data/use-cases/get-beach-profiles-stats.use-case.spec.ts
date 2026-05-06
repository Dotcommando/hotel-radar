import { BEACH_GEOMETRY_KIND } from '../../beach-profiles/constants/beach-geometry-kind.enum';
import { BEACH_PROFILE_LIFECYCLE_STATUS } from '../../beach-profiles/constants/beach-profile-lifecycle-status.enum';
import { BEACH_QUALITY_STATUS } from '../../beach-profiles/constants/beach-quality-status.enum';
import { BEACH_TYPE } from '../../beach-profiles/constants/beach-type.enum';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { GetBeachProfilesStatsUseCase } from './get-beach-profiles-stats.use-case';

describe('GetBeachProfilesStatsUseCase', () => {
  it('returns service stats', async () => {
    const beachProfilesService = {
      getStats: jest.fn().mockResolvedValue({
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
      }),
    };
    const useCase = new GetBeachProfilesStatsUseCase(
      beachProfilesService as unknown as BeachProfilesService,
    );

    await expect(useCase.execute()).resolves.toEqual({
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
    });
    expect(beachProfilesService.getStats).toHaveBeenCalledWith();
  });
});
