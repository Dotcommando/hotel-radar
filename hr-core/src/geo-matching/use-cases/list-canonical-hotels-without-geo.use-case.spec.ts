import { Types } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTEL_STATUS } from '../../canonical-hotels/constants/canonical-hotel-status.enum';
import { CANONICAL_HOTEL_VERIFICATION_STATUS } from '../../canonical-hotels/constants/canonical-hotel-verification-status.enum';
import { ICanonicalHotel } from '../../canonical-hotels/types/canonical-hotel.interface';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-lifecycle-status.enum';
import { HOTEL_GEO_CANDIDATE_MATCH_STATUS } from '../../hotel-geo-candidates/constants/hotel-geo-candidate-match-status.enum';
import { IHotelGeoCandidate } from '../../hotel-geo-candidates/types/hotel-geo-candidate.interface';
import { GEO_MATCH_ACTION } from '../constants/geo-match-action.enum';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualCanonicalHotelGeoParams } from '../types/apply-manual-canonical-hotel-geo-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';
import { AutoMatchHotelGeoCandidatesUseCase } from './auto-match-hotel-geo-candidates.use-case';
import { ListCanonicalHotelsWithoutGeoUseCase } from './list-canonical-hotels-without-geo.use-case';

describe('ListCanonicalHotelsWithoutGeoUseCase', () => {
  it('returns canonical hotels without any geo point and includes suggestions', async () => {
    const manualGeoHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f8842f878f7fca1f7e0a9c'),
      canonicalName: 'ALMOND',
      geo: {
        point: {
          coordinates: [33.35984525587796, 35.15937653746454],
          type: 'Point',
        },
        source: 'manual',
      },
    });
    const hotelWithoutGeo = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0ac8'),
      canonicalName: 'NICOLAS COLOR',
      contacts: {
        domains: ['nicholas.com.cy'],
        emails: ['info@nicholas.com.cy'],
        phones: ['+35723721988'],
        websites: ['https://nicholas.com.cy'],
      },
    });
    const suggestedCandidate = buildHotelGeoCandidateFixture({
      _id: new Types.ObjectId('69fae6928833ac8ce429d21d'),
      name: 'Nicholas Color Hotel',
      sourceProperties: {
        name: 'Nicholas Color Hotel',
        phone: '+357 23 721988',
        tourism: 'hotel',
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [manualGeoHotel, hotelWithoutGeo],
      [suggestedCandidate],
    );
    const useCase = new ListCanonicalHotelsWithoutGeoUseCase(
      repository,
      new AutoMatchHotelGeoCandidatesUseCase(repository),
    );

    const result = await useCase.execute({
      includeSuggestions: true,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].canonicalHotel._id).toBe(
      hotelWithoutGeo._id.toString(),
    );
    expect(result.items[0].suggestions).toHaveLength(1);
    expect(result.items[0].suggestions[0]).toMatchObject({
      action: GEO_MATCH_ACTION.AUTO_MATCHED,
      hotelGeoCandidateId: suggestedCandidate._id.toString(),
    });
  });

  it('can skip suggestion calculation', async () => {
    const hotelWithoutGeo = buildCanonicalHotelFixture({
      canonicalName: 'NICOLAS COLOR',
    });
    const candidate = buildHotelGeoCandidateFixture({
      name: 'Nicolas Color',
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotelWithoutGeo],
      [candidate],
    );
    const useCase = new ListCanonicalHotelsWithoutGeoUseCase(
      repository,
      new AutoMatchHotelGeoCandidatesUseCase(repository),
    );

    const result = await useCase.execute({
      includeSuggestions: false,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].suggestions).toEqual([]);
  });

  it('does not return duplicate or permanently closed canonical hotels', async () => {
    const activeHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0ac8'),
      canonicalName: 'ACTIVE HOTEL',
    });
    const duplicateHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0ac9'),
      canonicalName: 'DUPLICATE HOTEL',
      status: CANONICAL_HOTEL_STATUS.DUPLICATE,
    });
    const closedHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0aca'),
      canonicalName: 'CLOSED HOTEL',
      status: CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [activeHotel, duplicateHotel, closedHotel],
      [],
    );
    const useCase = new ListCanonicalHotelsWithoutGeoUseCase(
      repository,
      new AutoMatchHotelGeoCandidatesUseCase(repository),
    );

    const result = await useCase.execute({
      includeSuggestions: false,
    });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].canonicalHotel._id).toBe(activeHotel._id.toString());
  });

  it('does not return canonical hotels with unverified location', async () => {
    const activeHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0ac8'),
      canonicalName: 'ACTIVE HOTEL',
    });
    const locationUnverifiedHotel = buildCanonicalHotelFixture({
      _id: new Types.ObjectId('69f88430878f7fca1f7e0ac9'),
      canonicalName: 'UNVERIFIED HOTEL',
      verification: {
        issues: [],
        status: CANONICAL_HOTEL_VERIFICATION_STATUS.LOCATION_UNVERIFIED,
        updatedAt: new Date('2026-05-08T09:00:00.000Z'),
      },
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [activeHotel, locationUnverifiedHotel],
      [],
    );
    const useCase = new ListCanonicalHotelsWithoutGeoUseCase(
      repository,
      new AutoMatchHotelGeoCandidatesUseCase(repository),
    );

    const result = await useCase.execute({
      includeSuggestions: false,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].canonicalHotel._id).toBe(activeHotel._id.toString());
  });
});

