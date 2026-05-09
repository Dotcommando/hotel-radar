import { Test } from '@nestjs/testing';
import { BeachRoutingTargetPointService } from './beach-routing-target-point.service';
import { GeoDistanceService } from './geo-distance.service';

describe('BeachRoutingTargetPointService DI', () => {
  it('resolves dependencies through Nest runtime metadata', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BeachRoutingTargetPointService, GeoDistanceService],
    }).compile();

    expect(moduleRef.get(BeachRoutingTargetPointService)).toBeInstanceOf(
      BeachRoutingTargetPointService,
    );

    await moduleRef.close();
  });
});
