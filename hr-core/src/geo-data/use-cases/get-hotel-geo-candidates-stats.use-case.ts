import { Injectable } from '@nestjs/common';
import { HotelGeoCandidatesService } from '../../hotel-geo-candidates/hotel-geo-candidates.service';
import { IGetHotelGeoCandidatesStatsResult } from '../types/get-hotel-geo-candidates-stats-result.interface';

@Injectable()
export class GetHotelGeoCandidatesStatsUseCase {
  constructor(
    private readonly hotelGeoCandidatesService: HotelGeoCandidatesService,
  ) {}

  async execute(): Promise<IGetHotelGeoCandidatesStatsResult> {
    return {
      ok: true,
      stats: await this.hotelGeoCandidatesService.getStats(),
    };
  }
}
