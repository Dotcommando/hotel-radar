import mongoose, { Model } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { CANONICAL_HOTEL_CAPACITY_MODE } from '../constants/canonical-hotel-capacity-mode.enum';
import { CANONICAL_HOTEL_CANDIDATE_STATUS } from '../constants/canonical-hotel-candidate-status.enum';
import { CANONICAL_HOTEL_KIND } from '../constants/canonical-hotel-kind.enum';
import { ICanonicalHotelCandidate } from '../types/canonical-hotel-candidate.interface';
import { canonicalHotelCandidateSchema } from './canonical-hotel-candidate.schema';

describe('canonicalHotelCandidateSchema', () => {
  const modelName = 'CanonicalHotelCandidateSchemaSpecModel';
  let canonicalHotelCandidateModel: Model<ICanonicalHotelCandidate>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    canonicalHotelCandidateModel = mongoose.model<ICanonicalHotelCandidate>(
      modelName,
      canonicalHotelCandidateSchema,
    );
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores component-level location, contacts and capacity snapshots', async () => {
    const candidate = new canonicalHotelCandidateModel({
      build: {
        issues: [],
        rule: 'single_registry_entry',
        ruleVersion: 1,
      },
      candidateKey: 'ccv1|single|anassa',
      canonicalName: 'ANASSA',
      capacity: {
        beds: 366,
        mode: CANONICAL_HOTEL_CAPACITY_MODE.SINGLE_COMPONENT,
        rooms: 177,
      },
      components: [
        {
          capacity: {
            beds: 366,
            rooms: 177,
          },
          componentKey:
            'component-v1|ANASSA|HOTELS|8852|40 ALEKOS MICHAILIDES RD',
          contacts: {
            domains: ['anassa.com'],
            emails: ['anassa@thanoshotels.com'],
            phones: ['+35726888000'],
            websites: ['https://www.anassa.com/'],
          },
          establishmentType: 'HOTELS',
          location: {
            address: '40, Alekos Michailides Rd',
            district: 'PAFOS',
            locality: 'Neo Chorio',
            postcode: '8852',
          },
          name: 'ANASSA',
          normalizedName: 'ANASSA',
        },
      ],
      contacts: {
        domains: ['anassa.com'],
        emails: ['anassa@thanoshotels.com'],
        phones: ['+35726888000'],
        websites: ['https://www.anassa.com/'],
      },
      kind: CANONICAL_HOTEL_KIND.SINGLE_PROPERTY,
      location: {
        address: '40, Alekos Michailides Rd',
        district: 'PAFOS',
        locality: 'Neo Chorio',
        postcode: '8852',
      },
      operator: 'Thanos Club Hotels Ltd',
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

    await candidate.validate();

    const component = candidate.components[0].toObject();

    expect(component.location.address).toBe('40, Alekos Michailides Rd');
    expect(component.contacts.emails).toEqual(['anassa@thanoshotels.com']);
    expect(component.capacity).toEqual({
      beds: 366,
      rooms: 177,
    });
  });
});
