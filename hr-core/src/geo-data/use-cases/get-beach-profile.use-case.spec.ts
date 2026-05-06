import { Types } from 'mongoose';
import { BeachProfilesService } from '../../beach-profiles/beach-profiles.service';
import { BeachProfileNotFoundError } from '../errors/beach-profile-not-found.error';
import { GetBeachProfileUseCase } from './get-beach-profile.use-case';

describe('GetBeachProfileUseCase', () => {
  it('returns beach profile by id', async () => {
    const beach = {
      _id: new Types.ObjectId(),
    };
    const beachProfilesService = {
      findById: jest.fn().mockResolvedValue(beach),
    };
    const useCase = new GetBeachProfileUseCase(
      beachProfilesService as unknown as BeachProfilesService,
    );

    await expect(useCase.execute(beach._id.toString())).resolves.toEqual({
      item: beach,
      ok: true,
    });
    expect(beachProfilesService.findById).toHaveBeenCalledWith(
      beach._id.toString(),
    );
  });

  it('throws when beach profile is missing', async () => {
    const beachProfilesService = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const useCase = new GetBeachProfileUseCase(
      beachProfilesService as unknown as BeachProfilesService,
    );

    await expect(useCase.execute(new Types.ObjectId().toString()))
      .rejects.toBeInstanceOf(BeachProfileNotFoundError);
  });
});
