import { Types } from 'mongoose';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { HotelGeoCandidateNotFoundError } from '../errors/hotel-geo-candidate-not-found.error';
import { GetHotelGeoCandidateUseCase } from './get-hotel-geo-candidate.use-case';

describe('GetHotelGeoCandidateUseCase', () => {
  it('returns hotel geo candidate by id', async () => {
    const candidate = {
      _id: new Types.ObjectId(),
    };
    const hotelGeoCandidatesService = {
      findById: jest.fn().mockResolvedValue(candidate),
    };
    const useCase = new GetHotelGeoCandidateUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(useCase.execute(candidate._id.toString())).resolves.toEqual({
      item: candidate,
      ok: true,
    });
    expect(hotelGeoCandidatesService.findById).toHaveBeenCalledWith(
      candidate._id.toString(),
    );
  });

  it('throws when candidate is missing', async () => {
    const hotelGeoCandidatesService = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const useCase = new GetHotelGeoCandidateUseCase(
      hotelGeoCandidatesService as unknown as HotelGeoCandidatesService,
    );

    await expect(useCase.execute(new Types.ObjectId().toString()))
      .rejects.toBeInstanceOf(HotelGeoCandidateNotFoundError);
  });
});
