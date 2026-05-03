import { Injectable } from '@nestjs/common';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../../hotel-registry-entries/constants/hotel-registry-entry-status.enum';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { IHotelLocation } from '../../hotel-registry-entries/types/hotel-location.interface';
import { IHotelRegistryEntry } from '../../hotel-registry-entries/types/hotel-registry-entry.interface';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { ICreateCanonicalHotelCandidate } from '../types/create-canonical-hotel-candidate.interface';

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

    return this.allEntryPairsMatch(entries, (left, right) =>
      this.isSafeNumericSuffixPair(left, right),
    );
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
      this.isEmptyContacts(entry.contacts) ||
      entry.issues.length > 0
    ) {
      return null;
    }

    return [
      entry.name.baseName,
      entry.location.postcode,
      this.normalizeLocationTextForCompare(entry.location.locality),
      entry.operator ?? '',
      this.buildContactsKey(entry.contacts),
    ].join('|');
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
    return [...new Set(values.flat())].sort((left, right) =>
      left.localeCompare(right),
    );
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
    return (
      entries.find(({ location }) => location[key] !== null)?.location[key] ??
      null
    );
  }

  private findBestLocationEntry(
    entries: IHotelRegistryEntry[],
  ): IHotelRegistryEntry {
    return entries.slice().sort((left, right) => {
      const scoreCompare =
        this.getLocationScore(right.location) -
        this.getLocationScore(left.location);

      if (scoreCompare !== 0) {
        return scoreCompare;
      }

      return left.registryKey.localeCompare(right.registryKey);
    })[0];
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
      left !== null &&
      right !== null &&
      this.normalizeText(left) === this.normalizeText(right)
    );
  }

  private hasConflictingValue(
    left: string | null,
    right: string | null,
  ): boolean {
    return (
      left !== null &&
      right !== null &&
      this.normalizeText(left) !== this.normalizeText(right)
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
    return this.normalizeText(value)
      .replace(/\bSTR\b/gu, 'STREET')
      .replace(/\bST\b/gu, 'STREET')
      .replace(/\bAVE\b/gu, 'AVENUE')
      .replace(/\bAV\b/gu, 'AVENUE');
  }

  private normalizeLocationTextForCompare(value: string): string {
    return this.normalizeText(value)
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

  private isEmptyContacts(contacts: IHotelContacts): boolean {
    return (
      contacts.domains.length === 0 &&
      contacts.emails.length === 0 &&
      contacts.phones.length === 0 &&
      contacts.websites.length === 0
    );
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

  private readNumericSuffixNumber(value: string | null): number | null {
    if (value === null || !/^\d+[A-Z]?$/.test(value)) {
      return null;
    }

    return Number.parseInt(value, 10);
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
