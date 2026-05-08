import { Schema } from 'mongoose';
import { HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS } from '../constants/hotel-beach-access-run-item-status.enum';
import { HOTEL_BEACH_ACCESS_RUN_ITEMS_COLLECTION_NAME } from '../constants/hotel-beach-access-run-items-collection-name.constant';
import { IHotelBeachAccessRunItem } from '../types/hotel-beach-access-run-item.interface';

export const hotelBeachAccessRunItemSchema =
  new Schema<IHotelBeachAccessRunItem>(
    {
      canonicalHotelId: {
        required: true,
        type: Schema.Types.ObjectId,
      },
      claimedAt: {
        default: null,
        required: false,
        type: Date,
      },
      createdAt: {
        default: (): Date => new Date(),
        required: true,
        type: Date,
      },
      error: {
        default: null,
        required: false,
        type: String,
      },
      finishedAt: {
        default: null,
        required: false,
        type: Date,
      },
      runId: {
        required: true,
        type: String,
      },
      status: {
        enum: Object.values(HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS),
        required: true,
        type: String,
      },
      updatedAt: {
        default: (): Date => new Date(),
        required: true,
        type: Date,
      },
    },
    {
      collection: HOTEL_BEACH_ACCESS_RUN_ITEMS_COLLECTION_NAME,
      strict: true,
    },
  );

hotelBeachAccessRunItemSchema.index(
  {
    canonicalHotelId: 1,
    runId: 1,
  },
  {
    unique: true,
  },
);
hotelBeachAccessRunItemSchema.index({ runId: 1, status: 1 });
