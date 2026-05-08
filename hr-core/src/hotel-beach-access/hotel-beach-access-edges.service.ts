import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_BEACH_ACCESS_EDGE_MODEL_NAME } from './constants/hotel-beach-access-edge-model-name.constant';
import { IHotelBeachAccessEdge } from './types/hotel-beach-access-edge.interface';

@Injectable()
export class HotelBeachAccessEdgesService {
  constructor(
    @InjectModel(HOTEL_BEACH_ACCESS_EDGE_MODEL_NAME)
    private readonly edgeModel: Model<IHotelBeachAccessEdge>,
  ) {}

  async upsertEdge(
    edge: Omit<IHotelBeachAccessEdge, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const now = new Date();

    await this.edgeModel
      .updateOne(
        {
          beachProfileId: edge.beachProfileId,
          canonicalHotelId: edge.canonicalHotelId,
        },
        {
          $set: {
            ...edge,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: new Types.ObjectId(),
            createdAt: now,
          },
        },
        {
          upsert: true,
        },
      )
      .exec();
  }

  async listByHotel(
    canonicalHotelId: string,
    limit: number,
  ): Promise<IHotelBeachAccessEdge[]> {
    if (!Types.ObjectId.isValid(canonicalHotelId)) {
      return [];
    }

    return this.edgeModel
      .find({
        canonicalHotelId: new Types.ObjectId(canonicalHotelId),
      })
      .sort({
        walkingDistanceMeters: 1,
        straightDistanceMeters: 1,
        _id: 1,
      })
      .limit(limit)
      .exec();
  }

  async listByBeach(
    beachProfileId: string,
    limit: number,
  ): Promise<IHotelBeachAccessEdge[]> {
    if (!Types.ObjectId.isValid(beachProfileId)) {
      return [];
    }

    return this.edgeModel
      .find({
        beachProfileId: new Types.ObjectId(beachProfileId),
      })
      .sort({
        walkingDistanceMeters: 1,
        straightDistanceMeters: 1,
        _id: 1,
      })
      .limit(limit)
      .exec();
  }
}
