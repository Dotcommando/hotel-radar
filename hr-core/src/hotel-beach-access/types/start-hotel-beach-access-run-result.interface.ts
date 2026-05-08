import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';

export interface IStartHotelBeachAccessRunResult {
  ok: true;
  runId: string;
  status: HOTEL_BEACH_ACCESS_RUN_STATUS;
  batchSize: number;
  total: number;
  ineligibleHotelsWithoutGeo: number;
}
