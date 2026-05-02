import { Injectable } from '@nestjs/common';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
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
      return this.buildNumericSuffixGroupedCandidate(entries);
    }

    if (this.isSafeSameNameMultiTypeGroup(entries)) {
      return this.buildSameNameMultiTypeCandidate(entries);
    }

    if (this.isSafeSameNameSameTypeCollapseGroup(entries)) {
      return this.buildSameNameSameTypeCollapsedCandidate(entries);
    }

    return this.buildSingleCandidate(entries[0]);
  }

  buildAmbiguousBaseCandidate(
    entry: IHotelRegistryEntry,
  ): ICreateCanonicalHotelCandidate {
    return {
      ...this.buildSingleCandidate(entry),
      build: {
        issues: ['ambiguous_base_candidate_matches_numeric_suffix_group'],
        rule: 'single_registry_entry',
        ruleVersion: 1,
      },
      processing: {
        canonicalHotelId: null,
        claimedAt: null,
        error:
          'Ambiguous base candidate matches existing numeric suffix group; manual rule required before canonical creation.',
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      },
      status: CANONICAL_HOTEL_CANDIDATE_STATUS.BLOCKED,
    };
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

  private buildNumericSuffixGroupedCandidate(
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

  private buildSameNameMultiTypeCandidate(
    entries: IHotelRegistryEntry[],
  ): ICreateCanonicalHotelCandidate {
    const sortedEntries = this.sortByNameAndType(entries);
    const bestLocationEntry = this.findBestLocationEntry(sortedEntries);
    const firstEntry = sortedEntries[0];

    return {
      build: {
        issues: [],
        rule: 'same_name_multi_type_same_contacts',
        ruleVersion: 1,
      },
      candidateKey: this.buildSameNameGroupCandidateKey(
        'same_name_multi_type_same_contacts',
        firstEntry,
        sortedEntries,
      ),
      canonicalName: firstEntry.name.original,
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
      contacts: this.mergeContacts(sortedEntries),
      kind: CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX,
      location: this.mergeLocation(bestLocationEntry, sortedEntries),
      operator: this.findBestOperator(bestLocationEntry, sortedEntries),
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

  private buildSameNameSameTypeCollapsedCandidate(
    entries: IHotelRegistryEntry[],
  ): ICreateCanonicalHotelCandidate {
    const sortedEntries = this.sortByNameAndType(entries);
    const bestEntry = this.findBestLocationEntry(sortedEntries);

    return {
      build: {
        issues: this.hasConflictingCapacity(sortedEntries)
          ? ['conflicting_capacity_between_collapsed_duplicates']
          : [],
        rule: 'same_name_same_type_same_contacts_prefer_best_location',
        ruleVersion: 1,
      },
      candidateKey: this.buildSameNameGroupCandidateKey(
        'same_name_same_type_same_contacts_prefer_best_location',
        bestEntry,
        sortedEntries,
      ),
      canonicalName: bestEntry.name.original,
      capacity: {
        beds: bestEntry.capacity.beds,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: bestEntry.capacity.rooms,
      },
      components: [
        {
          beds: bestEntry.capacity.beds,
          establishmentType: bestEntry.establishmentType,
          name: bestEntry.name.original,
          rooms: bestEntry.capacity.rooms,
        },
      ],
      contacts: this.mergeContacts(sortedEntries),
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      location: this.mergeLocation(bestEntry, sortedEntries),
      operator: this.findBestOperator(bestEntry, sortedEntries),
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

  private hasConflictingCapacity(entries: IHotelRegistryEntry[]): boolean {
    const firstEntry = entries[0];

    return entries.some(
      ({ capacity }) =>
        capacity.rooms !== firstEntry.capacity.rooms ||
        capacity.beds !== firstEntry.capacity.beds,
    );
  }

  private buildSameNameGroupCandidateKey(
    rule: string,
    entry: IHotelRegistryEntry,
    entries: IHotelRegistryEntry[],
  ): string {
    return [
      'ccv1',
      'group',
      rule,
      entry.name.normalized,
      this.findBestLocationEntry(entries).location.postcode ?? '',
      this.normalizeText(this.findBestLocationEntry(entries).location.address),
      this.buildContactsKey(this.mergeContacts(entries)),
    ].join('|');
  }

  private mergeContacts(entries: IHotelRegistryEntry[]): IHotelContacts {
    return {
      domains: this.mergeStringArrays(
        entries.map(({ contacts }) => contacts.domains),
      ),
      emails: this.mergeStringArrays(
        entries.map(({ contacts }) => contacts.emails),
      ),
      phones: this.mergeStringArrays(
        entries.map(({ contacts }) => contacts.phones),
      ),
      websites: this.mergeStringArrays(
        entries.map(({ contacts }) => contacts.websites),
      ),
    };
  }

  private mergeStringArrays(values: string[][]): string[] {
    const mergedValues: string[] = [];
    const seenValues = new Set<string>();

    for (const value of values.flat()) {
      if (seenValues.has(value)) {
        continue;
      }

      seenValues.add(value);
      mergedValues.push(value);
    }

    return mergedValues;
  }

  private mergeLocation(
    bestEntry: IHotelRegistryEntry,
    entries: IHotelRegistryEntry[],
  ): IHotelLocation {
    return {
      address: bestEntry.location.address,
      district:
        bestEntry.location.district ??
        this.findFirstLocationValue(entries, 'district'),
      locality:
        bestEntry.location.locality ??
        this.findFirstLocationValue(entries, 'locality'),
      postcode:
        bestEntry.location.postcode ??
        this.findFirstLocationValue(entries, 'postcode'),
    };
  }

  private findFirstLocationValue(
    entries: IHotelRegistryEntry[],
    key: keyof IHotelLocation,
  ): string | null {
    return entries.find(({ location }) => location[key] !== null)?.location[
      key
    ] ?? null;
  }

  private findBestLocationEntry(
    entries: IHotelRegistryEntry[],
  ): IHotelRegistryEntry {
    return entries
      .slice()
      .sort(
        (left, right) =>
          this.getLocationScore(right.location) -
          this.getLocationScore(left.location),
      )[0];
  }

  private getLocationScore(location: IHotelLocation): number {
    let score = 0;

    if (location.postcode !== null) {
      score += 1000;
    }

    if (location.address !== null) {
      score += 100 + location.address.length;
    }

    if (location.locality !== null) {
      score += 10;
    }

    if (location.district !== null) {
      score += 1;
    }

    return score;
  }

  private findBestOperator(
    bestEntry: IHotelRegistryEntry,
    entries: IHotelRegistryEntry[],
  ): string | null {
    return (
      bestEntry.operator ??
      entries.find(({ operator }) => operator !== null)?.operator ??
      null
    );
  }

  private hasSameNonEmptyValue(
    left: string | null,
    right: string | null,
  ): boolean {
    return (
      left !== null
        && right !== null
        && this.normalizeText(left) === this.normalizeText(right)
    );
  }

  private hasCompatibleAddress(
    left: string | null,
    right: string | null,
  ): boolean {
    const normalizedLeft = this.normalizeText(left);
    const normalizedRight = this.normalizeText(right);

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

  private hasArrayOverlap(left: string[], right: string[]): boolean {
    const rightValues = new Set(right);

    return left.some((value) => rightValues.has(value));
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

  private normalizeText(value: string | null): string {
    return value
      ?.normalize('NFKC')
      .replace(/[.,;:()[\]{}]/g, ' ')
      .replace(/[/\\]/g, ' ')
      .replace(/[-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase() ?? '';
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

  private sortByNameAndType(
    entries: IHotelRegistryEntry[],
  ): IHotelRegistryEntry[] {
    return entries.slice().sort((left, right) => {
      const nameCompare = left.name.normalized.localeCompare(
        right.name.normalized,
      );

      if (nameCompare !== 0) {
        return nameCompare;
      }

      return (left.establishmentType ?? '').localeCompare(
        right.establishmentType ?? '',
      );
    });
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
