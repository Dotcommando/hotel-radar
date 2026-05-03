import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { IRawHotel } from '../raw-hotels/types/raw-hotel.interface';
import { HOTEL_REGISTRY_ENTRY_MODEL_NAME } from './constants/hotel-registry-entry-model-name.constant';
import { HOTEL_REGISTRY_ENTRY_STATUS } from './constants/hotel-registry-entry-status.enum';
import { HotelRegistryEntriesService } from './hotel-registry-entries.service';
import { IHotelRegistryEntry } from './types/hotel-registry-entry.interface';

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface IUpdateOneOptions {
  upsert?: boolean;
}

interface IFindOneAndUpdateOptions {
  returnDocument?: 'after';
  sort?: Record<string, 1 | -1>;
}

interface IHotelRegistryEntryModelMock {
  findOne: jest.Mock<
    IExecable<IHotelRegistryEntry | null>,
    [Record<string, unknown>]
  >;
  findOneAndUpdate: jest.Mock<
    IExecable<IHotelRegistryEntry | null>,
    [Record<string, unknown>, Record<string, unknown>, IFindOneAndUpdateOptions]
  >;
  updateOne: jest.Mock<
    IExecable<unknown>,
    [Record<string, unknown>, Record<string, unknown>, IUpdateOneOptions?]
  >;
}

