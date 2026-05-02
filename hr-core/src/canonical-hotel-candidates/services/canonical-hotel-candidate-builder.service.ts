import { Injectable } from '@nestjs/common';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelRegistryEntry } from '../../hotel-registry-entries/types/hotel-registry-entry.interface';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { ICreateCanonicalHotelCandidate } from '../types/create-canonical-hotel-candidate.interface';

@Injectable()
export class CanonicalHotelCandidateBuilderService {
  buildFromRegistryEntries(
    entries: IHotelRegistryEntry[],
  ): ICreateCanonicalHotelCandidate {
    if (entries.length === 0) {
      throw new Error('Cannot build a canonical candidate from empty entries.');
    }

    if (this.isSafeNumericSuffixGroup(entries)) {
      return this.buildGroupedCandidate(entries);
    }

    return this.buildSingleCandidate(entries[0]);
  }

  private buildSingleCandidate(
    entry: IHotelRegistryEntry,
  ): ICreateCanonicalHotelCandidate {
    return {
      build: {
        issues: [],
        rule: 'single_registry_entry',
        ruleVersion: 1,
      },
      candidateKey: `ccv1|single|${entry.registryKey}`,
      canonicalName: entry.name.original,
      capacity: {
        beds: entry.capacity.beds,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: entry.capacity.rooms,
      },
      components: [
        {
          beds: entry.capacity.beds,
          establishmentType: entry.establishmentType,
          name: entry.name.original,
          rooms: entry.capacity.rooms,
        },
      ],
      contacts: entry.contacts,
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      location: entry.location,
      operator: entry.operator,
      processing: {
        canonicalHotelId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      },
      status: CANONICAL_HOTEL_CANDIDATE_STATUS.READY,
    };
  }

  private buildGroupedCandidate(
    entries: IHotelRegistryEntry[],
  ): ICreateCanonicalHotelCandidate {
    const sortedEntries = this.sortByName(entries);
    const firstEntry = sortedEntries[0];

    return {
      build: {
        issues: [],
        rule: 'numeric_suffix_group',
        ruleVersion: 1,
      },
      candidateKey: this.buildNumericSuffixGroupCandidateKey(firstEntry),
      canonicalName: firstEntry.name.baseName,
      capacity: {
        beds: this.sumNullableNumbers(
          sortedEntries.map(({ capacity }) => capacity.beds),
        ),
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
        rooms: this.sumNullableNumbers(
          sortedEntries.map(({ capacity }) => capacity.rooms),
        ),
      },
      components: sortedEntries.map((entry) => ({
        beds: entry.capacity.beds,
        establishmentType: entry.establishmentType,
        name: entry.name.original,
        rooms: entry.capacity.rooms,
      })),
      contacts: firstEntry.contacts,
      kind: CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX,
      location: firstEntry.location,
      operator: firstEntry.operator,
      processing: {
        canonicalHotelId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      },
      status: CANONICAL_HOTEL_CANDIDATE_STATUS.READY,
    };
  }

  private isSafeNumericSuffixGroup(entries: IHotelRegistryEntry[]): boolean {
    if (entries.length < 2) {
      return false;
    }

    const firstEntry = entries[0];
    const groupKey = this.buildNumericSuffixGroupingKey(firstEntry);

    if (groupKey === null) {
      return false;
    }

    return entries.every((entry) => {
      const entryGroupKey = this.buildNumericSuffixGroupingKey(entry);

      return entryGroupKey !== null && entryGroupKey === groupKey;
    });
  }

  private buildNumericSuffixGroupCandidateKey(
    entry: IHotelRegistryEntry,
  ): string {
    const groupingKey = this.buildNumericSuffixGroupingKey(entry);

    if (groupingKey === null) {
      throw new Error(
        `Cannot build numeric suffix candidate key for ${entry.registryKey}.`,
      );
    }

    return `ccv1|group|numeric_suffix|${groupingKey}`;
  }

  private buildNumericSuffixGroupingKey(
    entry: IHotelRegistryEntry,
  ): string | null {
    if (
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

    return [
      entry.name.baseName,
      entry.location.postcode,
      entry.location.locality.toUpperCase(),
      entry.operator,
      this.buildContactsKey(entry.contacts),
    ].join('|');
  }

  private buildContactsKey(contacts: IHotelContacts): string {
    return [
      this.sortedValuesKey(contacts.domains),
      this.sortedValuesKey(contacts.emails),
      this.sortedValuesKey(contacts.phones),
      this.sortedValuesKey(contacts.websites),
    ].join('|');
  }

  private sortedValuesKey(values: string[]): string {
    return values.slice().sort().join(',');
  }

  private isEmptyContacts(contacts: IHotelContacts): boolean {
    return (
      contacts.domains.length === 0 &&
      contacts.emails.length === 0 &&
      contacts.phones.length === 0 &&
      contacts.websites.length === 0
    );
  }

  private sortByName(entries: IHotelRegistryEntry[]): IHotelRegistryEntry[] {
    return entries.slice().sort((left, right) =>
      left.name.normalized.localeCompare(right.name.normalized),
    );
  }

  private sumNullableNumbers(values: Array<number | null>): number | null {
    if (values.some((value) => value === null)) {
      return null;
    }

    let sum = 0;

    for (const value of values) {
      sum += value ?? 0;
    }

    return sum;
  }
}
