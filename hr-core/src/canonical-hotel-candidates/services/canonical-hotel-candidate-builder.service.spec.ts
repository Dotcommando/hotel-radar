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

    const result = service.buildFromRegistryEntries([
      secondEntry,
      firstEntry,
    ]);

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

    const result = service.buildFromRegistryEntries([
      firstEntry,
      secondEntry,
    ]);

    expect(result.candidateKey).toBe('ccv1|single|tsokkos-gardens-hotel');
    expect(result.kind).toBe(CANONICAL_HOTEL_KIND.SINGLE_PROPERTY);
  });
});
