import { Injectable } from '@nestjs/common';
import { HotelBeachAccessEdgesService } from '../hotel-beach-access-edges.service';
import { IHotelBeachAccessEdge } from '../types/hotel-beach-access-edge.interface';

@Injectable()
export class ListHotelBeachesUseCase {
  constructor(private readonly edgesService: HotelBeachAccessEdgesService) {}

  async execute(
    canonicalHotelId: string,
    limit = 20,
  ): Promise<{
    ok: true;
    items: IHotelBeachAccessEdge[];
    limit: number;
  }> {
    const normalizedLimit = this.normalizeLimit(limit);

    return {
      items: await this.edgesService.listByHotel(
        canonicalHotelId,
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
