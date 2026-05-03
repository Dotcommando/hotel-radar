import { Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../../hotel-registry-entries/constants/hotel-registry-entry-status.enum';
import { IHotelRegistryEntry } from '../../hotel-registry-entries/types/hotel-registry-entry.interface';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { CanonicalHotelCandidateBuilderService } from './canonical-hotel-candidate-builder.service';

function buildRegistryEntry(
  overrides: Partial<IHotelRegistryEntry>,
): IHotelRegistryEntry {
  return {
    _id: new Types.ObjectId(),
    capacity: {
      beds: 10,
      rooms: 5,
    },
    contacts: {
      domains: ['thalassines.com'],
      emails: ['admin@thalassines.com'],
      phones: ['+35723744866'],
      websites: ['https://www.thalassines.com/'],
    },
    createdAt: new Date('2026-05-02T10:00:00.000Z'),
    establishmentType: 'TOURIST VILLAS',
    issues: [],
    location: {
      address: 'Sotera',
      district: 'AMMOCHOSTOS',
      locality: 'Sotera',
      postcode: '5391',
    },
    name: {
      baseName: 'THALASSINES',
      normalized: 'THALASSINES 10',
      original: 'THALASSINES 10',
      suffix: '10',
    },
    operator: 'Limbus Creations Ltd',
    processing: {
      canonicalHotelCandidateId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    },
    registryKey: 'registry-key-1',
    status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
    updatedAt: new Date('2026-05-02T10:00:00.000Z'),
    ...overrides,
  };
}

interface IExpectedGroupComponent {
  establishmentType: string | null;
  name: string;
}

interface IStableGroupCase {
  baseName: string;
  components: IExpectedGroupComponent[];
  rule: 'numeric_suffix_group' | 'same_name_multi_type_same_contacts';
}

function buildStableGroupEntries(
  groupCase: IStableGroupCase,
): IHotelRegistryEntry[] {
  return groupCase.components.map((component, index) => {
    const suffix =
      groupCase.rule === 'numeric_suffix_group'
        ? (component.name.match(/(?:NO\.\s*)?(\d+[A-Z]?)$/u)?.[1] ?? null)
        : null;

    return buildRegistryEntry({
      capacity: {
        beds: (index + 1) * 2,
        rooms: index + 1,
      },
      contacts: {
        domains: [
          `${groupCase.baseName.toLowerCase().replace(/\s+/g, '')}.test`,
        ],
        emails: [
          `${groupCase.baseName.toLowerCase().replace(/\s+/g, '')}@example.test`,
        ],
        phones: ['+35722000000'],
        websites: [
          `https://www.${groupCase.baseName
            .toLowerCase()
            .replace(/\s+/g, '')}.test/`,
        ],
      },
      establishmentType: component.establishmentType,
      location: {
        address:
          groupCase.rule === 'numeric_suffix_group'
            ? null
            : `1 ${groupCase.baseName} Street`,
        district: 'TEST DISTRICT',
        locality: `${groupCase.baseName} Locality`,
        postcode: '9000',
      },
      name: {
        baseName: groupCase.baseName,
        normalized:
          groupCase.rule === 'numeric_suffix_group'
            ? component.name
            : groupCase.baseName,
        original: component.name,
        suffix,
      },
      operator: `${groupCase.baseName} Ltd`,
      registryKey: `${groupCase.baseName}-${component.name}-${component.establishmentType ?? 'null'}`,
    });
  });
}

function sortExpectedComponents(
  components: IExpectedGroupComponent[],
): IExpectedGroupComponent[] {
  return components.slice().sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);

    if (nameCompare !== 0) {
      return nameCompare;
    }

    return (left.establishmentType ?? '').localeCompare(
      right.establishmentType ?? '',
    );
  });
}

