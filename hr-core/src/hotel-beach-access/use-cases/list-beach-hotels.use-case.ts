import { Injectable } from '@nestjs/common';
import { HotelBeachAccessEdgesService } from '../hotel-beach-access-edges.service';
import { IHotelBeachAccessEdge } from '../types/hotel-beach-access-edge.interface';

@Injectable()
export class ListBeachHotelsUseCase {
  constructor(private readonly edgesService: HotelBeachAccessEdgesService) {}

  async execute(
    beachProfileId: string,
    limit = 20,
  ): Promise<{
    ok: true;
    items: IHotelBeachAccessEdge[];
    limit: number;
  }> {
    const normalizedLimit = this.normalizeLimit(limit);

    return {
      items: await this.edgesService.listByBeach(
        beachProfileId,
        normalizedLimit,
      ),
      limit: normalizedLimit,
      ok: true,
    };
  }

  private normalizeLimit(limit: number): number {
    return Math.min(Math.max(limit, 1), 100);
  }
}
