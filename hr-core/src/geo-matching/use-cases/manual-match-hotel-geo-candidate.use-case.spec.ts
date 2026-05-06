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
import { GeoHotelManualMatchConflictError } from '../errors/geo-hotel-manual-match-conflict.error';
import { GeoHotelMatchInvalidIdError } from '../errors/geo-hotel-match-invalid-id.error';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';
import { ManualMatchHotelGeoCandidateUseCase } from './manual-match-hotel-geo-candidate.use-case';

describe('ManualMatchHotelGeoCandidateUseCase', () => {
  it('confirms a canonical hotel and hotel geo candidate match by ids', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'NICOLAS COLOR',
    });
    const candidate = buildHotelGeoCandidateFixture({
      name: 'Nicholas Color Hotel',
    });
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [candidate],
    );
    const useCase = new ManualMatchHotelGeoCandidateUseCase(repository);

    const result = await useCase.execute({
      canonicalHotelId: hotel._id.toString(),
      hotelGeoCandidateId: candidate._id.toString(),
    });

    expect(result).toEqual({
      action: GEO_MATCH_ACTION.MANUAL_MATCHED,
      canonicalHotelId: hotel._id.toString(),
      canonicalHotelName: hotel.canonicalName,
      hotelGeoCandidateId: candidate._id.toString(),
      hotelGeoCandidateName: candidate.name,
      hotelGeoCandidateSourceId: candidate.source.id,
      ok: true,
    });
    expect(repository.appliedManualMatches).toEqual([
      {
        canonicalHotelId: hotel._id,
        hotelGeoCandidateId: candidate._id,
        point: candidate.point,
      },
    ]);
  });

  it('rejects invalid object ids before applying the match', async () => {
    const repository = new InMemoryGeoHotelMatchingRepository([], []);
    const useCase = new ManualMatchHotelGeoCandidateUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: 'not-an-id',
        hotelGeoCandidateId: new Types.ObjectId().toString(),
      }),
    ).rejects.toBeInstanceOf(GeoHotelMatchInvalidIdError);
    expect(repository.appliedManualMatches).toHaveLength(0);
  });

  it('surfaces repository conflicts as manual match conflicts', async () => {
    const hotel = buildCanonicalHotelFixture();
    const candidate = buildHotelGeoCandidateFixture();
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [candidate],
      GEO_MATCH_ACTION.CONFLICT,
    );
    const useCase = new ManualMatchHotelGeoCandidateUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: hotel._id.toString(),
        hotelGeoCandidateId: candidate._id.toString(),
      }),
    ).rejects.toBeInstanceOf(GeoHotelManualMatchConflictError);
  });
});

class InMemoryGeoHotelMatchingRepository extends GeoHotelMatchingRepository {
  readonly appliedMatches: IApplyGeoHotelMatchParams[] = [];
  readonly appliedManualMatches: IApplyManualGeoHotelMatchParams[] = [];

  constructor(
    private readonly hotels: ICanonicalHotel[],
    private readonly candidates: IHotelGeoCandidate[],
    private readonly manualMatchAction: GEO_MATCH_ACTION = GEO_MATCH_ACTION.MANUAL_MATCHED,
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
    return [];
  }

  async listCanonicalHotelsForGeoMatching(): Promise<ICanonicalHotel[]> {
    return this.hotels;
  }

  async listHotelGeoCandidatesForAutoMatching(): Promise<IHotelGeoCandidate[]> {
    return this.candidates;
  }

  async applyAutoMatch(
    params: IApplyGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedMatches.push(params);

    return GEO_MATCH_ACTION.AUTO_MATCHED;
  }

  async applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualMatches.push(params);

    return this.manualMatchAction;
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
