import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { IRawHotel } from '../raw-hotels/types/raw-hotel.interface';
import { normalizeHotelCapacity } from '../raw-hotels/utils/hotel-capacity-normalization.util';
import { normalizeHotelLocation } from '../raw-hotels/utils/hotel-location-normalization.util';
import { HOTEL_REGISTRY_ENTRY_MODEL_NAME } from './constants/hotel-registry-entry-model-name.constant';
import { HOTEL_REGISTRY_ENTRY_STATUS } from './constants/hotel-registry-entry-status.enum';
import { IHotelCapacity } from './types/hotel-capacity.interface';
import { IHotelContacts } from './types/hotel-contacts.interface';
import { IHotelLocation } from './types/hotel-location.interface';
import { IHotelRegistryEntry } from './types/hotel-registry-entry.interface';
import { IHotelRegistryEntryName } from './types/hotel-registry-entry-name.interface';
import { IUpsertHotelRegistryEntryResult } from './types/upsert-hotel-registry-entry-result.interface';
import {
  makeHotelRegistryKey,
  normalizeRegistryDomains,
  normalizeRegistryEmails,
  normalizeRegistryName,
  normalizeRegistryText,
  normalizeRegistryWebsites,
  splitAndNormalizeRegistryPhones,
  splitRegistryNameSuffix,
} from './utils/hotel-registry-normalization.util';

interface IRawHotelDocumentLike extends IRawHotel {
  toObject: () => IRawHotel;
}

@Injectable()
export class HotelRegistryEntriesService {
  constructor(
    @InjectModel(HOTEL_REGISTRY_ENTRY_MODEL_NAME)
    private readonly hotelRegistryEntryModel: Model<IHotelRegistryEntry>,
  ) {}

