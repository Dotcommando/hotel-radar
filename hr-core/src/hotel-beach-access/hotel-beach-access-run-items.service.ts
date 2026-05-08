import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_BEACH_ACCESS_RUN_ITEM_MODEL_NAME } from './constants/hotel-beach-access-run-item-model-name.constant';
import { HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS } from './constants/hotel-beach-access-run-item-status.enum';
import { IHotelBeachAccessRunItem } from './types/hotel-beach-access-run-item.interface';

@Injectable()
export class HotelBeachAccessRunItemsService {
  constructor(
    @InjectModel(HOTEL_BEACH_ACCESS_RUN_ITEM_MODEL_NAME)
    private readonly runItemModel: Model<IHotelBeachAccessRunItem>,
  ) {}

  async createPendingItems(
    runId: string,
    canonicalHotelIds: Types.ObjectId[],
  ): Promise<number> {
    if (canonicalHotelIds.length === 0) {
      return 0;
    }

    const now = new Date();
    const result = await this.runItemModel.insertMany(
      canonicalHotelIds.map((canonicalHotelId) => ({
        _id: new Types.ObjectId(),
        canonicalHotelId,
        claimedAt: null,
        createdAt: now,
        error: null,
        finishedAt: null,
        runId,
        status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.PENDING,
        updatedAt: now,
      })),
      {
        ordered: false,
      },
    );

    return result.length;
  }

  async claimPendingForRun(
    runId: string,
    limit: number,
  ): Promise<IHotelBeachAccessRunItem[]> {
    const claimed: IHotelBeachAccessRunItem[] = [];

    for (let index = 0; index < limit; index += 1) {
      const now = new Date();
      const item = await this.runItemModel
        .findOneAndUpdate(
          {
            runId,
            status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.PENDING,
          },
          {
            $set: {
              claimedAt: now,
              status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.CLAIMED,
              updatedAt: now,
            },
          },
          {
            returnDocument: 'after',
            sort: {
              _id: 1,
            },
          },
        )
        .exec();

      if (item === null) {
        break;
      }

      claimed.push(item);
    }

    return claimed;
  }

  async countPending(runId: string): Promise<number> {
    return this.runItemModel
      .countDocuments({
        runId,
        status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.PENDING,
      })
      .exec();
  }

  async markComputed(id: Types.ObjectId): Promise<void> {
    await this.markFinished(id, HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.COMPUTED);
  }

  async markFailed(id: Types.ObjectId, error: string): Promise<void> {
    await this.markFinished(id, HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.FAILED, error);
  }

  async markSkipped(id: Types.ObjectId, error: string): Promise<void> {
    await this.markFinished(
      id,
      HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS.SKIPPED,
      error,
    );
  }

  private async markFinished(
    id: Types.ObjectId,
    status: HOTEL_BEACH_ACCESS_RUN_ITEM_STATUS,
    error: string | null = null,
  ): Promise<void> {
    await this.runItemModel
      .updateOne(
        {
          _id: id,
        },
        {
          $set: {
            error,
            finishedAt: new Date(),
            status,
            updatedAt: new Date(),
          },
        },
      )
      .exec();
  }
}
