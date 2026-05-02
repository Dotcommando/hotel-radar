import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { IRawHotel } from '../raw-hotels/types/raw-hotel.interface';
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

@Injectable()
export class HotelRegistryEntriesService {
  constructor(
    @InjectModel(HOTEL_REGISTRY_ENTRY_MODEL_NAME)
    private readonly hotelRegistryEntryModel: Model<IHotelRegistryEntry>,
  ) {}

  async upsertFromRawHotel(
    rawHotel: IRawHotel,
  ): Promise<IUpsertHotelRegistryEntryResult> {
    const registryKey = makeHotelRegistryKey({
      address: rawHotel.address,
      establishmentType: rawHotel.establishmentType,
      locality: rawHotel.locality,
      nameNormalized: rawHotel.nameNormalized,
      postcode: rawHotel.postcode,
      region: rawHotel.region,
    });
    const existingEntry = await this.hotelRegistryEntryModel
      .findOne({
        registryKey,
      })
      .exec();
    const entryFields = this.buildRegistryEntryFields(
      rawHotel,
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
    const rawIssues = this.buildRawIssues(rawHotel);
    const capacity = this.mergeCapacity(
      existingEntry?.capacity ?? null,
      {
        beds: rawHotel.beds,
        rooms: rawHotel.rooms,
      },
      rawIssues,
    );
    const issues = this.mergeIssues(existingEntry?.issues ?? [], rawIssues);

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

  private buildRawIssues(rawHotel: IRawHotel): string[] {
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

    if (rawHotel.rooms !== null && rawHotel.rooms <= 0) {
      issues.push('invalid_capacity');
    }

    if (rawHotel.beds !== null && rawHotel.beds <= 0) {
      issues.push('invalid_capacity');
    }

    if (
      rawHotel.rooms !== null &&
      rawHotel.beds !== null &&
      rawHotel.rooms > rawHotel.beds
    ) {
      issues.push('invalid_capacity');
    }

    return this.mergeIssues([], issues);
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