  async upsertFromRawHotel(
    rawHotel: IRawHotel,
  ): Promise<IUpsertHotelRegistryEntryResult> {
    const rawHotelFields = this.toRawHotelFields(rawHotel);
    const normalizedRawHotel = {
      ...rawHotelFields,
      ...normalizeHotelLocation(rawHotelFields),
    };
    const registryKey = makeHotelRegistryKey({
      address: normalizedRawHotel.address,
      establishmentType: normalizedRawHotel.establishmentType,
      locality: normalizedRawHotel.locality,
      nameNormalized: normalizedRawHotel.nameNormalized,
      postcode: normalizedRawHotel.postcode,
      region: normalizedRawHotel.region,
    });
    const existingEntry = await this.hotelRegistryEntryModel
      .findOne({
        registryKey,
      })
      .exec();
    const entryFields = this.buildRegistryEntryFields(
      normalizedRawHotel,
      registryKey,
      existingEntry,
    );
    const now = new Date();

    await this.hotelRegistryEntryModel
      .updateOne(
        {
          registryKey,
        },
        {
          $set: {
            ...entryFields,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
            processing: {
              canonicalHotelCandidateId: null,
              claimedAt: null,
              error: null,
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

    const entry = await this.hotelRegistryEntryModel
      .findOne({
        registryKey,
      })
      .exec();

    if (entry === null) {
      throw new Error(`Failed to upsert hotel registry entry: ${registryKey}`);
    }

    return {
      entry,
      issues: entryFields.issues,
    };
  }

  async initializeMissingProcessing(): Promise<number> {
    const result = await this.hotelRegistryEntryModel
      .updateMany(
        {
          processing: {
            $exists: false,
          },
        },
        {
          $set: {
            processing: {
              canonicalHotelCandidateId: null,
              claimedAt: null,
              error: null,
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
    const result = await this.hotelRegistryEntryModel
      .updateMany(
        {
          'processing.claimedAt': {
            $lt: staleBefore,
          },
          'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
        },
        {
          $set: {
            'processing.canonicalHotelCandidateId': null,
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
    return this.hotelRegistryEntryModel
      .countDocuments({
        'processing.status': status,
      })
      .exec();
  }

  async claimPendingForRun(
    runId: string,
    batchSize: number,
  ): Promise<IHotelRegistryEntry[]> {
    const claimedAt = new Date();
    const claimedRegistryEntries: IHotelRegistryEntry[] = [];

    for (let index = 0; index < batchSize; index += 1) {
      const registryEntry = await this.hotelRegistryEntryModel
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

      if (registryEntry === null) {
        break;
      }

      claimedRegistryEntries.push(registryEntry);
    }

    return claimedRegistryEntries;
  }

  async readSafeNumericSuffixGroup(
    entry: IHotelRegistryEntry,
  ): Promise<IHotelRegistryEntry[]> {
    const groupingFilter = this.buildSafeNumericSuffixGroupFilter(entry);

    if (groupingFilter === null) {
      return [entry];
    }

    const entries = await this.hotelRegistryEntryModel
      .find(groupingFilter)
      .sort({
        'name.normalized': 1,
      })
      .exec();

    if (entries.length < 2) {
      return [entry];
    }

    return entries;
  }

  async readSafeCanonicalCandidateGroup(
    entry: IHotelRegistryEntry,
  ): Promise<IHotelRegistryEntry[]> {
    const numericSuffixGroup = await this.readSafeNumericSuffixGroup(entry);

    if (numericSuffixGroup.length > 1) {
      return numericSuffixGroup;
    }

    const sameNameEntries = await this.hotelRegistryEntryModel
      .find({
        'name.normalized': entry.name.normalized,
        'processing.status': {
          $in: [
            HOTEL_PROCESSING_STATUS.PENDING,
            HOTEL_PROCESSING_STATUS.CLAIMED,
          ],
        },
        status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
      })
      .sort({
        _id: 1,
      })
      .exec();

    if (
      this.isSafeSameNameMultiTypeGroup(sameNameEntries) ||
      this.isSafeSameNameSameTypeCollapseGroup(sameNameEntries)
    ) {
      return sameNameEntries;
    }

    return [entry];
  }

  async hasCompatibleNumericSuffixGroup(
    entry: IHotelRegistryEntry,
  ): Promise<boolean> {
    if (
      entry.status !== HOTEL_REGISTRY_ENTRY_STATUS.READY ||
      entry.name.suffix !== null ||
      entry.name.baseName.trim().length === 0 ||
      entry.location.postcode === null ||
      this.isEmptyContacts(entry.contacts)
    ) {
      return false;
    }

    const sibling = await this.hotelRegistryEntryModel
      .exists({
        $or: [
          {
            'contacts.domains': {
              $in: entry.contacts.domains,
            },
          },
          {
            'contacts.emails': {
              $in: entry.contacts.emails,
            },
          },
          {
            'contacts.phones': {
              $in: entry.contacts.phones,
            },
          },
        ],
        'location.postcode': entry.location.postcode,
        'name.baseName': entry.name.baseName,
        'name.suffix': {
          $regex: '^\\d+[A-Z]?$',
        },
        'processing.status': {
          $in: [
            HOTEL_PROCESSING_STATUS.PENDING,
            HOTEL_PROCESSING_STATUS.CLAIMED,
            HOTEL_PROCESSING_STATUS.PROCESSED,
          ],
        },
        status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
      })
      .exec();

    return sibling !== null;
  }

  async markProcessed(
    registryEntryId: Types.ObjectId,
    canonicalHotelCandidateId: Types.ObjectId,
    runId: string,
  ): Promise<void> {
    await this.hotelRegistryEntryModel
      .updateOne(
        {
          _id: registryEntryId,
        },
        {
          $set: {
            'processing.canonicalHotelCandidateId': canonicalHotelCandidateId,
            'processing.claimedAt': null,
            'processing.error': null,
            'processing.processedAt': new Date(),
            'processing.runId': runId,
            'processing.status': HOTEL_PROCESSING_STATUS.PROCESSED,
          },
        },
      )
      .exec();
  }

  async markIgnored(
    registryEntryId: Types.ObjectId,
    error: string,
  ): Promise<void> {
    await this.hotelRegistryEntryModel
      .updateOne(
        {
          _id: registryEntryId,
        },
        {
          $set: {
            'processing.claimedAt': null,
            'processing.error': error,
            'processing.processedAt': new Date(),
            'processing.status': HOTEL_PROCESSING_STATUS.IGNORED,
          },
        },
      )
      .exec();
  }

  async markFailed(
    registryEntryId: Types.ObjectId,
    error: string,
  ): Promise<void> {
    await this.hotelRegistryEntryModel
      .updateOne(
        {
          _id: registryEntryId,
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

  private buildSafeNumericSuffixGroupFilter(
    entry: IHotelRegistryEntry,
  ): Record<string, unknown> | null {
    if (
      entry.status !== HOTEL_REGISTRY_ENTRY_STATUS.READY ||
      entry.name.suffix === null ||
      !/^\d+[A-Z]?$/.test(entry.name.suffix) ||
      entry.name.baseName.trim().length === 0 ||
      entry.location.postcode === null ||
      entry.location.locality === null ||
      entry.operator === null ||
      this.isEmptyContacts(entry.contacts) ||
      entry.issues.length > 0
    ) {
      return null;
    }

    return {
      'contacts.domains': entry.contacts.domains,
      'contacts.emails': entry.contacts.emails,
      'contacts.phones': entry.contacts.phones,
      'contacts.websites': entry.contacts.websites,
      'location.locality': entry.location.locality,
      'location.postcode': entry.location.postcode,
      'name.baseName': entry.name.baseName,
      'name.suffix': {
        $regex: '^\\d+[A-Z]?$',
      },
      operator: entry.operator,
      'processing.status': {
        $in: [
          HOTEL_PROCESSING_STATUS.PENDING,
          HOTEL_PROCESSING_STATUS.CLAIMED,
        ],
      },
      status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
    };
  }

  private isEmptyContacts(contacts: IHotelContacts): boolean {
    return (
      contacts.domains.length === 0 &&
      contacts.emails.length === 0 &&
      contacts.phones.length === 0 &&
      contacts.websites.length === 0
    );
  }

  private isSafeSameNameMultiTypeGroup(
    entries: IHotelRegistryEntry[],
  ): boolean {
    if (
      entries.length < 2
        || !this.hasOneNormalizedName(entries)
    ) {
      return false;
    }

    const establishmentTypes = new Set(
      entries.map(({ establishmentType }) => establishmentType),
    );

    return (
      establishmentTypes.size > 1
        && this.allEntriesHaveStrongContactOverlap(entries)
        && this.allEntriesHaveCompatibleLocation(entries)
    );
  }

  private isSafeSameNameSameTypeCollapseGroup(
    entries: IHotelRegistryEntry[],
  ): boolean {
    if (
      entries.length < 2
        || !this.hasOneNormalizedName(entries)
    ) {
      return false;
    }

    const establishmentTypes = new Set(
      entries.map(({ establishmentType }) => establishmentType),
    );

    return (
      establishmentTypes.size === 1
        && this.allEntriesHaveStrongContactOverlap(entries)
        && this.allEntriesHaveCompatibleLocation(entries)
        && this.hasCompatibleCapacityForCollapse(entries)
    );
  }

  private hasOneNormalizedName(entries: IHotelRegistryEntry[]): boolean {
    const firstName = entries[0].name.normalized;

    return entries.every(({ name }) => name.normalized === firstName);
  }

  private allEntriesHaveStrongContactOverlap(
    entries: IHotelRegistryEntry[],
  ): boolean {
    const firstEntry = entries[0];

    return entries.every((entry) =>
      this.hasStrongContactOverlap(firstEntry, entry),
    );
  }

  private hasStrongContactOverlap(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    return (
      this.hasArrayOverlap(left.contacts.phones, right.contacts.phones)
        || this.hasArrayOverlap(left.contacts.emails, right.contacts.emails)
        || this.hasArrayOverlap(left.contacts.domains, right.contacts.domains)
    );
  }

  private allEntriesHaveCompatibleLocation(
    entries: IHotelRegistryEntry[],
  ): boolean {
    const firstEntry = entries[0];

    return entries.every((entry) =>
      this.hasCompatibleLocation(firstEntry, entry),
    );
  }

  private hasCompatibleLocation(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    return (
      this.hasSameNonEmptyValue(
        left.location.postcode,
        right.location.postcode,
      )
        || this.hasCompatibleAddress(
          left.location.address,
          right.location.address,
        )
        || (this.hasSameNonEmptyValue(
          left.location.locality,
          right.location.locality,
        )
          && this.hasSameNonEmptyValue(
            left.location.district,
            right.location.district,
          )
          && this.buildContactsKey(left.contacts) ===
            this.buildContactsKey(right.contacts))
    );
  }

  private hasCompatibleCapacityForCollapse(
    entries: IHotelRegistryEntry[],
  ): boolean {
    const firstEntry = entries[0];

    return entries.every((entry) => {
      if (
        firstEntry.capacity.rooms !== null &&
        entry.capacity.rooms !== null &&
        firstEntry.capacity.rooms !== entry.capacity.rooms
      ) {
        return false;
      }

      if (
        firstEntry.capacity.beds !== null &&
        entry.capacity.beds !== null &&
        Math.abs(firstEntry.capacity.beds - entry.capacity.beds) > 10
      ) {
        return false;
      }

      return true;
    });
  }

  private hasSameNonEmptyValue(
    left: string | null,
    right: string | null,
  ): boolean {
    return (
      left !== null
        && right !== null
        && normalizeRegistryText(left) === normalizeRegistryText(right)
    );
  }

  private hasCompatibleAddress(
    left: string | null,
    right: string | null,
  ): boolean {
    const normalizedLeft = normalizeRegistryText(left);
    const normalizedRight = normalizeRegistryText(right);

    if (
      normalizedLeft.length === 0
        || normalizedRight.length === 0
    ) {
      return false;
    }

    return (
      normalizedLeft === normalizedRight
        || normalizedLeft.includes(normalizedRight)
        || normalizedRight.includes(normalizedLeft)
    );
  }

  private buildContactsKey(contacts: IHotelContacts): string {
    return [
      contacts.domains.slice().sort().join(','),
      contacts.emails.slice().sort().join(','),
      contacts.phones.slice().sort().join(','),
      contacts.websites.slice().sort().join(','),
    ].join('|');
  }

  private hasArrayOverlap(left: string[], right: string[]): boolean {
    const rightValues = new Set(right);

    return left.some((value) => rightValues.has(value));
  }

  private buildRegistryEntryFields(
    rawHotel: IRawHotel,
    registryKey: string,
    existingEntry: IHotelRegistryEntry | null,
  ): {
    capacity: IHotelCapacity;
    contacts: IHotelContacts;
    establishmentType: string | null;
    issues: string[];
    location: IHotelLocation;
    name: IHotelRegistryEntryName;
    operator: string | null;
    registryKey: string;
    status: HOTEL_REGISTRY_ENTRY_STATUS;
  } {
    const nameNormalized = normalizeRegistryName(rawHotel.nameNormalized);
    const nameParts = splitRegistryNameSuffix(nameNormalized);
    const rawCapacity = this.normalizeParsedCapacity({
      beds: rawHotel.beds,
      rooms: rawHotel.rooms,
    });
    const existingCapacity =
      existingEntry === null
        ? null
        : this.normalizeParsedCapacity(existingEntry.capacity);
    const rawIssues = this.buildRawIssues(rawHotel, rawCapacity);
    const capacity = this.mergeCapacity(
      existingCapacity,
      rawCapacity,
      rawIssues,
    );
    const issues = this.mergeIssues(
      this.normalizeExistingIssues(existingEntry, existingCapacity),
      rawIssues,
    );

    return {
      capacity,
      contacts: this.mergeContacts(existingEntry?.contacts ?? null, {
        domains: normalizeRegistryDomains([rawHotel.contacts.domain]),
        emails: normalizeRegistryEmails(rawHotel.contacts.emails),
        phones: splitAndNormalizeRegistryPhones(rawHotel.contacts.phones),
        websites: normalizeRegistryWebsites(rawHotel.contacts.websites),
      }),
      establishmentType: rawHotel.establishmentType,
      issues,
      location: {
        address: rawHotel.address,
        district: rawHotel.region,
        locality: rawHotel.locality,
        postcode: rawHotel.postcode,
      },
      name: {
        baseName: nameParts.baseName,
        normalized: nameNormalized,
        original: rawHotel.name,
        suffix: nameParts.suffix,
      },
      operator: rawHotel.operatorName,
      registryKey,
      status:
        issues.length === 0
          ? HOTEL_REGISTRY_ENTRY_STATUS.READY
          : HOTEL_REGISTRY_ENTRY_STATUS.BLOCKED,
    };
  }

  private buildRawIssues(
    rawHotel: IRawHotel,
    rawCapacity: IHotelCapacity,
  ): string[] {
    const issues: string[] = [];

    if (normalizeRegistryName(rawHotel.nameNormalized) === '') {
      issues.push('missing_name');
    }

    if (
      normalizeRegistryText(rawHotel.region) === '' &&
      normalizeRegistryText(rawHotel.locality) === '' &&
      normalizeRegistryText(rawHotel.postcode) === '' &&
      normalizeRegistryText(rawHotel.address) === ''
    ) {
      issues.push('missing_required_identity_fields');
    }

    return this.mergeIssues(issues, this.buildCapacityIssues(rawCapacity));
  }

  private buildCapacityIssues(capacity: IHotelCapacity): string[] {
    const issues: string[] = [];

    if (capacity.rooms !== null && capacity.rooms <= 0) {
      issues.push('invalid_capacity');
    }

    if (capacity.beds !== null && capacity.beds <= 0) {
      issues.push('invalid_capacity');
    }

    if (
      capacity.rooms !== null
        && capacity.beds !== null
        && capacity.rooms > capacity.beds
    ) {
      issues.push('invalid_capacity');
    }

    return this.mergeIssues([], issues);
  }

  private normalizeExistingIssues(
    existingEntry: IHotelRegistryEntry | null,
    existingCapacity: IHotelCapacity | null,
  ): string[] {
    if (
      existingEntry === null
        || !existingEntry.issues.includes('invalid_capacity')
        || existingCapacity === null
        || this.buildCapacityIssues(existingCapacity).includes(
          'invalid_capacity',
        )
    ) {
      return existingEntry?.issues ?? [];
    }

    return existingEntry.issues.filter((issue) => issue !== 'invalid_capacity');
  }

  private normalizeParsedCapacity(rawCapacity: IHotelCapacity): IHotelCapacity {
    return normalizeHotelCapacity(rawCapacity);
  }

  private toRawHotelFields(rawHotel: IRawHotel): IRawHotel {
    if (this.isRawHotelDocumentLike(rawHotel)) {
      return rawHotel.toObject();
    }

    return rawHotel;
  }

  private isRawHotelDocumentLike(
    rawHotel: IRawHotel,
  ): rawHotel is IRawHotelDocumentLike {
    return 'toObject' in rawHotel && typeof rawHotel.toObject === 'function';
  }

  private mergeCapacity(
    existingCapacity: IHotelCapacity | null,
    rawCapacity: IHotelCapacity,
    issues: string[],
  ): IHotelCapacity {
    if (issues.includes('invalid_capacity')) {
      return existingCapacity ?? rawCapacity;
    }

    if (existingCapacity === null) {
      return rawCapacity;
    }

    if (
      this.isCompleteCapacity(rawCapacity) &&
      !this.isCompleteCapacity(existingCapacity)
    ) {
      return rawCapacity;
    }

    if (
      !this.isCompleteCapacity(rawCapacity) &&
      this.isCompleteCapacity(existingCapacity)
    ) {
      return existingCapacity;
    }

    if (
      this.isCompleteCapacity(rawCapacity) &&
      this.isCompleteCapacity(existingCapacity)
    ) {
      if (
        rawCapacity.rooms !== existingCapacity.rooms ||
        rawCapacity.beds !== existingCapacity.beds
      ) {
        issues.push('conflicting_capacity_between_raw_duplicates');
      }

      return existingCapacity;
    }

    return {
      beds: existingCapacity.beds ?? rawCapacity.beds,
      rooms: existingCapacity.rooms ?? rawCapacity.rooms,
    };
  }

  private mergeContacts(
    existingContacts: IHotelContacts | null,
    rawContacts: IHotelContacts,
  ): IHotelContacts {
    return {
      domains: this.mergeSortedStrings(
        existingContacts?.domains ?? [],
        rawContacts.domains,
      ),
      emails: this.mergeSortedStrings(
        existingContacts?.emails ?? [],
        rawContacts.emails,
      ),
      phones: this.mergeSortedStrings(
        existingContacts?.phones ?? [],
        rawContacts.phones,
      ),
      websites: this.mergeSortedStrings(
        existingContacts?.websites ?? [],
        rawContacts.websites,
      ),
    };
  }

  private mergeIssues(existingIssues: string[], newIssues: string[]): string[] {
    return this.mergeSortedStrings(existingIssues, newIssues);
  }

  private mergeSortedStrings(left: string[], right: string[]): string[] {
    return [...new Set([...left, ...right])].sort((first, second) =>
      first.localeCompare(second),
    );
  }

  private isCompleteCapacity(capacity: IHotelCapacity): boolean {
    return capacity.rooms !== null && capacity.beds !== null;
  }
}
