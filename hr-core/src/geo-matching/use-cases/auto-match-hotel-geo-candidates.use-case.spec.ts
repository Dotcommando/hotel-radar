import { Types } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { GEO_MATCH_REASON } from '../constants/geo-match-reason.enum';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualCanonicalHotelGeoParams } from '../types/apply-manual-canonical-hotel-geo-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';
import { AutoMatchHotelGeoCandidatesUseCase } from './auto-match-hotel-geo-candidates.use-case';

describe('AutoMatchHotelGeoCandidatesUseCase', () => {
  it('matches by strong contact and fuzzy name', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'NICOLAS COLOR',
      contacts: {
        domains: ['nicholas.com.cy'],
        emails: ['info@nicholas.com.cy'],
        phones: ['+35723721988'],
        websites: ['https://nicholas.com.cy'],
      },
    });
    const candidate = buildHotelGeoCandidateFixture({
      name: 'Nicholas Color Hotel',
      sourceProperties: {
        name: 'Nicholas Color Hotel',
        phone: '+357 23 721988',
        tourism: 'hotel',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [candidate],
    );
    const useCase = new AutoMatchHotelGeoCandidatesUseCase(repository);

    const result = await useCase.execute({
      dryRun: true,
    });

    expect(result.stats.autoMatched).toBe(1);
    expect(result.matches[0]).toMatchObject({
      action: GEO_MATCH_ACTION.AUTO_MATCHED,
      canonicalHotelId: hotel._id.toString(),
      hotelGeoCandidateId: candidate._id.toString(),
    });
    expect(result.matches[0].reasons).toContain(
      GEO_MATCH_REASON.CONTACT_AND_FUZZY_NAME,
    );
    expect(repository.appliedMatches).toHaveLength(0);
  });

  it('chooses a stronger OSM duplicate when the weaker candidate has lower source evidence', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'GRECIAN PARK',
      contacts: {
        domains: ['grecianpark.com'],
        emails: ['info@grecianpark.com'],
        phones: ['+35723844000'],
        websites: ['https://www.grecianpark.com/'],
      },
    });
    const weakCandidate = buildHotelGeoCandidateFixture({
      _id: new Types.ObjectId('69fae6928833ac8ce429d27f'),
      name: 'Grecian Park',
      source: buildSourceFixture('way/81179328'),
      sourceProperties: {
        name: 'Grecian Park',
        tourism: 'hotel',
        website: 'https://grecianpark.com/',
      },
    });
    const strongCandidate = buildHotelGeoCandidateFixture({
      _id: new Types.ObjectId('69fae6948833ac8ce429d31f'),
      name: 'Grecian Park',
      source: buildSourceFixture('way/199710188'),
      sourceProperties: {
        email: 'info@grecianpark.com',
        name: 'Grecian Park',
        phone: '+357 23 844000',
        tourism: 'hotel',
        website: 'https://www.grecianpark.com/',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [weakCandidate, strongCandidate],
    );
    const useCase = new AutoMatchHotelGeoCandidatesUseCase(repository);

    const result = await useCase.execute({
      dryRun: true,
    });

    expect(result.stats.autoMatched).toBe(1);
    expect(result.matches[0].hotelGeoCandidateId).toBe(
      strongCandidate._id.toString(),
    );
  });

  it('allows shared group contacts only with strong name evidence', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'TSOKKOS PARADISE HOLIDAY VILLAG',
      contacts: {
        domains: ['tsokkos.com'],
        emails: ['reservations@tsokkos.com'],
        phones: [],
        websites: ['https://www.tsokkos.com/'],
      },
    });
    const candidate = buildHotelGeoCandidateFixture({
      name: 'Tsokkos Paradise Village',
      sourceProperties: {
        name: 'Tsokkos Paradise Village',
        tourism: 'hotel',
        website: 'https://www.tsokkos.com/',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [candidate],
    );
    const useCase = new AutoMatchHotelGeoCandidatesUseCase(repository);

    const result = await useCase.execute({
      dryRun: true,
    });

    expect(result.stats.autoMatched).toBe(1);
    expect(result.matches[0].reasons).toContain(
      GEO_MATCH_REASON.SHARED_GROUP_CONTACT_AND_STRONG_NAME,
    );
  });

  it('matches by postcode and strong name evidence', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'LA VERANDA DE LARNACA',
      location: {
        address: 'Michael Aggelou',
        district: 'LARNACA',
        locality: 'Larnaka',
        postcode: '6028',
      },
    });
    const candidate = buildHotelGeoCandidateFixture({
      name: 'La Veranda Hotel',
      sourceProperties: {
        'addr:city': 'Larnaka',
        'addr:postcode': '6028',
        name: 'La Veranda Hotel',
        tourism: 'hotel',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [candidate],
    );
    const useCase = new AutoMatchHotelGeoCandidatesUseCase(repository);

    const result = await useCase.execute({
      dryRun: true,
    });

    expect(result.stats.autoMatched).toBe(1);
    expect(result.matches[0].reasons).toContain(
      GEO_MATCH_REASON.ADDRESS_AND_STRONG_NAME,
    );
  });

  it('does not auto-match tied reduced-name duplicates', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'AVANTI',
    });
    const hotelCandidate = buildHotelGeoCandidateFixture({
      name: 'Avanti Hotel',
      source: buildSourceFixture('node/1'),
      sourceProperties: {
        name: 'Avanti Hotel',
        tourism: 'hotel',
      },
    });
    const villageCandidate = buildHotelGeoCandidateFixture({
      _id: new Types.ObjectId('69fae6968833ac8ce429d6ab'),
      name: 'Avanti Village',
      source: buildSourceFixture('node/2'),
      sourceProperties: {
        name: 'Avanti Village',
        tourism: 'hotel',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [hotelCandidate, villageCandidate],
    );
    const useCase = new AutoMatchHotelGeoCandidatesUseCase(repository);

    const result = await useCase.execute({
      dryRun: true,
    });

    expect(result.stats.autoMatched).toBe(0);
    expect(result.stats.needsReview).toBe(2);
    expect(result.reviewSuggestions).toHaveLength(2);
  });
});

