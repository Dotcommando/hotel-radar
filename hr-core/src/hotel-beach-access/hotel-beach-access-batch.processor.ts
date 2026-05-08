import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { BeachProfilesService } from '../beach-profiles/beach-profiles.service';
import { IBeachProfile } from '../beach-profiles/types/beach-profile.interface';
import { IBeachProfileWithDistance } from '../beach-profiles/types/beach-profile-with-distance.interface';
import { CANONICAL_HOTEL_STATUS } from '../canonical-hotels/constants/canonical-hotel-status.enum';
import { CanonicalHotelsService } from '../canonical-hotels/services/canonical-hotels.service';
import {
  HOTEL_BEACH_ACCESS_ALGORITHM_VERSION,
  HOTEL_BEACH_ACCESS_NEAREST_BEACH_LIMIT,
} from './constants/hotel-beach-access-defaults.constant';
import { HOTEL_BEACH_ACCESS_EDGE_STATUS } from './constants/hotel-beach-access-edge-status.enum';
import { HotelBeachAccessEdgesService } from './hotel-beach-access-edges.service';
import { HotelBeachAccessQueueService } from './hotel-beach-access-queue.service';
import { HotelBeachAccessRunItemsService } from './hotel-beach-access-run-items.service';
import { HotelBeachAccessRunsService } from './hotel-beach-access-runs.service';
import { BeachRoutingTargetPointService } from './services/beach-routing-target-point.service';
import { GeoDistanceService } from './services/geo-distance.service';
import { StraightLineWalkingRouteProvider } from './services/straight-line-walking-route.provider';
import { IGeoPoint } from './types/geo-point.interface';
import { IHotelBeachAccessBatchJobData } from './types/hotel-beach-access-batch-job-data.interface';
import { IHotelBeachAccessRoute } from './types/hotel-beach-access-route.interface';
import { IWalkingRouteProvider } from './types/walking-route-provider.interface';

@Injectable()
export class HotelBeachAccessBatchProcessor {
  constructor(
    private readonly canonicalHotelsService: CanonicalHotelsService,
    private readonly beachProfilesService: BeachProfilesService,
    private readonly runsService: HotelBeachAccessRunsService,
    private readonly runItemsService: HotelBeachAccessRunItemsService,
    private readonly edgesService: HotelBeachAccessEdgesService,
    private readonly queueService: HotelBeachAccessQueueService,
    private readonly targetPointService: BeachRoutingTargetPointService,
    private readonly routeProvider: StraightLineWalkingRouteProvider,
    private readonly geoDistanceService: GeoDistanceService,
  ) {}

  async processBatch(data: IHotelBeachAccessBatchJobData): Promise<void> {
    await this.runsService.markRunning(data.runId, data.batchNo);

    const items = await this.runItemsService.claimPendingForRun(
      data.runId,
      data.batchSize,
    );
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        const result = await this.processHotel(
          data.runId,
          item.canonicalHotelId,
        );

        if (result === 'skipped') {
          await this.runItemsService.markSkipped(
            item._id,
            'Hotel is no longer active or does not have geo point.',
          );
          skipped += 1;
          continue;
        }

        if (result === 'failed') {
          await this.runItemsService.markFailed(
            item._id,
            'No walking route could be calculated.',
          );
          failed += 1;
          continue;
        }

        await this.runItemsService.markComputed(item._id);
        processed += 1;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown hotel beach access processing error';

        await this.runItemsService.markFailed(item._id, message);
        failed += 1;
      }
    }

    await this.runsService.incrementStats(data.runId, {
      failed,
      processed,
      skipped,
    });

    const pendingCount = await this.runItemsService.countPending(data.runId);

    if (pendingCount > 0) {
      await this.queueService.addBatch({
        batchNo: data.batchNo + 1,
        batchSize: data.batchSize,
        runId: data.runId,
      });
      return;
    }

    await this.runsService.complete(data.runId);
  }

  private async processHotel(
    runId: string,
    canonicalHotelId: Types.ObjectId,
  ): Promise<'computed' | 'failed' | 'skipped'> {
    const hotel = await this.canonicalHotelsService.findById(
      canonicalHotelId.toString(),
    );

    if (
      hotel === null ||
      hotel.status !== CANONICAL_HOTEL_STATUS.ACTIVE ||
      hotel.geo.point === null
    ) {
      return 'skipped';
    }

    const hotelPoint = hotel.geo.point;
    const beaches = await this.beachProfilesService.findNearestActiveProfiles(
      hotelPoint,
      HOTEL_BEACH_ACCESS_NEAREST_BEACH_LIMIT,
    );
    let computedEdges = 0;

    for (const beach of beaches) {
      const routes = await this.calculateRoutesForBeach(
        this.routeProvider,
        hotelPoint,
        beach,
      );
      const now = new Date();
      const bestRoute = routes[0] ?? null;
      const straightDistanceMeters =
        typeof beach.distanceMeters === 'number'
          ? Math.round(beach.distanceMeters)
          : this.geoDistanceService.calculateMeters(hotelPoint, beach.point);

      await this.edgesService.upsertEdge({
        algorithmVersion: HOTEL_BEACH_ACCESS_ALGORITHM_VERSION,
        beachPoint: beach.point,
        beachProfileId: beach._id,
        bestRoute,
        canonicalHotelId,
        computedAt: now,
        error: bestRoute === null ? 'No walking route found.' : null,
        hotelPoint,
        routeAlternatives: routes.slice(1, 3),
        runId,
        status:
          bestRoute === null
            ? HOTEL_BEACH_ACCESS_EDGE_STATUS.FAILED
            : HOTEL_BEACH_ACCESS_EDGE_STATUS.COMPUTED,
        straightDistanceMeters,
        walkingDistanceMeters: bestRoute?.walkingDistanceMeters ?? null,
        walkingDurationSeconds: bestRoute?.walkingDurationSeconds ?? null,
      });

      if (bestRoute !== null) {
        computedEdges += 1;
      }
    }

    return computedEdges > 0 ? 'computed' : 'failed';
  }

  private async calculateRoutesForBeach(
    routeProvider: IWalkingRouteProvider,
    hotelPoint: IGeoPoint,
    beach: IBeachProfileWithDistance | IBeachProfile,
  ): Promise<IHotelBeachAccessRoute[]> {
    const targetPoints = this.targetPointService.buildTargetPoints(
      beach,
      hotelPoint,
    );
    const routes: IHotelBeachAccessRoute[] = [];

    for (const targetPoint of targetPoints) {
      const route = await routeProvider.calculateWalkingRoute({
        origin: hotelPoint,
        target: targetPoint.point,
      });

      if (route === null) {
        continue;
      }

      routes.push({
        geometry: route.geometry,
        originPoint: hotelPoint,
        targetPoint,
        walkingDistanceMeters: route.distanceMeters,
        walkingDurationSeconds: route.durationSeconds,
      });
    }

    return routes.sort(
      (first, second) =>
        first.walkingDistanceMeters - second.walkingDistanceMeters,
    );
  }
}
