import mongoose, { Model } from 'mongoose';
import { rawHotelSchema } from './raw-hotel.schema';
import { IRawHotel } from '../types/raw-hotel.interface';

describe('rawHotelSchema', () => {
  const modelName = 'RawHotelSchemaSpecModel';
  let rawHotelModel: Model<IRawHotel>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    rawHotelModel = mongoose.model<IRawHotel>(modelName, rawHotelSchema);
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores documents in the raw_hotels collection', () => {
    expect(rawHotelSchema.get('collection')).toBe('raw_hotels');
  });

  it('requires createdAt and updatedAt fields', async () => {
    const rawHotel = new rawHotelModel({
      address: null,
      beds: 366,
      classRaw: '5*',
      contacts: {
        domain: 'anassa.com',
        emails: ['anassa@thanoshotels.com'],
        faxes: ['+357 26 322 900'],
        phones: ['+357 26 888 000'],
        websites: ['www.anassa.com'],
      },
      establishmentType: 'HOTEL',
      licenseStatus: 'P',
      locality: 'Neo Chorion (Aphrodite Paths)',
      managerName: 'Mr Sebastian Wurst',
      name: 'ANASSA',
      nameNormalized: 'ANASSA',
      operatorName: 'Thanos Club Hotels Ltd',
      postcode: '8852',
      region: 'Pafos',
      rooms: 177,
      sourceFile: {
        filename: 'POLIS_HOTELS_16.2.2026.pdf',
        localPath: '/opt/media-factory/data/files/2026-02-16/POLIS_HOTELS_16.2.2026.pdf',
        pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
      },
      stars: 5,
    });

    await rawHotel.validate();

    expect(rawHotel.createdAt).toBeInstanceOf(Date);
    expect(rawHotel.updatedAt).toBeInstanceOf(Date);
    expect(rawHotelSchema.path('createdAt').options.required).toBe(true);
    expect(rawHotelSchema.path('updatedAt').options.required).toBe(true);
  });

  it('does not include n8n helper fields in persisted documents', () => {
    const rawHotel = new rawHotelModel({
      __valid: true,
      __warnings: ['warning'],
      address: null,
      beds: 366,
      classRaw: '5*',
      contacts: {
        domain: 'anassa.com',
        emails: ['anassa@thanoshotels.com'],
        faxes: ['+357 26 322 900'],
        phones: ['+357 26 888 000'],
        websites: ['www.anassa.com'],
      },
      createdAt: new Date('2026-02-20T00:00:00.000Z'),
      establishmentType: 'HOTEL',
      licenseStatus: 'P',
      locality: 'Neo Chorion (Aphrodite Paths)',
      managerName: 'Mr Sebastian Wurst',
      name: 'ANASSA',
      nameNormalized: 'ANASSA',
      operatorName: 'Thanos Club Hotels Ltd',
      postcode: '8852',
      region: 'Pafos',
      rooms: 177,
      sourceFile: {
        filename: 'POLIS_HOTELS_16.2.2026.pdf',
        localPath: '/opt/media-factory/data/files/2026-02-16/POLIS_HOTELS_16.2.2026.pdf',
        pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
      },
      stars: 5,
      updatedAt: new Date('2026-02-20T00:00:00.000Z'),
      upsertKey: 'ANASSA::POLIS_HOTELS_16.2.2026.pdf',
    });

    const rawHotelObject = rawHotel.toObject() as Record<string, unknown>;

    expect(rawHotelSchema.path('__valid')).toBeUndefined();
    expect(rawHotelSchema.path('__warnings')).toBeUndefined();
    expect(rawHotelSchema.path('upsertKey')).toBeUndefined();
    expect(rawHotelObject.__valid).toBeUndefined();
    expect(rawHotelObject.__warnings).toBeUndefined();
    expect(rawHotelObject.upsertKey).toBeUndefined();
  });
});
