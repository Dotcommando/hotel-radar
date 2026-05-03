import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IPersistedRawHotel } from './types/persisted-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import {
  makeAddressMergeHotelDedupeKey,
  makeNameMatchKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './utils/hotel-identity.util';
import { normalizeHotelCapacity } from './utils/hotel-capacity-normalization.util';

interface IPersistedRawHotelFields extends ICreateRawHotel {
  addressMergeDedupeKey: string;
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

    for (const rawHotel of rawHotels) {
      const persistedRawHotel = this.buildPersistedRawHotel(rawHotel);
      const addressMergeCandidate =
        await this.readComplementaryAddressMergeCandidate(persistedRawHotel);

      if (addressMergeCandidate !== null) {
        if (
          this.hasAddress(addressMergeCandidate.address) &&
          !this.hasAddress(persistedRawHotel.address)
        ) {
          await this.updateExistingRawHotelPreservingAddress(
            addressMergeCandidate._id,
            persistedRawHotel,
          );
          continue;
        }

        await this.updateExistingRawHotel(
          addressMergeCandidate._id,
          persistedRawHotel,
        );
        continue;
      }

      await this.deleteObsoleteReversedCapacityDuplicates(persistedRawHotel);
      await this.upsertStrictRawHotel(persistedRawHotel);
    }

