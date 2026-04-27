import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import {
  makeNameMatchKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './utils/hotel-identity.util';

interface IPersistedRawHotel extends ICreateRawHotel {
  nameMatchKey: string;
  nameNormalized: string;
  strictHotelDedupeKey: string;
}

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

    return this.rawHotelModel.insertMany(
      rawHotels.map((rawHotel) => this.buildPersistedRawHotel(rawHotel)),
      { ordered: true },
    );
  }

  async upsertManyByStrictHotelDedupeKeyAndSourceFileName(
    rawHotels: ICreateRawHotel[],
  ): Promise<number> {
    if (rawHotels.length === 0) {
      return 0;
    }

    await this.rawHotelModel.bulkWrite(
      rawHotels.map((rawHotel) => {
        const persistedRawHotel = this.buildPersistedRawHotel(rawHotel);
        const {
          createdAt,
          ...rawHotelFields
        } = persistedRawHotel;

        return {
          updateOne: {
            filter: {
              'sourceFile.filename': persistedRawHotel.sourceFile.filename,
              strictHotelDedupeKey: persistedRawHotel.strictHotelDedupeKey,
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

  private buildPersistedRawHotel(rawHotel: ICreateRawHotel): IPersistedRawHotel {
    const nameNormalized = normalizeHotelName(rawHotel.name);

    return {
      ...rawHotel,
      nameMatchKey: makeNameMatchKey(nameNormalized),
      nameNormalized,
      strictHotelDedupeKey: makeStrictHotelDedupeKey({
        beds: rawHotel.beds,
        contacts: rawHotel.contacts,
        nameNormalized,
        postcode: rawHotel.postcode,
        rooms: rawHotel.rooms,
      }),
    };
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
