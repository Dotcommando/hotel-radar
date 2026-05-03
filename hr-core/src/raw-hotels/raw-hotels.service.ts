import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IPersistedRawHotel } from './types/persisted-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import { IRawHotelContacts } from './types/raw-hotel-contacts.interface';
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

const SHARED_CHAIN_CONTACT_DOMAINS = new Set([
  'atlanticahotels.com',
  'kanikahotels.com',
  'leonardo-hotels-cyprus.com',
  'leonardo-hotels.com',
  'leonardo-hotels.co',
  'louis-hotels.com',
  'louishotels.com',
  'tsokkos.com',
]);

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

      const strongDuplicateCandidate =
        await this.readStrongDuplicateCandidate(persistedRawHotel);

      if (strongDuplicateCandidate !== null) {
        await this.updateExistingStrongDuplicateRawHotel(
          strongDuplicateCandidate,
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

  private async readStrongDuplicateCandidate(
    rawHotel: IPersistedRawHotelFields,
  ): Promise<IPersistedRawHotel | null> {
    const contactFilters = this.buildMeaningfulContactOverlapFilters(
      rawHotel.contacts,
    );

    if (
      contactFilters.length === 0 ||
      rawHotel.rooms === null ||
      rawHotel.beds === null ||
      rawHotel.postcode === null ||
      rawHotel.operatorName === null
    ) {
      return null;
    }

    return this.rawHotelModel
      .findOne({
        $and: [
          {
            'sourceFile.filename': rawHotel.sourceFile.filename,
          },
          {
            beds: rawHotel.beds,
            establishmentType: rawHotel.establishmentType,
            nameNormalized: rawHotel.nameNormalized,
            operatorName: rawHotel.operatorName,
            postcode: rawHotel.postcode,
            region: rawHotel.region,
            rooms: rawHotel.rooms,
          },
          this.buildCompatibleAddressFilter(rawHotel.address),
          {
            $or: contactFilters,
          },
        ],
      })
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

  private async updateExistingStrongDuplicateRawHotel(
    existingRawHotel: IPersistedRawHotel,
    persistedRawHotel: IPersistedRawHotelFields,
  ): Promise<void> {
    const mergedRawHotel = this.buildMergedStrongDuplicateRawHotel(
      existingRawHotel,
      persistedRawHotel,
    );

    await this.updateExistingRawHotel(existingRawHotel._id, mergedRawHotel);
  }

  private buildMergedStrongDuplicateRawHotel(
    existingRawHotel: IPersistedRawHotel,
    persistedRawHotel: IPersistedRawHotelFields,
  ): IPersistedRawHotelFields {
    const selectedLocality = this.selectResolvedLocality({
      existingLocality: existingRawHotel.locality,
      incomingLocality: persistedRawHotel.locality,
      region: persistedRawHotel.region ?? existingRawHotel.region,
    });
    const preferredRawHotel =
      selectedLocality === persistedRawHotel.locality &&
      selectedLocality !== existingRawHotel.locality
        ? persistedRawHotel
        : existingRawHotel;
    const secondaryRawHotel =
      preferredRawHotel === persistedRawHotel
        ? existingRawHotel
        : persistedRawHotel;

    return this.buildPersistedRawHotel({
      address:
        preferredRawHotel.address ??
        secondaryRawHotel.address ??
        persistedRawHotel.address,
      beds: persistedRawHotel.beds,
      classRaw: persistedRawHotel.classRaw ?? existingRawHotel.classRaw,
      contacts: this.mergeRawContacts(
        preferredRawHotel.contacts,
        secondaryRawHotel.contacts,
      ),
      createdAt: persistedRawHotel.createdAt,
      establishmentType: persistedRawHotel.establishmentType,
      licenseStatus: persistedRawHotel.licenseStatus,
      locality: selectedLocality,
      managerName:
        persistedRawHotel.managerName ?? existingRawHotel.managerName,
      name: persistedRawHotel.name,
      nameNormalized: persistedRawHotel.nameNormalized,
      operatorName: persistedRawHotel.operatorName,
      postcode: persistedRawHotel.postcode,
      region: persistedRawHotel.region,
      rooms: persistedRawHotel.rooms,
      sourceFile: persistedRawHotel.sourceFile,
      stars: persistedRawHotel.stars,
      updatedAt: persistedRawHotel.updatedAt,
    });
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

  private buildMeaningfulContactOverlapFilters(
    contacts: IRawHotelContacts,
  ): Array<Record<string, unknown>> {
    const filters: Array<Record<string, unknown>> = [];

    if (contacts.emails.length > 0) {
      filters.push({
        'contacts.emails': {
          $in: contacts.emails,
        },
      });
    }

    if (
      contacts.domain !== null &&
      !SHARED_CHAIN_CONTACT_DOMAINS.has(this.normalizeContactDomain(contacts.domain))
    ) {
      filters.push({
        'contacts.domain': contacts.domain,
      });
    }

    if (contacts.websites.length > 0) {
      filters.push({
        'contacts.websites': {
          $in: contacts.websites,
        },
      });
    }

    return filters;
  }

  private buildCompatibleAddressFilter(
    address: string | null,
  ): Record<string, unknown> {
    if (!this.hasAddress(address)) {
      return {};
    }

    return {
      $or: [
        {
          address,
        },
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

  private selectResolvedLocality(params: {
    existingLocality: string | null;
    incomingLocality: string | null;
    region: string | null;
  }): string | null {
    const region = this.normalizeText(params.region);
    const existingLocality = this.normalizeText(params.existingLocality);
    const incomingLocality = this.normalizeText(params.incomingLocality);

    if (params.existingLocality === null) {
      return params.incomingLocality;
    }

    if (params.incomingLocality === null || existingLocality === incomingLocality) {
      return params.existingLocality;
    }

    const regionMatchesExisting =
      existingLocality.length > 0 && region.includes(existingLocality);
    const regionMatchesIncoming =
      incomingLocality.length > 0 && region.includes(incomingLocality);

    if (regionMatchesExisting && !regionMatchesIncoming) {
      return params.existingLocality;
    }

    if (regionMatchesIncoming && !regionMatchesExisting) {
      return params.incomingLocality;
    }

    return params.existingLocality;
  }

  private mergeRawContacts(
    preferredContacts: IRawHotelContacts,
    secondaryContacts: IRawHotelContacts,
  ): IRawHotelContacts {
    return {
      domain: preferredContacts.domain ?? secondaryContacts.domain,
      emails: this.mergeStringsPreservingPreferredOrder(
        preferredContacts.emails,
        secondaryContacts.emails,
      ),
      faxes: this.mergeStringsPreservingPreferredOrder(
        preferredContacts.faxes,
        secondaryContacts.faxes,
      ),
      phones: this.mergeStringsPreservingPreferredOrder(
        preferredContacts.phones,
        secondaryContacts.phones,
      ),
      websites: this.mergeStringsPreservingPreferredOrder(
        preferredContacts.websites,
        secondaryContacts.websites,
      ),
    };
  }

  private mergeStringsPreservingPreferredOrder(
    preferredValues: string[],
    secondaryValues: string[],
  ): string[] {
    return [...new Set([...preferredValues, ...secondaryValues])];
  }

  private normalizeContactDomain(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^www\./u, '');
  }

  private normalizeText(value: string | null): string {
    return (
      value
        ?.normalize('NFKC')
        .replace(/[.,;:()[\]{}]/g, ' ')
        .replace(/[/\\]/g, ' ')
        .replace(/[-–—]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase() ?? ''
    );
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