describe('HotelRegistryEntriesService', () => {
  let service: HotelRegistryEntriesService;
  let hotelRegistryEntryModel: IHotelRegistryEntryModelMock;

  const rawHotelFixture: IRawHotel = {
    address: '1 Example Street',
    beds: 10,
    classRaw: null,
    contacts: {
      domain: 'example.com',
      emails: ['info@example.com'],
      faxes: [],
      phones: ['+357 22 222222'],
      websites: ['www.example.com'],
    },
    createdAt: new Date('2026-02-20T00:00:00.000Z'),
    establishmentType: 'APARTMENTS',
    licenseStatus: 'P',
    locality: 'Pafos',
    managerName: null,
    name: 'EXAMPLE APARTMENTS',
    nameNormalized: 'EXAMPLE APARTMENTS',
    operatorName: 'Example Ltd',
    postcode: '8042',
    processing: {
      claimedAt: null,
      error: null,
      hotelRegistryEntryId: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    },
    region: 'Pafos',
    rooms: 20,
    sourceFile: {
      filename: 'PAPHOS_APARTMENTS_16.2.2026.pdf',
      localPath:
        '/opt/media-factory/data/files/PAPHOS_APARTMENTS_16.2.2026.pdf',
      pdfUrl: 'https://www.gov.cy/example/PAPHOS_APARTMENTS_16.2.2026.pdf',
    },
    stars: null,
    updatedAt: new Date('2026-02-20T00:00:00.000Z'),
  };

  beforeEach(async () => {
    hotelRegistryEntryModel = {
      findOne: jest.fn<
        IExecable<IHotelRegistryEntry | null>,
        [Record<string, unknown>]
      >(),
      findOneAndUpdate: jest.fn<
        IExecable<IHotelRegistryEntry | null>,
        [
          Record<string, unknown>,
          Record<string, unknown>,
          IFindOneAndUpdateOptions,
        ]
      >(),
      updateOne: jest.fn<
        IExecable<unknown>,
        [Record<string, unknown>, Record<string, unknown>, IUpdateOneOptions?]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HotelRegistryEntriesService,
        {
          provide: getModelToken(HOTEL_REGISTRY_ENTRY_MODEL_NAME),
          useValue: hotelRegistryEntryModel,
        },
      ],
    }).compile();

    service = module.get<HotelRegistryEntriesService>(
      HotelRegistryEntriesService,
    );
  });

  function mockFindOneResults(
    existingEntry: IHotelRegistryEntry | null,
    upsertedEntry: IHotelRegistryEntry,
  ): void {
    hotelRegistryEntryModel.findOne
      .mockReturnValueOnce({
        exec: jest
          .fn<Promise<IHotelRegistryEntry | null>, []>()
          .mockResolvedValue(existingEntry),
      })
      .mockReturnValueOnce({
        exec: jest
          .fn<Promise<IHotelRegistryEntry | null>, []>()
          .mockResolvedValue(upsertedEntry),
      });
  }

  function mockUpdateOneResult(): void {
    hotelRegistryEntryModel.updateOne.mockReturnValue({
      exec: jest.fn<Promise<unknown>, []>().mockResolvedValue({}),
    });
  }

  function mockFindOneAndUpdateResult(
    registryEntry: IHotelRegistryEntry | null,
  ): void {
    hotelRegistryEntryModel.findOneAndUpdate.mockReturnValue({
      exec: jest
        .fn<Promise<IHotelRegistryEntry | null>, []>()
        .mockResolvedValue(registryEntry),
    });
  }

  function buildRegistryEntry(
    overrides: Partial<IHotelRegistryEntry>,
  ): IHotelRegistryEntry {
    return {
      _id: new Types.ObjectId(),
      capacity: {
        beds: 20,
        rooms: 10,
      },
      contacts: {
        domains: ['example.com'],
        emails: ['info@example.com'],
        phones: ['+35722222222'],
        websites: ['https://www.example.com/'],
      },
      createdAt: new Date('2026-05-02T10:00:00.000Z'),
      establishmentType: 'APARTMENTS',
      issues: [],
      location: {
        address: '1 Example Street',
        district: 'Pafos',
        locality: 'Pafos',
        postcode: '8042',
      },
      name: {
        baseName: 'EXAMPLE APARTMENTS',
        normalized: 'EXAMPLE APARTMENTS',
        original: 'EXAMPLE APARTMENTS',
        suffix: null,
      },
      operator: 'Example Ltd',
      processing: {
        canonicalHotelCandidateId: null,
        claimedAt: null,
        error: null,
        processedAt: null,
        runId: null,
        status: HOTEL_PROCESSING_STATUS.PENDING,
      },
      registryKey: 'registry-key',
      status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
      updatedAt: new Date('2026-05-02T10:00:00.000Z'),
      ...overrides,
    };
  }

  it('swaps parsed rooms and beds before saving when rooms exceed beds', async () => {
    const upsertedEntry = buildRegistryEntry({});

    mockFindOneResults(null, upsertedEntry);
    mockUpdateOneResult();

    const result = await service.upsertFromRawHotel(rawHotelFixture);

    expect(hotelRegistryEntryModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          capacity: {
            beds: 20,
            rooms: 10,
          },
          issues: [],
          status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
        }),
      }),
      {
        upsert: true,
      },
    );
    expect(result.issues).toEqual([]);
  });

  it('claims pending registry entries using Mongoose 9 returnDocument option', async () => {
    const registryEntry = buildRegistryEntry({});

    mockFindOneAndUpdateResult(registryEntry);

    const result = await service.claimPendingForRun('run-1', 1);

    expect(hotelRegistryEntryModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        'processing.status': HOTEL_PROCESSING_STATUS.PENDING,
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          'processing.runId': 'run-1',
          'processing.status': HOTEL_PROCESSING_STATUS.CLAIMED,
        }),
      }),
      {
        returnDocument: 'after',
        sort: {
          _id: 1,
        },
      },
    );
    expect(result).toEqual([registryEntry]);
  });

  it('normalizes parsed location before building registry key and fields', async () => {
    const dirtyRawHotel: IRawHotel = {
      ...rawHotelFixture,
      address: 'Poseidonos Avenue 8042, Pafos',
      locality: 'Pafos',
      postcode: '8042',
    };
    const upsertedEntry = buildRegistryEntry({
      location: {
        address: 'Poseidonos Avenue',
        district: 'Pafos',
        locality: 'Pafos',
        postcode: '8042',
      },
      registryKey:
        'rkv1|EXAMPLE APARTMENTS|APARTMENTS|PAFOS|PAFOS|8042|POSEIDONOS AVENUE',
    });

    mockFindOneResults(null, upsertedEntry);
    mockUpdateOneResult();

    await service.upsertFromRawHotel(dirtyRawHotel);

    expect(hotelRegistryEntryModel.findOne).toHaveBeenCalledWith({
      registryKey:
        'rkv1|EXAMPLE APARTMENTS|APARTMENTS|PAFOS|PAFOS|8042|POSEIDONOS AVENUE',
    });
    expect(hotelRegistryEntryModel.updateOne).toHaveBeenCalledWith(
      {
        registryKey:
          'rkv1|EXAMPLE APARTMENTS|APARTMENTS|PAFOS|PAFOS|8042|POSEIDONOS AVENUE',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          location: expect.objectContaining({
            address: 'Poseidonos Avenue',
            locality: 'Pafos',
            postcode: '8042',
          }),
        }),
      }),
      {
        upsert: true,
      },
    );
  });

  it('repairs an existing reversed capacity entry on repeated upsert', async () => {
    const existingEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 20,
      },
      issues: ['invalid_capacity'],
      status: HOTEL_REGISTRY_ENTRY_STATUS.BLOCKED,
    });
    const upsertedEntry = buildRegistryEntry({});

    mockFindOneResults(existingEntry, upsertedEntry);
    mockUpdateOneResult();

    const result = await service.upsertFromRawHotel(rawHotelFixture);

    expect(hotelRegistryEntryModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          capacity: {
            beds: 20,
            rooms: 10,
          },
          issues: [],
          status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
        }),
      }),
      {
        upsert: true,
      },
    );
    expect(result.issues).toEqual([]);
  });
});