    return rawHotels.length;
  }

  private buildPersistedRawHotel(
    rawHotel: ICreateRawHotel,
  ): IPersistedRawHotelFields {
    const capacity = normalizeHotelCapacity({
      beds: rawHotel.beds,
      rooms: rawHotel.rooms,
    });
    const normalizedRawHotel = {
      ...rawHotel,
      beds: capacity.beds,
      rooms: capacity.rooms,
    };
    const nameNormalized = normalizeHotelName(rawHotel.name);

    return {
      ...normalizedRawHotel,
      addressMergeDedupeKey: makeAddressMergeHotelDedupeKey({
        contacts: normalizedRawHotel.contacts,
        establishmentType: normalizedRawHotel.establishmentType,
        locality: normalizedRawHotel.locality,
        nameNormalized,
        operatorName: normalizedRawHotel.operatorName,
        postcode: normalizedRawHotel.postcode,
        region: normalizedRawHotel.region,
      }),
      nameMatchKey: makeNameMatchKey(nameNormalized),
      nameNormalized,
      strictHotelDedupeKey: makeStrictHotelDedupeKey({
        beds: normalizedRawHotel.beds,
        contacts: normalizedRawHotel.contacts,
        nameNormalized,
        postcode: normalizedRawHotel.postcode,
        rooms: normalizedRawHotel.rooms,
      }),
    };
  }

  private async readComplementaryAddressMergeCandidate(
    rawHotel: IPersistedRawHotelFields,
  ): Promise<IPersistedRawHotel | null> {
    return this.rawHotelModel
      .findOne(this.buildComplementaryAddressMergeFilter(rawHotel))
      .sort({
        _id: 1,
      })
      .exec();
  }

  private buildComplementaryAddressMergeFilter(
    rawHotel: IPersistedRawHotelFields,
  ): Record<string, unknown> {
    return {
      $and: [
        {
          'sourceFile.filename': rawHotel.sourceFile.filename,
        },
        this.buildComplementaryAddressFilter(this.hasAddress(rawHotel.address)),
        {
          $or: [
            {
              addressMergeDedupeKey: rawHotel.addressMergeDedupeKey,
            },
            {
              establishmentType: rawHotel.establishmentType,
              locality: rawHotel.locality,
              nameNormalized: rawHotel.nameNormalized,
              operatorName: rawHotel.operatorName,
              postcode: rawHotel.postcode,
              region: rawHotel.region,
              ...this.buildFirstPhoneFallbackFilter(
                rawHotel.contacts.phones[0] ?? null,
              ),
            },
          ],
        },
      ],
    };
  }

  private buildComplementaryAddressFilter(
    hasAddress: boolean,
  ): Record<string, unknown> {
    if (hasAddress) {
      return {
        $or: [
          {
            address: null,
          },
          {
            address: '',
          },
          {
            address: {
              $exists: false,
            },
          },
        ],
      };
    }

    return {
      address: {
        $exists: true,
        $nin: [null, ''],
      },
    };
  }

  private buildFirstPhoneFallbackFilter(
    firstPhone: string | null,
  ): Record<string, unknown> {
    if (firstPhone === null) {
      return {
        'contacts.phones.0': {
          $exists: false,
        },
      };
    }

    return {
      'contacts.phones.0': firstPhone,
    };
  }

  private async updateExistingRawHotel(
    rawHotelId: Types.ObjectId,
    persistedRawHotel: IPersistedRawHotelFields,
  ): Promise<void> {
    const { createdAt, ...rawHotelFields } = persistedRawHotel;
    void createdAt;

    await this.rawHotelModel
      .updateOne(
        {
          _id: rawHotelId,
        },
        {
          $set: rawHotelFields,
        },
      )
      .exec();
  }

  private async updateExistingRawHotelPreservingAddress(
    rawHotelId: Types.ObjectId,
    persistedRawHotel: IPersistedRawHotelFields,
  ): Promise<void> {
    const { createdAt, ...rawHotelFields } = persistedRawHotel;
    void createdAt;

    await this.rawHotelModel
      .updateOne(
        {
          _id: rawHotelId,
        },
        {
          $set: this.removeAddressField(rawHotelFields),
        },
      )
      .exec();
  }

  private async deleteObsoleteReversedCapacityDuplicates(
    persistedRawHotel: IPersistedRawHotelFields,
  ): Promise<void> {
    const obsoleteStrictHotelDedupeKey =
      this.buildObsoleteReversedCapacityStrictHotelDedupeKey(persistedRawHotel);

    if (obsoleteStrictHotelDedupeKey === null) {
      return;
    }

    await this.rawHotelModel
      .deleteMany({
        'sourceFile.filename': persistedRawHotel.sourceFile.filename,
        strictHotelDedupeKey: obsoleteStrictHotelDedupeKey,
      })
      .exec();
  }

  private buildObsoleteReversedCapacityStrictHotelDedupeKey(
    persistedRawHotel: IPersistedRawHotelFields,
  ): string | null {
    if (
      persistedRawHotel.rooms === null ||
      persistedRawHotel.beds === null ||
      persistedRawHotel.rooms <= 0 ||
      persistedRawHotel.beds <= 0 ||
      persistedRawHotel.rooms >= persistedRawHotel.beds
    ) {
      return null;
    }

    const obsoleteStrictHotelDedupeKey = makeStrictHotelDedupeKey({
      beds: persistedRawHotel.rooms,
      contacts: persistedRawHotel.contacts,
      nameNormalized: persistedRawHotel.nameNormalized,
      postcode: persistedRawHotel.postcode,
      rooms: persistedRawHotel.beds,
    });

    if (
      obsoleteStrictHotelDedupeKey === persistedRawHotel.strictHotelDedupeKey
    ) {
      return null;
    }

    return obsoleteStrictHotelDedupeKey;
  }

  private async upsertStrictRawHotel(
    persistedRawHotel: IPersistedRawHotelFields,
  ): Promise<void> {
    const { createdAt, ...rawHotelFields } = persistedRawHotel;
    const setFields = this.hasAddress(persistedRawHotel.address)
      ? rawHotelFields
      : this.removeAddressField(rawHotelFields);

    await this.rawHotelModel
      .updateOne(
        {
          'sourceFile.filename': persistedRawHotel.sourceFile.filename,
          strictHotelDedupeKey: persistedRawHotel.strictHotelDedupeKey,
        },
        {
          $set: setFields,
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
        {
          upsert: true,
        },
      )
      .exec();
  }

  private removeAddressField(
    rawHotelFields: Omit<IPersistedRawHotelFields, 'createdAt'>,
  ): Record<string, unknown> {
    const { address, ...fieldsWithoutAddress } = rawHotelFields;
    void address;

    return fieldsWithoutAddress;
  }

  private hasAddress(address: string | null): boolean {
    return address !== null && address.trim().length > 0;
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
            returnDocument: 'after',
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