class InMemoryGeoHotelMatchingRepository extends GeoHotelMatchingRepository {
  readonly appliedMatches: IApplyGeoHotelMatchParams[] = [];
  readonly appliedManualCanonicalHotelGeo: IApplyManualCanonicalHotelGeoParams[] = [];
  readonly appliedManualMatches: IApplyManualGeoHotelMatchParams[] = [];

  constructor(
    private readonly hotels: ICanonicalHotel[],
    private readonly candidates: IHotelGeoCandidate[],
  ) {
    super();
  }

  async findCanonicalHotelForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<ICanonicalHotel | null> {
    return this.hotels.find((hotel) => hotel._id.equals(id)) ?? null;
  }

  async findHotelGeoCandidateForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<IHotelGeoCandidate | null> {
    return this.candidates.find((candidate) => candidate._id.equals(id)) ?? null;
  }

  async listCanonicalHotelIdsWithMergedGeoCandidates(): Promise<string[]> {
    return this.candidates
      .filter(
        (candidate) =>
          candidate.canonicalHotelId !== null &&
          (candidate.matchStatus === HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED ||
            candidate.matchStatus === HOTEL_GEO_CANDIDATE_MATCH_STATUS.CONFIRMED),
      )
      .map((candidate) => candidate.canonicalHotelId?.toString() ?? '');
  }

