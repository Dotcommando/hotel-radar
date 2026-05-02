import mongoose, { Model } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../../hotel-processing/constants/hotel-processing-status.enum';
import { HOTEL_REGISTRY_ENTRY_STATUS } from '../constants/hotel-registry-entry-status.enum';
import { IHotelRegistryEntry } from '../types/hotel-registry-entry.interface';
import { hotelRegistryEntrySchema } from './hotel-registry-entry.schema';

describe('hotelRegistryEntrySchema', () => {
  const modelName = 'HotelRegistryEntrySchemaSpecModel';
  let hotelRegistryEntryModel: Model<IHotelRegistryEntry>;

  beforeEach(() => {
    if (mongoose.models[modelName] !== undefined) {
      mongoose.deleteModel(modelName);
    }

    hotelRegistryEntryModel = mongoose.model<IHotelRegistryEntry>(
      modelName,
      hotelRegistryEntrySchema,
    );
  });

  afterEach(() => {
    mongoose.deleteModel(modelName);
  });

  it('stores documents in the hotel_registry_entries collection', () => {
    expect(hotelRegistryEntrySchema.get('collection')).toBe(
      'hotel_registry_entries',
    );
  });

  it('defines a unique registryKey index', () => {
    expect(hotelRegistryEntrySchema.indexes()).toContainEqual([
      { registryKey: 1 },
      { unique: true },
    ]);
  });

  it('defaults processing status to pending', async () => {
    const entry = new hotelRegistryEntryModel({
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
      issues: [],
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
      operator: 'Limbus Creations Ltd',
      registryKey:
        'rkv1|THALASSINES 10|TOURIST VILLAS|SOTERA|SOTERA|5391|77 AGIAS THEKLAS AVENUE',
      status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
    });

    await entry.validate();

    expect(entry.processing.status).toBe(HOTEL_PROCESSING_STATUS.PENDING);
    expect(entry.processing.canonicalHotelCandidateId).toBeNull();
  });
});
