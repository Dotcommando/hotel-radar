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
    const targetEntry =
      existingEntry ??
      (await this.readStrongDuplicateRegistryEntry(normalizedRawHotel));
    const targetRegistryKey = targetEntry?.registryKey ?? registryKey;
    const entryFields = this.buildRegistryEntryFields(
      normalizedRawHotel,
      targetRegistryKey,
      targetEntry,
    );
    const now = new Date();

    await this.hotelRegistryEntryModel
      .updateOne(
        {
          registryKey: targetRegistryKey,
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
        registryKey: targetRegistryKey,
      })
      .exec();

    if (entry === null) {
      throw new Error(
        `Failed to upsert hotel registry entry: ${targetRegistryKey}`,
      );
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

    const safeEntries = this.sortByName(entries).filter((candidate) =>
      this.isSafeNumericSuffixPair(entry, candidate),
    );

    if (
      safeEntries.length < 2 ||
      !this.allEntryPairsMatch(safeEntries, (left, right) =>
        this.isSafeNumericSuffixPair(left, right),
      )
    ) {
      return [entry];
    }

    return safeEntries;
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
            HOTEL_PROCESSING_STATUS.PROCESSED,
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
      this.isSafeSameNameSameTypeStrongIdentityCollapseGroup(
        sameNameEntries,
      ) ||
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

  private async readStrongDuplicateRegistryEntry(
    rawHotel: IRawHotel,
  ): Promise<IHotelRegistryEntry | null> {
    const rawContacts = {
      domains: normalizeRegistryDomains([rawHotel.contacts.domain]),
      emails: normalizeRegistryEmails(rawHotel.contacts.emails),
      phones: splitAndNormalizeRegistryPhones(rawHotel.contacts.phones),
      websites: normalizeRegistryWebsites(rawHotel.contacts.websites),
    };
    const contactFilters = this.buildMeaningfulRegistryContactOverlapFilters(
      rawContacts,
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

    return this.hotelRegistryEntryModel
      .findOne({
        $and: [
          {
            'capacity.beds': rawHotel.beds,
            'capacity.rooms': rawHotel.rooms,
            establishmentType: rawHotel.establishmentType,
            'location.district': rawHotel.region,
            'location.postcode': rawHotel.postcode,
            'name.normalized': normalizeRegistryName(rawHotel.nameNormalized),
            operator: rawHotel.operatorName,
            status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
          },
          this.buildCompatibleRegistryAddressFilter(rawHotel.address),
          {
            $or: contactFilters,
          },
        ],
      })
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
      this.isEmptyContacts(entry.contacts) ||
      entry.issues.length > 0
    ) {
      return null;
    }

    return {
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
    };
  }

  private isSafeNumericSuffixPair(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    return (
      left.status === HOTEL_REGISTRY_ENTRY_STATUS.READY &&
      right.status === HOTEL_REGISTRY_ENTRY_STATUS.READY &&
      left.issues.length === 0 &&
      right.issues.length === 0 &&
      left.name.suffix !== null &&
      right.name.suffix !== null &&
      /^\d+[A-Z]?$/.test(left.name.suffix) &&
      /^\d+[A-Z]?$/.test(right.name.suffix) &&
      left.name.baseName === right.name.baseName &&
      left.location.postcode !== null &&
      right.location.postcode !== null &&
      this.hasSameNonEmptyValue(
        left.location.postcode,
        right.location.postcode,
      ) &&
      this.hasCompatibleNumericSuffixLocation(left, right) &&
      this.hasMeaningfulContactOverlap(left, right) &&
      this.hasCompatibleOperator(left, right)
    );
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
    if (entries.length < 2 || !this.hasOneNormalizedName(entries)) {
      return false;
    }

    const establishmentTypes = new Set(
      entries.map(({ establishmentType }) => establishmentType),
    );

    return (
      establishmentTypes.size > 1 &&
      this.allEntriesHaveMeaningfulContactOverlap(entries) &&
      this.allEntriesHaveStrictCompatibleLocation(entries) &&
      this.allEntriesHaveCompatibleOperator(entries)
    );
  }

  private isSafeSameNameSameTypeCollapseGroup(
    entries: IHotelRegistryEntry[],
  ): boolean {
    if (entries.length < 2 || !this.hasOneNormalizedName(entries)) {
      return false;
    }

    const establishmentTypes = new Set(
      entries.map(({ establishmentType }) => establishmentType),
    );

    return (
      establishmentTypes.size === 1 &&
      this.allEntriesHaveMeaningfulContactOverlap(entries) &&
      this.allEntriesHaveStrictCompatibleLocation(entries) &&
      this.allEntriesHaveCompatibleOperator(entries) &&
      this.hasCompatibleCapacityForCollapse(entries)
    );
  }

  private isSafeSameNameSameTypeStrongIdentityCollapseGroup(
    entries: IHotelRegistryEntry[],
  ): boolean {
    if (entries.length < 2 || !this.hasOneNormalizedName(entries)) {
      return false;
    }

    const establishmentTypes = new Set(
      entries.map(({ establishmentType }) => establishmentType),
    );

    return (
      establishmentTypes.size === 1 &&
      this.allEntriesHaveMeaningfulContactOverlap(entries) &&
      this.allEntriesHaveStrongIdentityDuplicateLocation(entries) &&
      this.allEntriesHaveCompatibleOperator(entries) &&
      this.hasExactCapacityForCollapse(entries)
    );
  }

  private hasOneNormalizedName(entries: IHotelRegistryEntry[]): boolean {
    const firstName = entries[0].name.normalized;

    return entries.every(({ name }) => name.normalized === firstName);
  }

  private allEntriesHaveMeaningfulContactOverlap(
    entries: IHotelRegistryEntry[],
  ): boolean {
    return this.allEntryPairsMatch(entries, (left, right) =>
      this.hasMeaningfulContactOverlap(left, right),
    );
  }

  private hasMeaningfulContactOverlap(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    return (
      this.hasArrayOverlap(left.contacts.phones, right.contacts.phones) ||
      this.hasArrayOverlap(left.contacts.emails, right.contacts.emails) ||
      this.hasNonSharedDomainOverlap(
        left.contacts.domains,
        right.contacts.domains,
      ) ||
      this.hasNonSharedWebsiteOverlap(
        left.contacts.websites,
        right.contacts.websites,
      )
    );
  }

  private allEntriesHaveStrictCompatibleLocation(
    entries: IHotelRegistryEntry[],
  ): boolean {
    return this.allEntryPairsMatch(entries, (left, right) =>
      this.hasStrictCompatibleLocation(left, right),
    );
  }

  private hasStrictCompatibleLocation(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    if (
      this.hasConflictingValue(
        left.location.postcode,
        right.location.postcode,
      ) ||
      this.hasConflictingLocality(
        left.location.locality,
        right.location.locality,
      )
    ) {
      return false;
    }

    if (left.location.address !== null && right.location.address !== null) {
      return this.hasCompatibleAddress(
        left.location.address,
        right.location.address,
      );
    }

    return (
      this.hasSameNonEmptyValue(
        left.location.postcode,
        right.location.postcode,
      ) &&
      this.hasSameNonEmptyValue(left.location.locality, right.location.locality)
    );
  }

  private allEntriesHaveStrongIdentityDuplicateLocation(
    entries: IHotelRegistryEntry[],
  ): boolean {
    return this.allEntryPairsMatch(entries, (left, right) =>
      this.hasStrongIdentityDuplicateLocation(left, right),
    );
  }

  private hasStrongIdentityDuplicateLocation(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    if (
      this.hasConflictingValue(
        left.location.postcode,
        right.location.postcode,
      ) ||
      this.hasConflictingValue(
        left.location.district,
        right.location.district,
      )
    ) {
      return false;
    }

    if (left.location.address !== null && right.location.address !== null) {
      return this.hasCompatibleAddress(
        left.location.address,
        right.location.address,
      );
    }

    return this.resolveLocalityFromDistrict(left, right) !== null;
  }

  private resolveLocalityFromDistrict(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): string | null {
    if (left.location.locality === null) {
      return right.location.locality;
    }

    if (
      right.location.locality === null ||
      this.hasCompatibleLocationText(
        left.location.locality,
        right.location.locality,
      )
    ) {
      return left.location.locality;
    }

    const district = left.location.district ?? right.location.district ?? null;
    const normalizedDistrict = normalizeRegistryText(district);
    const normalizedLeftLocality = normalizeRegistryText(left.location.locality);
    const normalizedRightLocality = normalizeRegistryText(
      right.location.locality,
    );
    const districtMatchesLeft =
      normalizedLeftLocality.length > 0 &&
      normalizedDistrict.includes(normalizedLeftLocality);
    const districtMatchesRight =
      normalizedRightLocality.length > 0 &&
      normalizedDistrict.includes(normalizedRightLocality);

    if (districtMatchesLeft && !districtMatchesRight) {
      return left.location.locality;
    }

    if (districtMatchesRight && !districtMatchesLeft) {
      return right.location.locality;
    }

    return null;
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

  private hasExactCapacityForCollapse(entries: IHotelRegistryEntry[]): boolean {
    const firstEntry = entries[0];

    return entries.every(
      ({ capacity }) =>
        capacity.rooms === firstEntry.capacity.rooms &&
        capacity.beds === firstEntry.capacity.beds,
    );
  }

  private hasSameNonEmptyValue(
    left: string | null,
    right: string | null,
  ): boolean {
    return (
      left !== null &&
      right !== null &&
      normalizeRegistryText(left) === normalizeRegistryText(right)
    );
  }

  private hasConflictingValue(
    left: string | null,
    right: string | null,
  ): boolean {
    return (
      left !== null &&
      right !== null &&
      normalizeRegistryText(left) !== normalizeRegistryText(right)
    );
  }

  private hasConflictingLocality(
    left: string | null,
    right: string | null,
  ): boolean {
    if (left === null || right === null) {
      return false;
    }

    return !this.hasCompatibleLocationText(left, right);
  }

  private hasCompatibleNumericSuffixLocation(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    if (
      left.location.locality !== null &&
      right.location.locality !== null &&
      this.hasCompatibleLocationText(
        left.location.locality,
        right.location.locality,
      )
    ) {
      return true;
    }

    if (left.location.address !== null && right.location.address !== null) {
      return this.hasCompatibleAddress(
        left.location.address,
        right.location.address,
      );
    }

    return false;
  }

  private hasCompatibleLocationText(left: string, right: string): boolean {
    const normalizedLeft = this.normalizeLocationTextForCompare(left);
    const normalizedRight = this.normalizeLocationTextForCompare(right);

    return (
      normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft)
    );
  }

  private hasCompatibleAddress(
    left: string | null,
    right: string | null,
  ): boolean {
    const normalizedLeft = this.normalizeAddressForCompare(left);
    const normalizedRight = this.normalizeAddressForCompare(right);

    if (normalizedLeft.length === 0 || normalizedRight.length === 0) {
      return false;
    }

    return (
      normalizedLeft === normalizedRight ||
      normalizedLeft.includes(normalizedRight) ||
      normalizedRight.includes(normalizedLeft) ||
      this.hasCompatibleSameNumberAddress(normalizedLeft, normalizedRight)
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

  private hasNonSharedDomainOverlap(left: string[], right: string[]): boolean {
    const rightDomains = new Set(
      right.map((value) => this.normalizeContactDomain(value)),
    );

    return left
      .map((value) => this.normalizeContactDomain(value))
      .some(
        (domain) =>
          domain.length > 0 &&
          rightDomains.has(domain) &&
          !SHARED_CHAIN_CONTACT_DOMAINS.has(domain),
      );
  }

  private hasNonSharedWebsiteOverlap(left: string[], right: string[]): boolean {
    const rightHosts = new Set(
      right.map((value) => this.normalizeWebsiteHost(value)),
    );

    return left
      .map((value) => this.normalizeWebsiteHost(value))
      .some(
        (host) =>
          host.length > 0 &&
          rightHosts.has(host) &&
          !SHARED_CHAIN_CONTACT_DOMAINS.has(host),
      );
  }

  private allEntriesHaveCompatibleOperator(
    entries: IHotelRegistryEntry[],
  ): boolean {
    return this.allEntryPairsMatch(entries, (left, right) =>
      this.hasCompatibleOperator(left, right),
    );
  }

  private hasCompatibleOperator(
    left: IHotelRegistryEntry,
    right: IHotelRegistryEntry,
  ): boolean {
    if (
      left.operator === null ||
      right.operator === null ||
      this.hasSameNonEmptyValue(left.operator, right.operator)
    ) {
      return true;
    }

    return (
      this.hasArrayOverlap(left.contacts.phones, right.contacts.phones) ||
      this.hasArrayOverlap(left.contacts.emails, right.contacts.emails)
    );
  }

  private normalizeAddressForCompare(value: string | null): string {
    return normalizeRegistryText(value)
      .replace(/\bSTR\b/gu, 'STREET')
      .replace(/\bST\b/gu, 'STREET')
      .replace(/\bAVE\b/gu, 'AVENUE')
      .replace(/\bAV\b/gu, 'AVENUE');
  }

  private normalizeLocationTextForCompare(value: string): string {
    return normalizeRegistryText(value)
      .replace(/\bK\b/gu, 'KATO')
      .replace(/\bP\b/gu, 'PANO');
  }

  private normalizeContactDomain(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^www\./u, '');
  }

  private normalizeWebsiteHost(value: string): string {
    try {
      const url = new URL(value);

      return this.normalizeContactDomain(url.hostname);
    } catch {
      return this.normalizeContactDomain(
        value.replace(/^https?:\/\//u, '').split('/')[0],
      );
    }
  }

  private hasCompatibleSameNumberAddress(left: string, right: string): boolean {
    const leftNumber = this.readLeadingAddressNumber(left);
    const rightNumber = this.readLeadingAddressNumber(right);

    if (
      leftNumber === null ||
      rightNumber === null ||
      leftNumber !== rightNumber
    ) {
      return false;
    }

    const maxLength = Math.max(left.length, right.length);

    if (maxLength === 0) {
      return false;
    }

    return this.calculateLevenshteinDistance(left, right) / maxLength <= 0.25;
  }

  private readLeadingAddressNumber(value: string): string | null {
    return value.match(/^\d+[A-Z]?/u)?.[0] ?? null;
  }

  private calculateLevenshteinDistance(left: string, right: string): number {
    const previousRow = Array.from(
      { length: right.length + 1 },
      (_value, index) => index,
    );

    for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
      let previousDiagonal = previousRow[0];

      previousRow[0] = leftIndex + 1;

      for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
        const previousAbove = previousRow[rightIndex + 1];
        const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;

        previousRow[rightIndex + 1] = Math.min(
          previousRow[rightIndex + 1] + 1,
          previousRow[rightIndex] + 1,
          previousDiagonal + substitutionCost,
        );
        previousDiagonal = previousAbove;
      }
    }

    return previousRow[right.length];
  }

  private allEntryPairsMatch(
    entries: IHotelRegistryEntry[],
    predicate: (
      left: IHotelRegistryEntry,
      right: IHotelRegistryEntry,
    ) => boolean,
  ): boolean {
    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < entries.length;
        rightIndex += 1
      ) {
        if (!predicate(entries[leftIndex], entries[rightIndex])) {
          return false;
        }
      }
    }

    return true;
  }

  private sortByName(entries: IHotelRegistryEntry[]): IHotelRegistryEntry[] {
    return entries.slice().sort((left, right) => {
      const baseNameCompare = left.name.baseName.localeCompare(
        right.name.baseName,
      );

      if (baseNameCompare !== 0) {
        return baseNameCompare;
      }

      const leftSuffixNumber = this.readNumericSuffixNumber(left.name.suffix);
      const rightSuffixNumber = this.readNumericSuffixNumber(right.name.suffix);

      if (
        leftSuffixNumber !== null &&
        rightSuffixNumber !== null &&
        leftSuffixNumber !== rightSuffixNumber
      ) {
        return leftSuffixNumber - rightSuffixNumber;
      }

      const normalizedNameCompare = left.name.normalized.localeCompare(
        right.name.normalized,
      );

      if (normalizedNameCompare !== 0) {
        return normalizedNameCompare;
      }

      return left.registryKey.localeCompare(right.registryKey);
    });
  }

  private readNumericSuffixNumber(value: string | null): number | null {
    if (value === null || !/^\d+[A-Z]?$/.test(value)) {
      return null;
    }

    return Number.parseInt(value, 10);
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
    const rawLocation = {
      address: rawHotel.address,
      district: rawHotel.region,
      locality: rawHotel.locality,
      postcode: rawHotel.postcode,
    };

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
      location: this.mergeLocation(existingEntry?.location ?? null, rawLocation),
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

  private mergeLocation(
    existingLocation: IHotelLocation | null,
    rawLocation: IHotelLocation,
  ): IHotelLocation {
    if (existingLocation === null) {
      return rawLocation;
    }

    return {
      address: existingLocation.address ?? rawLocation.address,
      district: existingLocation.district ?? rawLocation.district,
      locality: this.selectResolvedLocality(
        existingLocation.locality,
        rawLocation.locality,
        rawLocation.district ?? existingLocation.district,
      ),
      postcode: existingLocation.postcode ?? rawLocation.postcode,
    };
  }

  private selectResolvedLocality(
    existingLocality: string | null,
    incomingLocality: string | null,
    district: string | null,
  ): string | null {
    if (existingLocality === null) {
      return incomingLocality;
    }

    if (
      incomingLocality === null ||
      this.hasCompatibleLocationText(existingLocality, incomingLocality)
    ) {
      return existingLocality;
    }

    const normalizedDistrict = normalizeRegistryText(district);
    const normalizedExistingLocality = normalizeRegistryText(existingLocality);
    const normalizedIncomingLocality = normalizeRegistryText(incomingLocality);
    const districtMatchesExisting =
      normalizedExistingLocality.length > 0 &&
      normalizedDistrict.includes(normalizedExistingLocality);
    const districtMatchesIncoming =
      normalizedIncomingLocality.length > 0 &&
      normalizedDistrict.includes(normalizedIncomingLocality);

    if (districtMatchesExisting && !districtMatchesIncoming) {
      return existingLocality;
    }

    if (districtMatchesIncoming && !districtMatchesExisting) {
      return incomingLocality;
    }

    return existingLocality;
  }

  private buildMeaningfulRegistryContactOverlapFilters(
    contacts: IHotelContacts,
  ): Array<Record<string, unknown>> {
    const filters: Array<Record<string, unknown>> = [];

    if (contacts.emails.length > 0) {
      filters.push({
        'contacts.emails': {
          $in: contacts.emails,
        },
      });
    }

    const nonSharedDomains = contacts.domains.filter(
      (domain) => !SHARED_CHAIN_CONTACT_DOMAINS.has(domain),
    );

    if (nonSharedDomains.length > 0) {
      filters.push({
        'contacts.domains': {
          $in: nonSharedDomains,
        },
      });
    }

    const nonSharedWebsites = contacts.websites.filter(
      (website) =>
        !SHARED_CHAIN_CONTACT_DOMAINS.has(this.normalizeWebsiteHost(website)),
    );

    if (nonSharedWebsites.length > 0) {
      filters.push({
        'contacts.websites': {
          $in: nonSharedWebsites,
        },
      });
    }

    return filters;
  }

  private buildCompatibleRegistryAddressFilter(
    address: string | null,
  ): Record<string, unknown> {
    if (address === null || address.trim().length === 0) {
      return {};
    }

    return {
      $or: [
        {
          'location.address': address,
        },
        {
          'location.address': null,
        },
      ],
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
      capacity.rooms !== null &&
      capacity.beds !== null &&
      capacity.rooms > capacity.beds
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
      existingEntry === null ||
      !existingEntry.issues.includes('invalid_capacity') ||
      existingCapacity === null ||
      this.buildCapacityIssues(existingCapacity).includes('invalid_capacity')
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
