import { Types } from 'mongoose';
import { HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS } from '../constants/hotel-beach-access-run-item-status.enum';

export interface IHotelBeachAccessRunItem {
  _id: Types.ObjectId;
  runId: string;
  canonicalHotelId: Types.ObjectId;
  status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS;
  claimedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
