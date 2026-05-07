import { Types } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTEL_PROCESSING_ACTION } from '../constants/canonical-hotel-processing-action.enum';
import { CANONICAL_HOTEL_REVIEW_REASON } from '../constants/canonical-hotel-review-reason.enum';
import { CANONICAL_HOTEL_STATUS } from '../constants/canonical-hotel-status.enum';
import { ICanonicalHotel } from '../types/canonical-hotel.interface';
import { CanonicalHotelsService } from './canonical-hotels.service';
import { HotelDeclaredWebPresenceService } from './hotel-declared-web-presence.service';

describe('CanonicalHotelsService', () => {
  it('creates a canonical hotel when no deterministic match exists', async () => {
    const model = new InMemoryCanonicalHotelModel([]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(CANONICAL_HOTEL_PROCESSING_ACTION.CREATED);
    expect(result.canonicalHotelId).not.toBeNull();
    expect(model.documents).toHaveLength(1);
    expect(model.documents[0].canonicalName).toBe('PINE VIEW BOUTIQUE');
    expect(model.documents[0]).not.toHaveProperty('normalizedName');
  });

  it('updates capacity on an exact match', async () => {
    const existing = buildCanonicalHotelFixture({
      capacity: {
        beds: 10,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: 5,
      },
    });
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(CANONICAL_HOTEL_PROCESSING_ACTION.UPDATED);
    expect(model.documents[0].capacity).toEqual({
      beds: 12,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 6,
    });
  });

  it('marks a candidate as seen without changing hotel facts', async () => {
    const existing = buildCanonicalHotelFixture({});
    const beforeContacts = structuredClone(existing.contacts);
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(
      CANONICAL_HOTEL_PROCESSING_ACTION.SEEN_WITHOUT_CHANGES,
    );
    expect(model.documents[0].contacts).toEqual(beforeContacts);
  });

  it('does not reactivate a duplicate canonical hotel on an exact candidate match', async () => {
    const existing = buildCanonicalHotelFixture({
      status: CANONICAL_HOTEL_STATUS.DUPLICATE,
    });
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(
      CANONICAL_HOTEL_PROCESSING_ACTION.SEEN_WITHOUT_CHANGES,
    );
    expect(model.documents[0].status).toBe(CANONICAL_HOTEL_STATUS.DUPLICATE);
  });

  it('does not reactivate a permanently closed canonical hotel on an exact candidate match', async () => {
    const existing = buildCanonicalHotelFixture({
      status: CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    });
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(
      CANONICAL_HOTEL_PROCESSING_ACTION.SEEN_WITHOUT_CHANGES,
    );
    expect(model.documents[0].status).toBe(
      CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    );
  });

  it('does not reactivate a non-active canonical hotel when candidate facts changed', async () => {
    const existing = buildCanonicalHotelFixture({
      capacity: {
        beds: 10,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: 5,
      },
      status: CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    });
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(CANONICAL_HOTEL_PROCESSING_ACTION.UPDATED);
    expect(model.documents[0].capacity).toEqual({
      beds: 12,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 6,
    });
    expect(model.documents[0].status).toBe(
      CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    );
  });

  it('requires review on conflicting location and does not modify canonical hotels', async () => {
    const existing = buildCanonicalHotelFixture({
      canonicalKey:
        'chv1|single_property|PINE VIEW BOUTIQUE|LIMASSOL|SAITTAS|4748|DIFFERENT STREET',
      location: {
        address: 'Different Street',
        district: 'LIMASSOL',
        locality: 'Saittas',
        postcode: '4748',
      },
    });
    const before = structuredClone(existing);
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(
      CANONICAL_HOTEL_PROCESSING_ACTION.REVIEW_REQUIRED,
    );
    expect(result.review?.reason).toBe(
      CANONICAL_HOTEL_REVIEW_REASON.CONFLICTING_LOCATION,
    );
    expect(model.documents[0]).toEqual(before);
  });

  it('creates a canonical hotel from address and operator when postcode is missing', async () => {
    const model = new InMemoryCanonicalHotelModel([]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(
      buildCandidateFixture({
        canonicalName: 'NISSIBLU BEACH',
        location: {
          address: '75C, Nissi Avenue',
          district: 'AGIA NAPA',
          locality: 'Ayia Napa',
          postcode: null,
        },
        operator: 'T.& E. Tofinis Estates Ltd',
      }),
    );

    expect(result.action).toBe(CANONICAL_HOTEL_PROCESSING_ACTION.CREATED);
    expect(model.documents[0].canonicalKey).toBe(
      'chv1|single_property|NISSIBLU BEACH|AGIA NAPA|AYIA NAPA|address_operator|75C NISSI AVENUE|T AND E TOFINIS ESTATES LTD',
    );
  });

  it('matches a weaker existing hotel and upgrades fields from a fuller future candidate', async () => {
    const existing = buildCanonicalHotelFixture({
      canonicalKey:
        'chv1|single_property|PINE VIEW BOUTIQUE|LIMASSOL|SAITTAS|address_operator|1 PINE VIEW ROAD|PINE VIEW LTD',
      location: {
        address: '1 Pine View Road',
        district: 'LIMASSOL',
        locality: 'Saittas',
        postcode: null,
      },
    });
    const model = new InMemoryCanonicalHotelModel([existing]);
    const service = new CanonicalHotelsService(
      model,
      new HotelDeclaredWebPresenceService(),
    );

    const result = await service.applyCandidate(buildCandidateFixture());

    expect(result.action).toBe(CANONICAL_HOTEL_PROCESSING_ACTION.UPDATED);
    expect(model.documents).toHaveLength(1);
    expect(model.documents[0].location.postcode).toBe('4748');
    expect(model.documents[0].canonicalKey).toBe(
      'chv1|single_property|PINE VIEW BOUTIQUE|LIMASSOL|SAITTAS|4748|1 PINE VIEW ROAD',
    );
  });
});

function buildCandidateFixture(
  overrides: Partial<ReturnType<typeof buildCandidateBaseFixture>> = {},
) {
  return {
    ...buildCandidateBaseFixture(),
    ...overrides,
  };
}

function buildCandidateBaseFixture() {
  return {
    _id: new Types.ObjectId('69f8712a468ad01eb59c4712'),
    build: {
      issues: [],
      rule: 'single_registry_entry',
      ruleVersion: 1,
    },
    candidateKey: 'ccv1|single|pine-view',
    canonicalName: 'PINE VIEW BOUTIQUE',
    capacity: {
      beds: 12,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 6,
    },
    components: [
      {
        capacity: {
          beds: 12,
          rooms: 6,
        },
        componentKey: 'component-v1|pine-view',
        contacts: {
          domains: ['pineview.com.cy'],
          emails: ['info@pineview.com.cy'],
          phones: ['+35725583134'],
          websites: ['https://www.pineview.com.cy/'],
        },
        establishmentType: 'HOTELS',
        location: {
          address: '1 Pine View Road',
          district: 'LIMASSOL',
          locality: 'Saittas',
          postcode: '4748',
        },
        name: 'PINE VIEW BOUTIQUE',
        normalizedName: 'PINE VIEW BOUTIQUE',
      },
    ],
    contacts: {
      domains: ['pineview.com.cy'],
      emails: ['info@pineview.com.cy'],
      phones: ['+35725583134'],
      websites: ['https://www.pineview.com.cy/'],
    },
    createdAt: new Date('2026-05-03T17:15:15.000Z'),
    kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
    location: {
      address: '1 Pine View Road',
      district: 'LIMASSOL',
      locality: 'Saittas',
      postcode: '4748',
    },
    operator: 'Pine View Ltd',
    processing: {
      action: null,
      canonicalHotelId: null,
      claimedAt: null,
      error: null,
      processedAt: null,
      review: null,
      runId: null,
      status: 'pending',
    },
    status: 'ready',
    updatedAt: new Date('2026-05-03T17:15:15.000Z'),
  };
}

function buildCanonicalHotelFixture(
  overrides: Partial<ICanonicalHotel>,
): ICanonicalHotel {
  return {
    _id: new Types.ObjectId('69f8713f468ad01eb59c49d0'),
    canonicalKey:
      'chv1|single_property|PINE VIEW BOUTIQUE|LIMASSOL|SAITTAS|4748|1 PINE VIEW ROAD',
    canonicalName: 'PINE VIEW BOUTIQUE',
    capacity: {
      beds: 12,
      mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
      rooms: 6,
    },
    components: buildCandidateFixture().components,
    contacts: buildCandidateFixture().contacts,
    createdAt: new Date('2026-05-03T17:15:15.000Z'),
    firstSeenAt: new Date('2026-05-03T17:15:15.000Z'),
    geo: {
      point: null,
      source: null,
    },
    issues: [],
    kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
    lastSeenAt: new Date('2026-05-03T17:15:15.000Z'),
    location: buildCandidateFixture().location,
    operator: 'Pine View Ltd',
    source: {
      lastCandidateBuildRule: 'single_registry_entry',
      lastCandidateBuildRuleVersion: 1,
      lastCandidateKey: 'ccv1|single|pine-view',
      lastCandidateSeenAt: new Date('2026-05-03T17:15:15.000Z'),
      origin: 'gov_registry',
    },
    status: CANONICAL_HOTEL_STATUS.ACTIVE,
    updatedAt: new Date('2026-05-03T17:15:15.000Z'),
    webPresence: {
      declaredWebsiteKind: 'own_website',
      domains: ['pineview.com.cy'],
      hasDeclaredWebsite: true,
      issues: [],
      source: 'gov_registry',
      websites: ['https://www.pineview.com.cy/'],
    },
    ...overrides,
  };
}

class InMemoryCanonicalHotelModel {
  constructor(private readonly rows: ICanonicalHotel[]) {}

  get documents(): ICanonicalHotel[] {
    return this.rows;
  }

  findOne(filter: Partial<Pick<ICanonicalHotel, 'canonicalKey'>>): {
    exec: () => Promise<ICanonicalHotel | null>;
  } {
    return {
      exec: (): Promise<ICanonicalHotel | null> =>
        Promise.resolve(
          this.rows.find(
            ({ canonicalKey }) => canonicalKey === filter.canonicalKey,
          ) ?? null,
        ),
    };
  }

  find(filter: IInMemoryFindFilter): {
    exec: () => Promise<ICanonicalHotel[]>;
  } {
    return {
      exec: (): Promise<ICanonicalHotel[]> =>
        Promise.resolve(
          this.rows.filter((document) =>
            Object.entries(filter).every(([field, value]) =>
              this.matchesField(document, field, value),
            ),
          ),
        ),
    };
  }

  create(document: ICanonicalHotel): Promise<ICanonicalHotel> {
    this.rows.push(document);

    return Promise.resolve(document);
  }

  updateOne(
    filter: Pick<ICanonicalHotel, '_id'>,
    update: { $set: Partial<ICanonicalHotel> },
  ): {
    exec: () => Promise<void>;
  } {
    return {
      exec: (): Promise<void> => {
        const document = this.rows.find(({ _id }) => _id.equals(filter._id));

        if (document !== undefined) {
          Object.assign(document, update.$set);
        }

        return Promise.resolve();
      },
    };
  }

  private matchesField(
    document: ICanonicalHotel,
    field: string,
    value: unknown,
  ): boolean {
    if (field === 'canonicalName') {
      return document.canonicalName === value;
    }

    if (field === 'kind') {
      return document.kind === value;
    }

    if (field === 'operator') {
      return document.operator === value;
    }

    if (field === 'location.address') {
      return document.location.address === value;
    }

    if (field === 'location.locality') {
      return document.location.locality === value;
    }

    if (field === 'location.postcode') {
      return document.location.postcode === value;
    }

    return false;
  }
}

interface IInMemoryFindFilter {
  canonicalName?: string;
  kind?: string;
  operator?: string | null;
  'location.address'?: string | null;
  'location.locality'?: string | null;
  'location.postcode'?: string | null;
}
