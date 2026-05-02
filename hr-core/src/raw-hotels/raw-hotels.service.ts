import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IPersistedRawHotel } from './types/persisted-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import {
  makeNameMatchKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './utils/hotel-identity.util';

interface IPersistedRawHotelFields extends ICreateRawHotel {
  nameMatchKey: string;
  nameNormalized: string;
  strictHotelDedupeKey: string;
}

@Injectable()
export class RawHotelsService {
  constructor(
    @InjectModel(RAW_HOTEL_MODEL_NAME)
    private readonly rawHotelModel: Model<IPersistedRawHotel>,
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
        const { createdAt, ...rawHotelFields } = persistedRawHotel;

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
                processing: {
                  claimedAt: null,
                  error: null,
                  hotelRegistryEntryId: null,
                  processedAt: null,
                  runId: null,
                  status: HOTEL_PROCESSING_STATUS.PENDING,
                },
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

  private buildPersistedRawHotel(
    rawHotel: ICreateRawHotel,
  ): IPersistedRawHotelFields {
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

  async readManyBySourceFileNames(
    sourceFileNames: string[],
  ): Promise<IRawHotel[]> {
    if (sourceFileNames.length === 0) {
      return [];
    }

    return this.rawHotelModel
      .find({
        'sourceFile.filename': {
          $in: sourceFileNames,
        },
      })
      .exec();
  }

  async readManyBySourceFileNamesAndCreatedAtFrom(
    sourceFileNames: string[],
    createdAtFrom: Date,
  ): Promise<IRawHotel[]> {
    if (sourceFileNames.length === 0) {
      return [];
    }

    return this.rawHotelModel
      .find({
        'sourceFile.filename': {
          $in: sourceFileNames,
        },
        createdAt: {
          $gte: createdAtFrom,
        },
      })
      .exec();
  }

  async deleteManyBySourceFileNames(
    sourceFileNames: string[],
  ): Promise<number> {
    if (sourceFileNames.length === 0) {
      return 0;
    }

    const deleteResult = await this.rawHotelModel
      .deleteMany({
        'sourceFile.filename': {
          $in: sourceFileNames,
        },
      })
      .exec();

    return deleteResult.deletedCount ?? 0;
  }

  async initializeMissingProcessing(): Promise<number> {
    const result = await this.rawHotelModel
      .updateMany(
        {
          processing: {
            $exists: false,
          },
        },
        {
          $set: {
            processing: {
              claimedAt: null,
              error: null,
              hotelRegistryEntryId: null,
              processedAt: null,
              runId: null,
              status: HOTEL_PROCESSING_STATUS.PENDING,
            },
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async recoverStaleClaimedDocuments(staleBefore: Date): Promise<number> {
    const result = await this.rawHotelModel
      .updateMany(
        {
          'processing.claimedAt': {
            $lt: staleBefore,
          },
          'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
        },
        {
          $set: {
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.runId': null,
            'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
          },
        },
      )
      .exec();

    return result.modifiedCount;
  }

  async countByProcessingStatus(
    status: HOTEL_PROCESSING_STATUS,
  ): Promise<number> {
    return this.rawHotelModel
      .countDocuments({
        'processing.status': status,
      })
      .exec();
  }

  async claimPendingForRun(
    runId: string,
    batchSize: number,
  ): Promise<IPersistedRawHotel[]> {
    const claimedAt = new Date();
    const claimedRawHotels: IPersistedRawHotel[] = [];

    for (let index = 0; index < batchSize; index += 1) {
      const rawHotel = await this.rawHotelModel
        .findOneAndUpdate(
          {
            'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
          },
          {
            $set: {
              'processing.claimedAt': claimedAt,
              'processing.error': null,
              'processing.runId': runId,
              'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
            },
          },
          {
            new: true,
            sort: {
              _id: 1,
            },
          },
        )
        .exec();

      if (rawHotel === null) {
        break;
      }

      claimedRawHotels.push(rawHotel);
    }

    return claimedRawHotels;
  }

  async markProcessed(
    rawHotelId: Types.ObjectId,
    hotelRegistryEntryId: Types.ObjectId,
  ): Promise<void> {
    await this.rawHotelModel
      .updateOne(
        {
          _id: rawHotelId,
        },
        {
          $set: {
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.hotelRegistryEntryId': hotelRegistryEntryId,
            'processing.processedAt': new Date(),
            'processing.status': HOTEL_PROCESSING_STATUS.PROCESSED,
          },
        },
      )
      .exec();
  }

  async markFailed(rawHotelId: Types.ObjectId, error: string): Promise<void> {
    await this.rawHotelModel
      .updateOne(
        {
          _id: rawHotelId,
        },
        {
          $set: {
            'processing.claimedAt': null,
            'processing.error': error,
            'processing.processedAt': new Date(),
            'processing.status': HOTEL_PROCESSING_STATUS.FAILED,
          },
        },
      )
      .exec();
  }
}
