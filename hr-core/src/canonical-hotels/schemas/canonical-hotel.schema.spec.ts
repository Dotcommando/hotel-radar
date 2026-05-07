import mongoose, { Model } from 'mongoose';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../../canonical-hotel-candidates/constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_KIND } from '../../canonical-hotel-candidates/constants/canonical-hotel-kind.enum';
import { CANONICAL_HOTEL_STATUS } from '../constants/canonical-hotel-status.enum';
import { HOTEL_DECLARED_WEBSITE_KIND } from '../constants/hotel-declared-website-kind.enum';
import { HOTEL_WEB_PRESENCE_SOURCE } from '../constants/hotel-web-presence-source.enum';
import { ICanonicalHotel } from '../types/canonical-hotel.interface';
import { canonicalHotelSchema } from './canonical-hotel.schema';

describe('canonicalHotelSchema', () => {
  const modelName = 'CanonicalHotelSchemaSpecModel';
  let canonicalHotelModel: Model<ICanonicalHotel>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    canonicalHotelModel = mongoose.model<ICanonicalHotel>(
      modelName,
      canonicalHotelSchema,
    );
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores final hotel data without a persisted normalizedName field', async () => {
    const now = new Date('2026-05-04T08:00:00.000Z');
    const hotel = new canonicalHotelModel({
      canonicalKey:
        'chv1|single_property|ANASSA|PAFOS|NEO CHORIO|8852|40 ALEKOS MICHAILIDES RD',
      canonicalName: 'ANASSA',
      capacity: {
        beds: 366,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: 177,
      },
      components: [],
      contacts: {
        domains: ['anassa.com'],
        emails: ['anassa@thanoshotels.com'],
        phones: ['+35726888000'],
        websites: ['https://www.anassa.com/'],
      },
      firstSeenAt: now,
      geo: {
        point: null,
        source: null,
      },
      issues: [],
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      lastSeenAt: now,
      location: {
        address: '40, Alekos Michailides Rd',
        district: 'PAFOS',
        locality: 'Neo Chorio',
        postcode: '8852',
      },
      operator: 'Thanos Club Hotels Ltd',
      source: {
        lastCandidateBuildRule: 'single_registry_entry',
        lastCandidateBuildRuleVersion: 1,
        lastCandidateKey: 'ccv1|single|anassa',
        lastCandidateSeenAt: now,
        origin: 'gov_registry',
      },
      status: CANONICAL_HOTEL_STATUS.ACTIVE,
      webPresence: {
        declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND.OWN_WEBSITE,
        domains: ['anassa.com'],
        hasDeclaredWebsite: true,
        issues: [],
        source: HOTEL_WEB_PRESENCE_SOURCE.GOV_REGISTRY,
        websites: ['https://www.anassa.com/'],
      },
    });

    await hotel.validate();

    const stored = hotel.toObject();

    expect(stored.geo).toEqual({
      point: null,
      source: null,
    });
    expect(stored).not.toHaveProperty('normalizedName');
  });

  it('accepts non-active canonical hotel statuses', async () => {
    const now = new Date('2026-05-04T08:00:00.000Z');
    const statuses = [
      CANONICAL_HOTEL_STATUS.DUPLICATE,
      CANONICAL_HOTEL_STATUS.PERMANENTLY_CLOSED,
    ];

    for (const status of statuses) {
      const hotel = new canonicalHotelModel({
        canonicalKey: `chv1|single_property|ANASSA|${status}`,
        canonicalName: 'ANASSA',
        capacity: {
          beds: 366,
          mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
          rooms: 177,
        },
        components: [],
        contacts: {
          domains: ['anassa.com'],
          emails: ['anassa@thanoshotels.com'],
          phones: ['+35726888000'],
          websites: ['https://www.anassa.com/'],
        },
        firstSeenAt: now,
        geo: {
          point: null,
          source: null,
        },
        issues: [],
        kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
        lastSeenAt: now,
        location: {
          address: '40, Alekos Michailides Rd',
          district: 'PAFOS',
          locality: 'Neo Chorio',
          postcode: '8852',
        },
        operator: 'Thanos Club Hotels Ltd',
        source: {
          lastCandidateBuildRule: 'single_registry_entry',
          lastCandidateBuildRuleVersion: 1,
          lastCandidateKey: 'ccv1|single|anassa',
          lastCandidateSeenAt: now,
          origin: 'gov_registry',
        },
        status,
        webPresence: {
          declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND.OWN_WEBSITE,
          domains: ['anassa.com'],
          hasDeclaredWebsite: true,
          issues: [],
          source: HOTEL_WEB_PRESENCE_SOURCE.GOV_REGISTRY,
          websites: ['https://www.anassa.com/'],
        },
      });

      await expect(hotel.validate()).resolves.toBeUndefined();
    }
  });
});
