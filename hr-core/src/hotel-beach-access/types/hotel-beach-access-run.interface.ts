import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';
import { IHotelBeachAccessRunStats } from './hotel-beach-access-run-stats.interface';

export interface IHotelBeachAccessRun {
  runId: string;
  activeLock: string | null;
  status: HOTEL_BEACH_ACCESS_RUN_STATUS;
  batchSize: number;
  currentBatch: number;
  stats: IHotelBeachAccessRunStats;
  ineligibleHotelsWithoutGeo: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