class InMemoryGeoHotelMatchingRepository extends GeoHotelMatchingRepository {
  readonly appliedMatches: IApplyGeoHotelMatchParams[] = [];
  readonly appliedManualCanonicalHotelGeo: IApplyManualCanonicalHotelGeoParams[] =
    [];
  readonly appliedManualMatches: IApplyManualGeoHotelMatchParams[] = [];

  constructor(
    private readonly hotels: ICanonicalHotel[],
    private readonly candidates: IHotelGeoCandidate[],
  ) {
    super();
  }

  findCanonicalHotelForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<ICanonicalHotel | null> {
    return Promise.resolve(
      this.hotels.find((hotel) => hotel._id.equals(id)) ?? null,
    );
  }

  findHotelGeoCandidateForGeoMatchingById(
    id: Types.ObjectId,
  ): Promise<IHotelGeoCandidate | null> {
    return Promise.resolve(
      this.candidates.find((candidate) => candidate._id.equals(id)) ?? null,
    );
  }

  listCanonicalHotelIdsWithMergedGeoCandidates(): Promise<string[]> {
    return Promise.resolve([]);
  }

  listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]> {
    return Promise.resolve(this.hotels);
  }

  listHotelGeoCandidatesForAutoMatching(): Promise<IHotelGeoCandidate[]> {
    return Promise.resolve(
      this.candidates.filter(
        (candidate) =>
          candidate.lifecycle.status ===
            HOTEL_GEO_CANDIDATE_LIFECYCLE_STATUS.ACTIVE &&
          (candidate.matchStatus ===
            HOTEL_GEO_CANDIDATE_MATCH_STATUS.UNMATCHED ||
            candidate.matchStatus ===
              HOTEL_GEO_CANDIDATE_MATCH_STATUS.AUTO_MATCHED),
      ),
    );
  }

  applyAutoMatch(params: IApplyGeoHotelMatchParams): Promise<GEO_MATCH_ACTION> {
    this.appliedMatches.push(params);

    return Promise.resolve(GEO_MATCH_ACTION.AUTO_MATCHED);
  }

  applyManualCanonicalHotelGeo(
    params: IApplyManualCanonicalHotelGeoParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualCanonicalHotelGeo.push(params);

    return Promise.resolve(GEO_MATCH_ACTION.MANUAL_GEO_SET);
  }

  applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualMatches.push(params);

    return Promise.resolve(GEO_MATCH_ACTION.MANUAL_MATCHED);
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
    source: {
      dataset: GEO_SOURCE_DATASET.OVERPASS_TURBO,
      id: 'relation/1',
      importRunId: new Types.ObjectId(),
      type: GEO_SOURCE_TYPE.OSM,
    },
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
    verification: {
      issues: [],
      status: CANONICAL_HOTEL_VERIFICATION_STATUS.UNREVIEWED,
      updatedAt: null,
    },
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
