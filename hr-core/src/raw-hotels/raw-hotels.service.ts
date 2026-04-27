import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';

@Injectable()
export class RawHotelsService {
  constructor(
    @InjectModel(RAW_HOTEL_MODEL_NAME)
    private readonly rawHotelModel: Model<IRawHotel>,
  ) {}

  async createMany(rawHotels: ICreateRawHotel[]): Promise<IRawHotel[]> {
    if (rawHotels.length === 0) {
      return [];
    }

    return this.rawHotelModel.insertMany(rawHotels, { ordered: true });
  }

  async upsertManyByNameNormalizedAndSourceFileName(
    rawHotels: ICreateRawHotel[],
  ): Promise<number> {
    if (rawHotels.length === 0) {
      return 0;
    }

    await this.rawHotelModel.bulkWrite(
      rawHotels.map((rawHotel) => {
        const {
          createdAt,
          ...rawHotelFields
        } = rawHotel;

        return {
          updateOne: {
            filter: {
              'sourceFile.filename': rawHotel.sourceFile.filename,
              nameNormalized: rawHotel.nameNormalized,
            },
            update: {
              $set: rawHotelFields,
              $setOnInsert: {
                createdAt: createdAt ?? new Date(),
              },
            },
            upsert: true,
          },
        };
      }),
      { ordered: true },
    );

    return rawHotels.length;
  }

  async readManyBySourceFileNames(sourceFileNames: string[]): Promise<IRawHotel[]> {
    if (sourceFileNames.length === 0) {
      return [];
    }

    return this.rawHotelModel.find({
      'sourceFile.filename': {
        $in: sourceFileNames,
      },
    }).exec();
  }

  async readManyBySourceFileNamesAndCreatedAtFrom(
    sourceFileNames: string[],
    createdAtFrom: Date,
  ): Promise<IRawHotel[]> {
    if (sourceFileNames.length === 0) {
      return [];
    }

    return this.rawHotelModel.find({
      'sourceFile.filename': {
        $in: sourceFileNames,
      },
      createdAt: {
        $gte: createdAtFrom,
      },
    }).exec();
  }

  async deleteManyBySourceFileNames(sourceFileNames: string[]): Promise<number> {
    if (sourceFileNames.length === 0) {
      return 0;
    }

    const deleteResult = await this.rawHotelModel.deleteMany({
      'sourceFile.filename': {
        $in: sourceFileNames,
      },
    }).exec();

    return deleteResult.deletedCount ?? 0;
  }
}