  async listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]> {
    return this.hotels;
  }

  async listHotelGeoCandidatesForAutoMatching(
    limit: number,
  ): Promise<IHotelGeoCandidate[]> {
    const rows = this.candidates.filter(
      (candidate) =>
        candidate.lifecycle.status ===
          HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE &&
        (candidate.matchStatus === HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED ||
          candidate.matchStatus === HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED),
    );

    return limit > 0 ? rows.slice(0, limit) : rows;
  }

  async applyAutoMatch(
    params: IApplyGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedMatches.push(params);

    return GEO_MATCH_ACTION.AUTO_MATCHED;
  }

  async applyManualCanonicalHotelGeo(
    params: IApplyManualCanonicalHotelGeoParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualCanonicalHotelGeo.push(params);

    return GEO_MATCH_ACTION.MANUAL_GEO_SET;
  }

  async applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualMatches.push(params);

    return GEO_MATCH_ACTION.MANUAL_MATCHED;
  }
}

function buildHotelGeoCandidateFixture(
  overrides: Partial<IHotelGeoCandidate> = {},
): IHotelGeoCandidate {
  const now = new Date('2026-05-06T09:00:00.000Z');

  return {
    _id: new Types.ObjectId('69fae6928833ac8ce429d20d'),
    canonicalHotelId: null,
    componentId: null,
    createdAt: now,
    geometry: {
      coordinates: [34.0116723, 35.0542236],
      type: 'Point',
    },
    lifecycle: {
      firstSeenAt: now,
      lastSeenAt: now,
      notSeenSince: null,
      status: HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE,
    },
    matchReasons: [],
    matchStatus: HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED,
    name: 'Candidate Hotel',
    normalizedName: 'CANDIDATE HOTEL',
    point: {
      coordinates: [34.0116723, 35.0542236],
      type: 'Point',
    },
    source: buildSourceFixture('relation/1'),
    sourceHashes: {
      geometryHash: 'geometry-hash',
      propertiesHash: 'properties-hash',
    },
    sourceProperties: {
      name: 'Candidate Hotel',
      tourism: 'hotel',
    },
    updatedAt: now,
    ...overrides,
  };
}

function buildCanonicalHotelFixture(
  overrides: Partial<ICanonicalHotel> = {},
): ICanonicalHotel {
  const now = new Date('2026-05-06T09:00:00.000Z');
  const contacts = overrides.contacts ?? {
    domains: [],
    emails: [],
    phones: [],
    websites: [],
  };
  const canonicalName = overrides.canonicalName ?? 'CANONICAL HOTEL';

  return {
    _id: new Types.ObjectId('69f88430878f7fca1f7e0ac6'),
    canonicalKey: `chv1|${canonicalName}`,
    canonicalName,
    capacity: {
      beds: 10,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 5,
    },
    components: [
      {
        capacity: {
          beds: 10,
          rooms: 5,
        },
        componentKey: `component-v1|${canonicalName}`,
        contacts,
        establishmentType: 'HOTELS',
        location: {
          address: 'Main Street',
          district: 'AGIA NAPA',
          locality: 'Ayia Napa',
          postcode: '5330',
        },
        name: canonicalName,
        normalizedName: canonicalName,
      },
    ],
    contacts,
    createdAt: now,
    firstSeenAt: now,
    geo: {
      point: null,
      source: null,
    },
    issues: [],
    kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
    lastSeenAt: now,
    location: {
      address: 'Main Street',
      district: 'AGIA NAPA',
      locality: 'Ayia Napa',
      postcode: '5330',
    },
    operator: null,
    source: {
      lastCandidateBuildRule: 'single_registry_entry',
      lastCandidateBuildRuleVersion: 1,
      lastCandidateKey: `ccv1|${canonicalName}`,
      lastCandidateSeenAt: now,
      origin: 'gov_registry',
    },
    status: CANONICAL_HOTEL_STATUS.ACTIVE,
    updatedAt: now,
    webPresence: {
      declaredWebsiteKind: 'own_website',
      domains: contacts.domains,
      hasDeclaredWebsite: contacts.websites.length > 0,
      issues: [],
      source: 'gov_registry',
      websites: contacts.websites,
    },
    ...overrides,
  };
}

function buildSourceFixture(id: string): IHotelGeoCandidate['source'] {
  return {
    dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
    id,
    importRunId: new Types.ObjectId(),
    type: GEO_SOURCE_TYPE.OSM,
  };
}
