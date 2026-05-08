import { HOTEL_BEACH_ACCESS_RUN_STATUS } from '../constants/hotel-beach-access-run-status.enum';

export interface IGetHotelBeachAccessProgressResult {
  ok: true;
  runId: string | null;
  status: HOTEL_BEACH_ACCESS_RUN_STATUS | null;
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  percent: number;
  ineligibleHotelsWithoutGeo: number;
}
