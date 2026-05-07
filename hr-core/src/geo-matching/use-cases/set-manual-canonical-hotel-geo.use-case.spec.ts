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
import { MANUAL_CANONICAL_HOTEL_GEO_SOURCE } from '../constants/manual-canonical-hotel-geo-source.constant';
import { CanonicalHotelForGeoMatchNotFoundError } from '../errors/canonical-hotel-for-geo-match-not-found.error';
import { GeoHotelManualGeoConflictError } from '../errors/geo-hotel-manual-geo-conflict.error';
import { GeoHotelManualGeoInvalidQueryError } from '../errors/geo-hotel-manual-geo-invalid-query.error';
import { GeoHotelMatchInvalidIdError } from '../errors/geo-hotel-match-invalid-id.error';
import { GeoHotelMatchingRepository } from '../repositories/geo-hotel-matching.repository';
import { IApplyGeoHotelMatchParams } from '../types/apply-geo-hotel-match-params.interface';
import { IApplyManualCanonicalHotelGeoParams } from '../types/apply-manual-canonical-hotel-geo-params.interface';
import { IApplyManualGeoHotelMatchParams } from '../types/apply-manual-geo-hotel-match-params.interface';
import { SetManualCanonicalHotelGeoUseCase } from './set-manual-canonical-hotel-geo.use-case';

describe('SetManualCanonicalHotelGeoUseCase', () => {
  it('sets manual canonical hotel geo from Google lat/lng coordinates', async () => {
    const hotel = buildCanonicalHotelFixture({
      canonicalName: 'GATE TWENTY TWO BOUTIQUE',
    });
    const repository = new InMemoryGeoHotelMatchingRepository([hotel], []);
    const useCase = new SetManualCanonicalHotelGeoUseCase(repository);

    const result = await useCase.execute({
      canonicalHotelId: hotel._id.toString(),
      lat: '35.1696808',
      lng: '33.3634435',
    });

    expect(result).toEqual({
      action: GEO_MATCH_ACTION.MANUAL_GEO_SET,
      canonicalHotelId: hotel._id.toString(),
      canonicalHotelName: hotel.canonicalName,
      geo: {
        point: {
          coordinates: [33.3634435, 35.1696808],
          type: 'Point',
        },
        source: MANUAL_CANONICAL_HOTEL_GEO_SOURCE,
      },
      ok: true,
    });
    expect(repository.appliedManualCanonicalHotelGeo).toEqual([
      {
        canonicalHotelId: hotel._id,
        point: {
          coordinates: [33.3634435, 35.1696808],
          type: 'Point',
        },
      },
    ]);
  });

  it('rejects invalid object ids before applying geo', async () => {
    const repository = new InMemoryGeoHotelMatchingRepository([], []);
    const useCase = new SetManualCanonicalHotelGeoUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: 'not-an-id',
        lat: '35.1696808',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(GeoHotelMatchInvalidIdError);
    expect(repository.appliedManualCanonicalHotelGeo).toHaveLength(0);
  });

  it('rejects invalid coordinates before applying geo', async () => {
    const hotel = buildCanonicalHotelFixture();
    const repository = new InMemoryGeoHotelMatchingRepository([hotel], []);
    const useCase = new SetManualCanonicalHotelGeoUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: hotel._id.toString(),
        lat: '95',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(GeoHotelManualGeoInvalidQueryError);
    expect(repository.appliedManualCanonicalHotelGeo).toHaveLength(0);
  });

  it('rejects missing canonical hotels', async () => {
    const repository = new InMemoryGeoHotelMatchingRepository([], []);
    const useCase = new SetManualCanonicalHotelGeoUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: new Types.ObjectId().toString(),
        lat: '35.1696808',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(CanonicalHotelForGeoMatchNotFoundError);
  });

  it('surfaces repository conflicts as manual geo conflicts', async () => {
    const hotel = buildCanonicalHotelFixture();
    const repository = new InMemoryGeoHotelMatchingRepository(
      [hotel],
      [],
      GEO_MATCH_ACTION.CONFLICT,
    );
    const useCase = new SetManualCanonicalHotelGeoUseCase(repository);

    await expect(
      useCase.execute({
        canonicalHotelId: hotel._id.toString(),
        lat: '35.1696808',
        lng: '33.3634435',
      }),
    ).rejects.toBeInstanceOf(GeoHotelManualGeoConflictError);
  });
});

class InMemoryGeoHotelMatchingRepository extends GeoHotelMatchingRepository {
  readonly appliedMatches: IApplyGeoHotelMatchParams[] = [];
  readonly appliedManualCanonicalHotelGeo: IApplyManualCanonicalHotelGeoParams[] = [];
  readonly appliedManualMatches: IApplyManualGeoHotelMatchParams[] = [];

  constructor(
    private readonly hotels: ICanonicalHotel[],
    private readonly candidates: IHotelGeoCandidate[],
    private readonly manualGeoAction: GEO_MATCH_ACTION = GEO_MATCH_ACTION.MANUAL_GEO_SET,
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

  async applyManualCanonicalHotelGeo(
    params: IApplyManualCanonicalHotelGeoParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualCanonicalHotelGeo.push(params);

    return this.manualGeoAction;
  }

  async applyManualMatch(
    params: IApplyManualGeoHotelMatchParams,
  ): Promise<GEO_MATCH_ACTION> {
    this.appliedManualMatches.push(params);

    return GEO_MATCH_ACTION.MANUAL_MATCHED;
  }
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
          district: 'NICOSIA',
          locality: 'Nicosia',
          postcode: '1015',
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
      district: 'NICOSIA',
      locality: 'Nicosia',
      postcode: '1015',
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
