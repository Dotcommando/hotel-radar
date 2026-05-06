import { Injectable } from '@nestjs/common';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { HotelGeoCandidateNotFoundError } from '../errors/hotel-geo-candidate-not-found.error';
import { IGetHotelGeoCandidateResult } from '../types/get-hotel-geo-candidate-result.interface';

@Injectable()
export class GetHotelGeoCandidateUseCase {
  constructor(
    private readonly hotelGeoCandidatesService: HotelGeoCandidatesService,
  ) {}

  async execute(id: string): Promise<IGetHotelGeoCandidateResult> {
    const candidate = await this.hotelGeoCandidatesService.findById(id);

    if (candidate === null) {
      throw new HotelGeoCandidateNotFoundError();
    }

    return {
      item: candidate,
      ok: true,
    };
  }
}