describe('CanonicalHotelCandidateBuilderService', () => {
  let service: CanonicalHotelCandidateBuilderService;

  beforeEach(() => {
    service = new CanonicalHotelCandidateBuilderService();
  });

  it('builds one single-property candidate from one ready registry entry', () => {
    const entry = buildRegistryEntry({
      name: {
        baseName: 'ANASSA',
        normalized: 'ANASSA',
        original: 'ANASSA',
        suffix: null,
      },
      registryKey: 'anassa-registry-key',
    });

    const result = service.buildFromRegistryEntries([entry]);

    expect(result).toEqual({
      build: {
        issues: [],
        rule: 'single_registry_entry',
        ruleVersion: 1,
      },
      candidateKey: 'ccv1|single|anassa-registry-key',
      canonicalName: 'ANASSA',
      capacity: {
        beds: 10,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: 5,
      },
      components: [
        {
          beds: 10,
          establishmentType: 'TOURIST VILLAS',
          name: 'ANASSA',
          rooms: 5,
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
    });
  });

  it('builds one property-complex candidate from a safe numeric suffix group', () => {
    const firstEntry = buildRegistryEntry({
      capacity: {
        beds: 6,
        rooms: 1,
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 10',
        original: 'THALASSINES 10',
        suffix: '10',
      },
      registryKey: 'thalassines-10',
    });
    const secondEntry = buildRegistryEntry({
      capacity: {
        beds: 8,
        rooms: 1,
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 11',
        original: 'THALASSINES 11',
        suffix: '11',
      },
      registryKey: 'thalassines-11',
    });

    const result = service.buildFromRegistryEntries([secondEntry, firstEntry]);

    expect(result.candidateKey).toBe(
      'ccv1|group|numeric_suffix|THALASSINES|5391|SOTERA|Limbus Creations Ltd|thalassines.com|admin@thalassines.com|+35723744866|https://www.thalassines.com/',
    );
    expect(result.canonicalName).toBe('THALASSINES');
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.capacity).toEqual({
      beds: 14,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
      rooms: 2,
    });
    expect(result.components).toEqual([
      {
        beds: 6,
        establishmentType: 'TOURIST VILLAS',
        name: 'THALASSINES 10',
        rooms: 1,
      },
      {
        beds: 8,
        establishmentType: 'TOURIST VILLAS',
        name: 'THALASSINES 11',
        rooms: 1,
      },
    ]);
  });

  it('builds numeric suffix groups deterministically with natural component ordering', () => {
    const entries = [
      buildRegistryEntry({
        location: {
          address: '77 Agias Theklas Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: 'THALASSINES 10',
          original: 'THALASSINES 10',
          suffix: '10',
        },
        registryKey: 'thalassines-10',
      }),
      buildRegistryEntry({
        location: {
          address: '77 Agias Theklas',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: 'THALASSINES 2',
          original: 'THALASSINES 2',
          suffix: '2',
        },
        registryKey: 'thalassines-2',
      }),
      buildRegistryEntry({
        location: {
          address: '77 Agias Theklas Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: 'THALASSINES 7',
          original: 'THALASSINES 7',
          suffix: '7',
        },
        registryKey: 'thalassines-7',
      }),
    ];

    const forwardResult = service.buildFromRegistryEntries(entries);
    const reverseResult = service.buildFromRegistryEntries(
      entries.toReversed(),
    );

    expect(forwardResult.candidateKey).toBe(reverseResult.candidateKey);
    expect(forwardResult.components).toEqual(reverseResult.components);
    expect(forwardResult.components.map(({ name }) => name)).toEqual([
      'THALASSINES 2',
      'THALASSINES 7',
      'THALASSINES 10',
    ]);
    expect(forwardResult.location.address).toBe('77 Agias Theklas Avenue');
  });

  it('does not include standalone base entries in numeric suffix groups', () => {
    const numberedEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 10',
        original: 'THALASSINES 10',
        suffix: '10',
      },
      registryKey: 'thalassines-10',
    });
    const standaloneEntry = buildRegistryEntry({
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      operator: 'Mr Andreas Limbourides',
      registryKey: 'thalassines-base',
    });

    const result = service.buildFromRegistryEntries([
      numberedEntry,
      standaloneEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.candidateKey).toBe('ccv1|single|thalassines-10');
  });

  it('keeps standalone THALASSINES separate from its numeric suffix group', () => {
    const baseEntry = buildRegistryEntry({
      capacity: {
        beds: 64,
        rooms: 11,
      },
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      establishmentType: 'TOURIST VILLAS',
      location: {
        address: '77, Agias Theklas Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5391',
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      operator: 'Mr Andreas Limbourides',
      registryKey: 'thalassines-base',
    });
    const numericEntries = [
      '2',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
    ].map((suffix) =>
      buildRegistryEntry({
        capacity: {
          beds: 6,
          rooms: 1,
        },
        contacts: {
          domains: ['thalassines.com'],
          emails: ['admin@thalassines.com'],
          phones: ['+35723744866'],
          websites: ['https://www.thalassines.com/'],
        },
        establishmentType: 'TOURIST VILLAS',
        location: {
          address:
            suffix === '2' ? '77 Agias Theklas' : '77 Agias Theklas Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: `THALASSINES ${suffix}`,
          original: `THALASSINES ${suffix}`,
          suffix,
        },
        operator: 'Limbus Creations Ltd',
        registryKey: `thalassines-${suffix}`,
      }),
    );

    const singleCandidate = service.buildFromRegistryEntries([baseEntry]);
    const groupCandidate = service.buildFromRegistryEntries(numericEntries);

    expect(singleCandidate.status).toBe(
      CANONICAL_HOTEL_CANDIDATE_STATUS.READY,
    );
    expect(singleCandidate.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(singleCandidate.build).toEqual({
      issues: [],
      rule: 'single_registry_entry',
      ruleVersion: 1,
    });
    expect(singleCandidate.capacity).toEqual({
      beds: 64,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 11,
    });
    expect(singleCandidate.location.locality).toBe('Agia Napa');
    expect(singleCandidate.operator).toBe('Mr Andreas Limbourides');
    expect(singleCandidate.contacts.emails).toEqual([
      'reservations@thalassines.com',
    ]);

    expect(groupCandidate.status).toBe(
      CANONICAL_HOTEL_CANDIDATE_STATUS.READY,
    );
    expect(groupCandidate.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(groupCandidate.build.rule).toBe('numeric_suffix_group');
    expect(groupCandidate.capacity).toEqual({
      beds: 72,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
      rooms: 12,
    });
    expect(groupCandidate.location).toEqual({
      address: '77 Agias Theklas Avenue',
      district: 'SOTERA',
      locality: 'Sotera',
      postcode: '5391',
    });
    expect(groupCandidate.operator).toBe('Limbus Creations Ltd');
    expect(groupCandidate.contacts.emails).toEqual(['admin@thalassines.com']);
    expect(groupCandidate.components).toHaveLength(12);
    expect(groupCandidate.components.map(({ name }) => name)).toEqual([
      'THALASSINES 2',
      'THALASSINES 7',
      'THALASSINES 8',
      'THALASSINES 9',
      'THALASSINES 10',
      'THALASSINES 11',
      'THALASSINES 12',
      'THALASSINES 13',
      'THALASSINES 14',
      'THALASSINES 15',
      'THALASSINES 16',
      'THALASSINES 17',
    ]);
    expect(
      groupCandidate.components.every(
        (component) => component.rooms === 1 && component.beds === 6,
      ),
    ).toBe(true);
  });

  it('groups PALATAKIA numeric suffix entries when Stage 1 preserves suffixes', () => {
    const secondEntry = buildRegistryEntry({
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Kato Drys',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 2',
        original: 'PALATAKIA 2',
        suffix: '2',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-2',
    });
    const thirdEntry = buildRegistryEntry({
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'K. Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 3',
        original: 'PALATAKIA 3',
        suffix: '3',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-3',
    });

    const result = service.buildFromRegistryEntries([thirdEntry, secondEntry]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.build.rule).toBe('numeric_suffix_group');
    expect(result.components.map(({ name }) => name)).toEqual([
      'PALATAKIA 2',
      'PALATAKIA 3',
    ]);
  });

  it('builds one PALATAKIA candidate from latest-like suffix and base artifacts', () => {
    const suffixEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 5,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 2',
        original: 'PALATAKIA 2',
        suffix: '2',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-2-apartments',
    });
    const duplicateBaseEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 5,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Kato Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA',
        original: 'PALATAKIA',
        suffix: null,
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-base-apartments',
    });
    const missingSuffixEntry = buildRegistryEntry({
      capacity: {
        beds: 8,
        rooms: 4,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - HOTELS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'K. Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA',
        original: 'PALATAKIA',
        suffix: null,
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-base-hotels',
    });

    const result = service.buildFromRegistryEntries([
      duplicateBaseEntry,
      missingSuffixEntry,
      suffixEntry,
    ]);

    expect(result.canonicalName).toBe('PALATAKIA');
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.status).toBe(CANONICAL_HOTEL_CANDIDATE_STATUS.READY);
    expect(result.build).toEqual({
      issues: [],
      rule: 'numeric_suffix_group',
      ruleVersion: 1,
    });
    expect(result.capacity).toEqual({
      beds: 18,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
      rooms: 9,
    });
    expect(result.components).toEqual([
      {
        beds: 10,
        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
        name: 'PALATAKIA 2',
        rooms: 5,
      },
      {
        beds: 8,
        establishmentType: 'TRADITIONAL HOUSES - HOTELS',
        name: 'PALATAKIA 3',
        rooms: 4,
      },
    ]);
  });

  it('builds one LITO candidate from a base numeric-series component and suffix entries', () => {
    const baseEntry = buildRegistryEntry({
      capacity: {
        beds: 2,
        rooms: 1,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089', '+35724534630'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Skarinou',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO',
        original: 'LITO',
        suffix: null,
      },
      operator: null,
      registryKey: 'lito-base',
    });
    const secondEntry = buildRegistryEntry({
      capacity: {
        beds: 4,
        rooms: 2,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO 2',
        original: 'LITO 2',
        suffix: '2',
      },
      operator: 'Gei Land Agrotourism Ltd',
      registryKey: 'lito-2',
    });
    const thirdEntry = buildRegistryEntry({
      capacity: {
        beds: 2,
        rooms: 1,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO 3',
        original: 'LITO 3',
        suffix: '3',
      },
      operator: 'Gemi Land Agrotourism Ltd',
      registryKey: 'lito-3',
    });

    const result = service.buildFromRegistryEntries([
      secondEntry,
      baseEntry,
      thirdEntry,
    ]);

    expect(result.canonicalName).toBe('LITO');
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.status).toBe(CANONICAL_HOTEL_CANDIDATE_STATUS.READY);
    expect(result.build).toEqual({
      issues: [],
      rule: 'numeric_suffix_group',
      ruleVersion: 1,
    });
    expect(result.capacity).toEqual({
      beds: 8,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
      rooms: 4,
    });
    expect(result.location).toEqual({
      address: null,
      district: 'LARNACA',
      locality: 'Skarinou',
      postcode: '7731',
    });
    expect(result.contacts.domains).toEqual(['agrotourismincyprus.com']);
    expect(result.contacts.emails).toEqual([
      'info@agrotourismincyprus.com',
    ]);
    expect(result.contacts.phones).toEqual([
      '+35724322089',
      '+35724534630',
    ]);
    expect(result.components).toEqual([
      {
        beds: 2,
        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
        name: 'LITO',
        rooms: 1,
      },
      {
        beds: 4,
        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
        name: 'LITO 2',
        rooms: 2,
      },
      {
        beds: 2,
        establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
        name: 'LITO 3',
        rooms: 1,
      },
    ]);
  });

  it('builds the stable Stage 2 grouped candidates with exact components', () => {
    const groupCases: IStableGroupCase[] = [
      {
        baseName: 'NISSIANA',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'NISSIANA',
          },
          {
            establishmentType: 'HOTEL APARTMENTS',
            name: 'NISSIANA',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'TSOKKOS HOLIDAY',
        components: [
          {
            establishmentType: 'TOURIST APARTMENTS',
            name: 'TSOKKOS HOLIDAY NO. 1',
          },
          {
            establishmentType: 'TOURIST APARTMENTS',
            name: 'TSOKKOS HOLIDAY NO. 2',
          },
        ],
        rule: 'numeric_suffix_group',
      },
      {
        baseName: 'CALLISTO ANNEX',
        components: [
          {
            establishmentType: 'TOURIST APARTMENTS',
            name: 'CALLISTO ANNEX 1',
          },
          {
            establishmentType: 'TOURIST APARTMENTS',
            name: 'CALLISTO ANNEX 2',
          },
        ],
        rule: 'numeric_suffix_group',
      },
      {
        baseName: 'THALASSINES',
        components: [
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 2',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 7',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 8',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 9',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 10',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 11',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 12',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 13',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 14',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 15',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 16',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'THALASSINES 17',
          },
        ],
        rule: 'numeric_suffix_group',
      },
      {
        baseName: 'AKTI BEACH',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'AKTI BEACH',
          },
          {
            establishmentType: 'TOURIST VILLAGES',
            name: 'AKTI BEACH',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'MAYFAIR',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'MAYFAIR',
          },
          {
            establishmentType: 'HOTEL APARTMENTS',
            name: 'MAYFAIR',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'PAPHIESSA',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'PAPHIESSA',
          },
          {
            establishmentType: 'HOTEL APARTMENTS',
            name: 'PAPHIESSA',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'NATURA BEACH',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'NATURA BEACH',
          },
          {
            establishmentType: 'TOURIST VILLAS',
            name: 'NATURA BEACH',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'TO APOKRYFO',
        components: [
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'TO APOKRYFO 1',
          },
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'TO APOKRYFO 2',
          },
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'TO APOKRYFO 3',
          },
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'TO APOKRYFO 4',
          },
        ],
        rule: 'numeric_suffix_group',
      },
      {
        baseName: 'ELIAKON',
        components: [
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'ELIAKON 1',
          },
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'ELIAKON 2',
          },
        ],
        rule: 'numeric_suffix_group',
      },
      {
        baseName: 'ALIATHON RESORT',
        components: [
          {
            establishmentType: 'HOTELS',
            name: 'ALIATHON RESORT',
          },
          {
            establishmentType: 'TOURIST VILLAGES',
            name: 'ALIATHON RESORT',
          },
        ],
        rule: 'same_name_multi_type_same_contacts',
      },
      {
        baseName: 'PALATAKIA',
        components: [
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'PALATAKIA 2',
          },
          {
            establishmentType: 'TRADITIONAL BUILDINGS',
            name: 'PALATAKIA 3',
          },
        ],
        rule: 'numeric_suffix_group',
      },
    ];

    for (const groupCase of groupCases) {
      const entries = buildStableGroupEntries(groupCase);
      const forwardResult = service.buildFromRegistryEntries(entries);
      const reverseResult = service.buildFromRegistryEntries(
        entries.toReversed(),
      );
      const expectedComponents = sortExpectedComponents(groupCase.components);

      expect(forwardResult.candidateKey).toBe(reverseResult.candidateKey);
      expect(forwardResult.components).toEqual(reverseResult.components);
      expect(forwardResult.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
      expect(forwardResult.build.rule).toBe(groupCase.rule);
      expect(
        sortExpectedComponents(
          forwardResult.components.map(({ establishmentType, name }) => ({
            establishmentType,
            name,
          })),
        ),
      ).toEqual(expectedComponents);
    }
  });

  it('keeps shared-chain records separate unless the caller provides a safe group', () => {
    const firstEntry = buildRegistryEntry({
      name: {
        baseName: 'TSOKKOS GARDENS',
        normalized: 'TSOKKOS GARDENS',
        original: 'TSOKKOS GARDENS',
        suffix: null,
      },
      registryKey: 'tsokkos-gardens-hotel',
    });
    const secondEntry = buildRegistryEntry({
      location: {
        address: 'Different address',
        district: 'AMMOCHOSTOS',
        locality: 'Paralimni',
        postcode: '5296',
      },
      name: {
        baseName: 'BOHEMIAN GARDENS',
        normalized: 'BOHEMIAN GARDENS',
        original: 'BOHEMIAN GARDENS',
        suffix: null,
      },
      registryKey: 'bohemian-gardens',
    });

    const result = service.buildFromRegistryEntries([firstEntry, secondEntry]);

    expect(result.candidateKey).toBe('ccv1|single|tsokkos-gardens-hotel');
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
  });

  it('groups same-name multi-type entries with matching contacts into a property complex', () => {
    const hotelEntry = buildRegistryEntry({
      capacity: {
        beds: 266,
        rooms: 133,
      },
      contacts: {
        domains: ['nissianahotel.com'],
        emails: ['nissianahotel@cytanet.com.cy'],
        phones: ['+35723725800'],
        websites: ['https://www.nissianahotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '98, Nissi Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5330',
      },
      name: {
        baseName: 'NISSIANA',
        normalized: 'NISSIANA',
        original: 'NISSIANA',
        suffix: null,
      },
      operator: 'Panayides Bros (Nissi) Ltd',
      registryKey: 'nissiana-hotel',
    });
    const apartmentsEntry = buildRegistryEntry({
      capacity: {
        beds: 52,
        rooms: 21,
      },
      contacts: {
        domains: ['nissianahotel.com'],
        emails: ['nissianahotel@cytanet.com.cy'],
        phones: ['+35723725800'],
        websites: ['https://www.nissianahotel.com/'],
      },
      establishmentType: 'HOTEL APARTMENTS',
      location: {
        address: '98, Nissi Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: null,
      },
      name: {
        baseName: 'NISSIANA',
        normalized: 'NISSIANA',
        original: 'NISSIANA',
        suffix: null,
      },
      operator: 'Panayides Bros (Nissi) Ltd',
      registryKey: 'nissiana-apartments',
    });

    const result = service.buildFromRegistryEntries([
      apartmentsEntry,
      hotelEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.build).toEqual({
      issues: [],
      rule: 'same_name_multi_type_same_contacts',
      ruleVersion: 1,
    });
    expect(result.capacity).toEqual({
      beds: 318,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SUM_COMPONENTS,
      rooms: 154,
    });
    expect(result.location).toEqual(hotelEntry.location);
    expect(result.components).toHaveLength(2);
  });

  it('groups same-name multi-type entries when operators differ but contacts and location match', () => {
    const hotelEntry = buildRegistryEntry({
      contacts: {
        domains: ['paphiessa.com'],
        emails: ['info@paphiessa.com'],
        phones: ['+35726945555'],
        websites: ['https://www.paphiessa.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '2, Agios Filonas Street',
        district: 'PAFOS',
        locality: 'Pafos',
        postcode: '8049',
      },
      name: {
        baseName: 'PAPHIESSA',
        normalized: 'PAPHIESSA',
        original: 'PAPHIESSA',
        suffix: null,
      },
      operator: 'Paphiessa Hotel Ltd',
      registryKey: 'paphiessa-hotel',
    });
    const apartmentsEntry = buildRegistryEntry({
      contacts: {
        domains: ['paphiessa.com'],
        emails: ['info@paphiessa.com'],
        phones: ['+35726945555'],
        websites: ['https://www.paphiessa.com/'],
      },
      establishmentType: 'HOTEL APARTMENTS',
      location: {
        address: '2, Agios Filonas Street',
        district: 'PAFOS',
        locality: 'Pafos',
        postcode: '8049',
      },
      name: {
        baseName: 'PAPHIESSA',
        normalized: 'PAPHIESSA',
        original: 'PAPHIESSA',
        suffix: null,
      },
      operator: 'Different Operator Ltd',
      registryKey: 'paphiessa-apartments',
    });

    const result = service.buildFromRegistryEntries([
      hotelEntry,
      apartmentsEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.build.rule).toBe('same_name_multi_type_same_contacts');
    expect(result.components).toHaveLength(2);
  });

  it('groups same-name multi-type entries with compatible same-number address spelling variants', () => {
    const hotelEntry = buildRegistryEntry({
      contacts: {
        domains: ['aliathonvillage.com'],
        emails: ['info@aliathonresort.com'],
        phones: ['+35726964400'],
        websites: ['https://www.aliathonvillage.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '3, Theas Afroditis Ave',
        district: 'PAPHOS',
        locality: 'Geroskipou',
        postcode: '8204',
      },
      name: {
        baseName: 'ALIATHON RESORT',
        normalized: 'ALIATHON RESORT',
        original: 'ALIATHON RESORT',
        suffix: null,
      },
      operator: null,
      registryKey: 'aliathon-resort-hotel',
    });
    const villageEntry = buildRegistryEntry({
      contacts: {
        domains: ['aliathonvillage.com'],
        emails: ['info@aliathonresort.com'],
        phones: ['+35726964400'],
        websites: ['https://www.aliathonvillage.com/'],
      },
      establishmentType: 'TOURIST VILLAGES',
      location: {
        address: '3, Theas Aphrodites Avenue',
        district: 'PAPHOS',
        locality: 'Geroskipou',
        postcode: '8204',
      },
      name: {
        baseName: 'ALIATHON RESORT',
        normalized: 'ALIATHON RESORT',
        original: 'ALIATHON RESORT',
        suffix: null,
      },
      operator: 'Aliathon Tourist Enterprises Ltd',
      registryKey: 'aliathon-resort-village',
    });

    const result = service.buildFromRegistryEntries([hotelEntry, villageEntry]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.PROPERTY_COMPLEX);
    expect(result.build.rule).toBe('same_name_multi_type_same_contacts');
  });

  it('does not group same-name multi-type entries by shared chain website only', () => {
    const hotelEntry = buildRegistryEntry({
      contacts: {
        domains: ['tsokkos.com'],
        emails: [],
        phones: [],
        websites: ['https://www.tsokkos.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '12, Athinas Street',
        district: 'PARALIMNI',
        locality: 'Paralimni',
        postcode: '5296',
      },
      name: {
        baseName: 'TSOKKOS GARDENS',
        normalized: 'TSOKKOS GARDENS',
        original: 'TSOKKOS GARDENS',
        suffix: null,
      },
      registryKey: 'tsokkos-gardens-hotel',
    });
    const apartmentsEntry = buildRegistryEntry({
      contacts: {
        domains: ['tsokkos.com'],
        emails: [],
        phones: [],
        websites: ['https://www.tsokkos.com/'],
      },
      establishmentType: 'HOTEL APARTMENTS',
      location: {
        address: '12, Athinas Street',
        district: 'PARALIMNI',
        locality: 'Paralimni',
        postcode: '5296',
      },
      name: {
        baseName: 'TSOKKOS GARDENS',
        normalized: 'TSOKKOS GARDENS',
        original: 'TSOKKOS GARDENS',
        suffix: null,
      },
      registryKey: 'tsokkos-gardens-apartments',
    });

    const result = service.buildFromRegistryEntries([
      hotelEntry,
      apartmentsEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.candidateKey).toBe('ccv1|single|tsokkos-gardens-hotel');
  });

  it('does not group same-name multi-type entries when addresses conflict', () => {
    const hotelEntry = buildRegistryEntry({
      contacts: {
        domains: [],
        emails: ['gardens@tsokkos.com'],
        phones: ['+35723833636'],
        websites: [],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '12, Athinas Street',
        district: 'PARALIMNI',
        locality: 'Paralimni',
        postcode: '5296',
      },
      name: {
        baseName: 'TSOKKOS GARDENS',
        normalized: 'TSOKKOS GARDENS',
        original: 'TSOKKOS GARDENS',
        suffix: null,
      },
      registryKey: 'tsokkos-gardens-hotel',
    });
    const apartmentsEntry = buildRegistryEntry({
      contacts: {
        domains: [],
        emails: ['gardens@tsokkos.com'],
        phones: ['+35723833636'],
        websites: [],
      },
      establishmentType: 'HOTEL APARTMENTS',
      location: {
        address: '18, Athinas Street',
        district: 'PARALIMNI',
        locality: 'Paralimni',
        postcode: '5296',
      },
      name: {
        baseName: 'TSOKKOS GARDENS',
        normalized: 'TSOKKOS GARDENS',
        original: 'TSOKKOS GARDENS',
        suffix: null,
      },
      registryKey: 'tsokkos-gardens-apartments',
    });

    const result = service.buildFromRegistryEntries([
      hotelEntry,
      apartmentsEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.candidateKey).toBe('ccv1|single|tsokkos-gardens-hotel');
  });

  it('collapses same-name same-type duplicates without summing capacity', () => {
    const shorterEntry = buildRegistryEntry({
      capacity: {
        beds: 16,
        rooms: 9,
      },
      contacts: {
        domains: [],
        emails: ['nnikos@cytanet.com.cy'],
        phones: ['+35722351288', '+35722952455', '+35799599658'],
        websites: [],
      },
      establishmentType: 'HOTELS WITHOUT STAR',
      location: {
        address: '10, Markou Drakou Street',
        district: 'HILL RESORTS - KALOPANAGIOTIS',
        locality: 'Kalopanagiotis',
        postcode: '2862',
      },
      name: {
        baseName: 'KASTALIA',
        normalized: 'KASTALIA',
        original: 'KASTALIA',
        suffix: null,
      },
      operator: 'Ms Koulla Nicolaou',
      registryKey: 'kastalia-short',
    });
    const fullerEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 9,
      },
      contacts: {
        domains: [],
        emails: ['nnikos@cytanet.com.cy'],
        phones: ['+35722351288', '+35722952455', '+35799599658'],
        websites: [],
      },
      establishmentType: 'HOTELS WITHOUT STAR',
      location: {
        address: '10, Markou Drakou Street 2862, Kalopanagiotis',
        district: 'HILL RESORTS - KALOPANAGIOTIS',
        locality: 'Kalopanagiotis',
        postcode: '2862',
      },
      name: {
        baseName: 'KASTALIA',
        normalized: 'KASTALIA',
        original: 'KASTALIA',
        suffix: null,
      },
      operator: 'Ms Koulla Nicolaou',
      registryKey: 'kastalia-full',
    });

    const result = service.buildFromRegistryEntries([
      shorterEntry,
      fullerEntry,
    ]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.build).toEqual({
      issues: ['conflicting_capacity_between_collapsed_duplicates'],
      rule: 'same_name_same_type_same_contacts_prefer_best_location',
      ruleVersion: 1,
    });
    expect(result.capacity).toEqual({
      beds: 10,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 9,
    });
    expect(result.components).toEqual([
      {
        beds: 10,
        establishmentType: 'HOTELS WITHOUT STAR',
        name: 'KASTALIA',
        rooms: 9,
      },
    ]);
    expect(result.location).toEqual(fullerEntry.location);
  });

  it('collapses same-type strong identity duplicates and resolves locality from district', () => {
    const troodosEntry = buildRegistryEntry({
      capacity: {
        beds: 80,
        rooms: 40,
      },
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: null,
        district: 'HILL RESORTS - TROODOS',
        locality: 'Troodos',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-troodos',
    });
    const limassolEntry = buildRegistryEntry({
      capacity: {
        beds: 80,
        rooms: 40,
      },
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35722673991', '+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: null,
        district: 'HILL RESORTS - TROODOS',
        locality: 'Limassol',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-limassol',
    });

    const forwardResult = service.buildFromRegistryEntries([
      limassolEntry,
      troodosEntry,
    ]);
    const reverseResult = service.buildFromRegistryEntries([
      troodosEntry,
      limassolEntry,
    ]);

    expect(forwardResult.candidateKey).toBe(reverseResult.candidateKey);
    expect(forwardResult.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(forwardResult.build.rule).toBe(
      'same_name_same_type_strong_identity_prefer_best_location',
    );
    expect(forwardResult.location.locality).toBe('Troodos');
    expect(forwardResult.contacts.phones).toEqual([
      '+35722673991',
      '+35725420107',
    ]);
  });

  it('does not collapse same-type strong identity candidates with conflicting addresses', () => {
    const firstEntry = buildRegistryEntry({
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '1 Troodos Road',
        district: 'HILL RESORTS - TROODOS',
        locality: 'Troodos',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-troodos',
    });
    const secondEntry = buildRegistryEntry({
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: '99 Limassol Avenue',
        district: 'HILL RESORTS - TROODOS',
        locality: 'Limassol',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-limassol',
    });

    const result = service.buildFromRegistryEntries([firstEntry, secondEntry]);

    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.build.rule).toBe('single_registry_entry');
    expect(result.candidateKey).toBe('ccv1|single|jubilee-troodos');
  });

  it('blocks an ambiguous base candidate that matches a numeric suffix group', () => {
    const entry = buildRegistryEntry({
      capacity: {
        beds: 64,
        rooms: 11,
      },
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-base',
    });

    const result = service.buildAmbiguousBaseCandidate(entry);

    expect(result.status).toBe(CANONICAL_HOTEL_CANDIDATE_STATUS.BLOCKED);
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
    expect(result.capacity.mode).toBe(
      CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
    );
    expect(result.build.issues).toEqual([
      'ambiguous_base_candidate_matches_numeric_suffix_group',
    ]);
    expect(result.processing.error).toBe(
      'Ambiguous base candidate matches existing numeric suffix group; manual rule required before canonical creation.',
    );
  });
});
