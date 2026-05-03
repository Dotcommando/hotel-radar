import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { model, Types } from 'mongoose';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import { rawHotelSchema } from '../raw-hotels/schemas/raw-hotel.schema';
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
  find: jest.Mock<
    {
      sort: jest.Mock<
        IExecable<IHotelRegistryEntry[]>,
        [Record<string, 1 | -1>]
      >;
    },
    [Record<string, unknown>]
  >;
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
      find: jest.fn<
        {
          sort: jest.Mock<
            IExecable<IHotelRegistryEntry[]>,
            [Record<string, 1 | -1>]
          >;
        },
        [Record<string, unknown>]
      >(),
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
    const entries =
      existingEntry === null
        ? [existingEntry, null, upsertedEntry]
        : [existingEntry, upsertedEntry];

    for (const entry of entries) {
      hotelRegistryEntryModel.findOne.mockReturnValueOnce({
        exec: jest
          .fn<Promise<IHotelRegistryEntry | null>, []>()
          .mockResolvedValue(entry),
      });
    }
  }

  function mockFindOneResultSequence(
    entries: Array<IHotelRegistryEntry | null>,
  ): void {
    for (const entry of entries) {
      hotelRegistryEntryModel.findOne.mockReturnValueOnce({
        exec: jest
          .fn<Promise<IHotelRegistryEntry | null>, []>()
          .mockResolvedValue(entry),
      });
    }
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

  function mockFindResult(registryEntries: IHotelRegistryEntry[]): void {
    hotelRegistryEntryModel.find.mockReturnValue({
      sort: jest
        .fn<IExecable<IHotelRegistryEntry[]>, [Record<string, 1 | -1>]>()
        .mockReturnValue({
          exec: jest
            .fn<Promise<IHotelRegistryEntry[]>, []>()
            .mockResolvedValue(registryEntries),
        }),
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

  it('updates a strong registry duplicate and resolves conflicting locality from district', async () => {
    const existingEntry = buildRegistryEntry({
      capacity: {
        beds: 80,
        rooms: 40,
      },
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: null,
        district: 'HILL RESORTS - TROODOS',
        locality: 'Troodos',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'rkv1|JUBILEE|HOTELS|HILL RESORTS TROODOS|TROODOS|4800|',
    });
    const rawDuplicate: IRawHotel = {
      ...rawHotelFixture,
      address: null,
      beds: 80,
      contacts: {
        domain: 'jubileehotel.com',
        emails: ['gt@jubileehotel.com'],
        faxes: [],
        phones: ['+35722673991', '+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      locality: 'Limassol',
      name: 'JUBILEE',
      nameNormalized: 'JUBILEE',
      operatorName: 'Kyriacos Markides (Jubilee) Ltd',
      postcode: '4800',
      region: 'HILL RESORTS - TROODOS',
      rooms: 40,
    };

    mockFindOneResultSequence([null, existingEntry, existingEntry]);
    mockUpdateOneResult();

    await service.upsertFromRawHotel(rawDuplicate);

    expect(hotelRegistryEntryModel.findOne).toHaveBeenNthCalledWith(2, {
      $and: expect.arrayContaining([
        expect.objectContaining({
          'capacity.beds': 80,
          'capacity.rooms': 40,
          establishmentType: 'HOTELS',
          'location.district': 'HILL RESORTS - TROODOS',
          'location.postcode': '4800',
          'name.normalized': 'JUBILEE',
          operator: 'Kyriacos Markides (Jubilee) Ltd',
          status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
        }),
      ]),
    });
    expect(hotelRegistryEntryModel.updateOne).toHaveBeenCalledWith(
      {
        registryKey:
          'rkv1|JUBILEE|HOTELS|HILL RESORTS TROODOS|TROODOS|4800|',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          contacts: {
            domains: ['jubileehotel.com'],
            emails: ['gt@jubileehotel.com'],
            phones: ['+35722673991', '+35725420107'],
            websites: ['https://www.jubileehotel.com/'],
          },
          location: {
            address: null,
            district: 'HILL RESORTS - TROODOS',
            locality: 'Troodos',
            postcode: '4800',
          },
          registryKey:
            'rkv1|JUBILEE|HOTELS|HILL RESORTS TROODOS|TROODOS|4800|',
        }),
      }),
      {
        upsert: true,
      },
    );
  });

  it('finds same-name multi-type groups across pending, claimed, and processed entries', async () => {
    const hotelEntry = buildRegistryEntry({
      establishmentType: 'HOTELS',
      name: {
        baseName: 'NISSIANA',
        normalized: 'NISSIANA',
        original: 'NISSIANA',
        suffix: null,
      },
      processing: {
        canonicalHotelCandidateId: new Types.ObjectId(),
        claimedAt: null,
        error: null,
        processedAt: new Date('2026-05-03T09:00:00.000Z'),
        runId: 'previous-run',
        status: HOTEL_PROCESSING_STATUS.PROCESSED,
      },
      registryKey: 'nissiana-hotel',
    });
    const apartmentsEntry = buildRegistryEntry({
      establishmentType: 'HOTEL APARTMENTS',
      name: {
        baseName: 'NISSIANA',
        normalized: 'NISSIANA',
        original: 'NISSIANA',
        suffix: null,
      },
      registryKey: 'nissiana-apartments',
    });

    mockFindResult([hotelEntry]);
    mockFindResult([hotelEntry, apartmentsEntry]);

    const result =
      await service.readSafeCanonicalCandidateGroup(apartmentsEntry);

    expect(result).toEqual([hotelEntry, apartmentsEntry]);
    expect(hotelRegistryEntryModel.find).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'name.normalized': 'NISSIANA',
        'processing.status': {
          $in: [
            HOTEL_PROCESSING_STATUS.PENDING,
            HOTEL_PROCESSING_STATUS.CLAIMED,
            HOTEL_PROCESSING_STATUS.PROCESSED,
          ],
        },
        status: HOTEL_REGISTRY_ENTRY_STATUS.READY,
      }),
    );
  });

  it('finds deterministic numeric suffix groups and excludes standalone base entries', async () => {
    const standaloneEntry = buildRegistryEntry({
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      operator: 'Mr Andreas Limbourides',
      registryKey: 'thalassines-base',
    });
    const secondEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 2',
        original: 'THALASSINES 2',
        suffix: '2',
      },
      operator: 'Limbus Creations Ltd',
      registryKey: 'thalassines-2',
    });
    const tenthEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 10',
        original: 'THALASSINES 10',
        suffix: '10',
      },
      operator: 'Limbus Creations Ltd',
      registryKey: 'thalassines-10',
    });

    mockFindResult([standaloneEntry, tenthEntry, secondEntry]);

    const result = await service.readSafeCanonicalCandidateGroup(tenthEntry);

    expect(result.map(({ name }) => name.original)).toEqual([
      'THALASSINES 2',
      'THALASSINES 10',
    ]);
    expect(hotelRegistryEntryModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        'name.baseName': 'THALASSINES',
        'name.suffix': {
          $regex: '^\\d+[A-Z]?$',
        },
      }),
    );
  });

  it('finds PALATAKIA numeric suffix groups when suffixes are present', async () => {
    const secondEntry = buildRegistryEntry({
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Kato Drys',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 2',
        original: 'PALATAKIA 2',
        suffix: '2',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-2',
    });
    const thirdEntry = buildRegistryEntry({
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'K. Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 3',
        original: 'PALATAKIA 3',
        suffix: '3',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-3',
    });

    mockFindResult([thirdEntry, secondEntry]);

    const result = await service.readSafeCanonicalCandidateGroup(secondEntry);

    expect(result.map(({ name }) => name.original)).toEqual([
      'PALATAKIA 2',
      'PALATAKIA 3',
    ]);
  });

  it('groups latest-like PALATAKIA suffix and base artifacts together', async () => {
    const suffixEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 5,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA 2',
        original: 'PALATAKIA 2',
        suffix: '2',
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-2-apartments',
    });
    const duplicateBaseEntry = buildRegistryEntry({
      capacity: {
        beds: 10,
        rooms: 5,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Kato Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA',
        original: 'PALATAKIA',
        suffix: null,
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-base-apartments',
    });
    const missingSuffixEntry = buildRegistryEntry({
      capacity: {
        beds: 8,
        rooms: 4,
      },
      contacts: {
        domains: ['palatakia.com'],
        emails: ['info@palatakia.com'],
        phones: ['+35799934807'],
        websites: ['https://www.palatakia.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - HOTELS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'K. Drys, Larnaca',
        postcode: '7714',
      },
      name: {
        baseName: 'PALATAKIA',
        normalized: 'PALATAKIA',
        original: 'PALATAKIA',
        suffix: null,
      },
      operator: 'Corpaz Ltd',
      registryKey: 'palatakia-base-hotels',
    });

    mockFindResult([suffixEntry, duplicateBaseEntry, missingSuffixEntry]);

    const result =
      await service.readSafeCanonicalCandidateGroup(missingSuffixEntry);

    expect(result).toEqual([
      suffixEntry,
      duplicateBaseEntry,
      missingSuffixEntry,
    ]);
  });

  it('does not mark standalone THALASSINES as ambiguous when numeric suffix group has different operator and locality', async () => {
    const baseEntry = buildRegistryEntry({
      capacity: {
        beds: 64,
        rooms: 11,
      },
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      establishmentType: 'TOURIST VILLAS',
      location: {
        address: '77, Agias Theklas Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5391',
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      operator: 'Mr Andreas Limbourides',
      registryKey: 'thalassines-base',
    });
    const numericEntry = buildRegistryEntry({
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
      registryKey: 'thalassines-10',
    });

    mockFindResult([numericEntry]);

    const result = await service.hasCompatibleNumericSuffixGroup(baseEntry);

    expect(result).toBe(false);
  });

  it('detects THALASSINES aggregate row as a shadow of numbered suffix rows', async () => {
    const aggregateEntry = buildRegistryEntry({
      capacity: {
        beds: 64,
        rooms: 11,
      },
      contacts: {
        domains: ['thalassines.com'],
        emails: ['reservations@thalassines.com'],
        phones: ['+35723744866'],
        websites: ['https://www.thalassines.com/'],
      },
      establishmentType: 'TOURIST VILLAS',
      location: {
        address: '77, Agias Theklas Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5391',
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      operator: 'Mr Andreas Limbourides',
      registryKey: 'thalassines-aggregate',
    });
    const numberedEntries = [
      '2',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
    ].map((suffix) =>
      buildRegistryEntry({
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
        location: {
          address:
            suffix === '2' ? '77 Agias Theklas' : '77 Agias Theklas Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: `THALASSINES ${suffix}`,
          original: `THALASSINES ${suffix}`,
          suffix,
        },
        operator: 'Limbus Creations Ltd',
        registryKey: `thalassines-${suffix}`,
      }),
    );

    mockFindResult([aggregateEntry, ...numberedEntries]);

    const result =
      await service.readShadowAggregateNumericSuffixGroup(aggregateEntry);

    expect(result).not.toBeNull();
    expect(result?.shadowAggregateEntries).toEqual([aggregateEntry]);
    expect(result?.numberedEntries.map(({ name }) => name.original)).toEqual([
      'THALASSINES 2',
      'THALASSINES 7',
      'THALASSINES 8',
      'THALASSINES 9',
      'THALASSINES 10',
      'THALASSINES 11',
      'THALASSINES 12',
      'THALASSINES 13',
      'THALASSINES 14',
      'THALASSINES 15',
      'THALASSINES 16',
      'THALASSINES 17',
    ]);
  });

  it('does not shadow-ignore aggregate row when address core differs', async () => {
    const aggregateEntry = buildRegistryEntry({
      location: {
        address: '77, Agias Theklas Avenue',
        district: 'AGIA NAPA',
        locality: 'Agia Napa',
        postcode: '5391',
      },
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-aggregate',
    });
    const numberedEntries = ['2', '7', '8'].map((suffix) =>
      buildRegistryEntry({
        location: {
          address: '99 Different Avenue',
          district: 'SOTERA',
          locality: 'Sotera',
          postcode: '5391',
        },
        name: {
          baseName: 'THALASSINES',
          normalized: `THALASSINES ${suffix}`,
          original: `THALASSINES ${suffix}`,
          suffix,
        },
        registryKey: `thalassines-${suffix}`,
      }),
    );

    mockFindResult([aggregateEntry, ...numberedEntries]);

    const result =
      await service.readShadowAggregateNumericSuffixGroup(aggregateEntry);

    expect(result).toBeNull();
  });

  it('does not shadow-ignore aggregate row when there is only one numbered row', async () => {
    const aggregateEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES',
        original: 'THALASSINES',
        suffix: null,
      },
      registryKey: 'thalassines-aggregate',
    });
    const numberedEntry = buildRegistryEntry({
      name: {
        baseName: 'THALASSINES',
        normalized: 'THALASSINES 2',
        original: 'THALASSINES 2',
        suffix: '2',
      },
      registryKey: 'thalassines-2',
    });

    mockFindResult([aggregateEntry, numberedEntry]);

    const result =
      await service.readShadowAggregateNumericSuffixGroup(aggregateEntry);

    expect(result).toBeNull();
  });

  it('groups LITO base component with its numeric suffix entries', async () => {
    const baseEntry = buildRegistryEntry({
      capacity: {
        beds: 2,
        rooms: 1,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089', '+35724534630'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Skarinou',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO',
        original: 'LITO',
        suffix: null,
      },
      operator: null,
      registryKey: 'lito-base',
    });
    const secondEntry = buildRegistryEntry({
      capacity: {
        beds: 4,
        rooms: 2,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO 2',
        original: 'LITO 2',
        suffix: '2',
      },
      operator: 'Gei Land Agrotourism Ltd',
      registryKey: 'lito-2',
    });
    const thirdEntry = buildRegistryEntry({
      capacity: {
        beds: 2,
        rooms: 1,
      },
      contacts: {
        domains: ['agrotourismincyprus.com'],
        emails: ['info@agrotourismincyprus.com'],
        phones: ['+35724322089'],
        websites: ['https://www.agrotourismincyprus.com/'],
      },
      establishmentType: 'TRADITIONAL HOUSES - APARTMENTS',
      location: {
        address: null,
        district: 'LARNACA',
        locality: 'Larnaca',
        postcode: '7731',
      },
      name: {
        baseName: 'LITO',
        normalized: 'LITO 3',
        original: 'LITO 3',
        suffix: '3',
      },
      operator: 'Gemi Land Agrotourism Ltd',
      registryKey: 'lito-3',
    });

    mockFindResult([baseEntry, secondEntry, thirdEntry]);

    const result = await service.readSafeCanonicalCandidateGroup(baseEntry);

    expect(result).toEqual([secondEntry, thirdEntry, baseEntry]);
  });

  it('finds same-type strong identity groups with district-resolvable locality conflicts', async () => {
    const troodosEntry = buildRegistryEntry({
      capacity: {
        beds: 80,
        rooms: 40,
      },
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: null,
        district: 'HILL RESORTS - TROODOS',
        locality: 'Troodos',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-troodos',
    });
    const limassolEntry = buildRegistryEntry({
      capacity: {
        beds: 80,
        rooms: 40,
      },
      contacts: {
        domains: ['jubileehotel.com'],
        emails: ['gt@jubileehotel.com'],
        phones: ['+35722673991', '+35725420107'],
        websites: ['https://www.jubileehotel.com/'],
      },
      establishmentType: 'HOTELS',
      location: {
        address: null,
        district: 'HILL RESORTS - TROODOS',
        locality: 'Limassol',
        postcode: '4800',
      },
      name: {
        baseName: 'JUBILEE',
        normalized: 'JUBILEE',
        original: 'JUBILEE',
        suffix: null,
      },
      operator: 'Kyriacos Markides (Jubilee) Ltd',
      registryKey: 'jubilee-limassol',
    });

    mockFindResult([troodosEntry, limassolEntry]);

    const result = await service.readSafeCanonicalCandidateGroup(limassolEntry);

    expect(result).toEqual([troodosEntry, limassolEntry]);
  });

  it('keeps raw hotel fields when input is a Mongoose document', async () => {
    const RawHotelModel = model<IRawHotel>(
      `RawHotelRegistryEntriesServiceSpec${new Types.ObjectId().toHexString()}`,
      rawHotelSchema,
    );
    const rawHotelDocument = new RawHotelModel({
      ...rawHotelFixture,
      address: 'Poseidonos Avenue 8042, Pafos',
      locality: 'Pafos',
      postcode: '8042',
    });
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

    await service.upsertFromRawHotel(rawHotelDocument);

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
          capacity: {
            beds: 20,
            rooms: 10,
          },
          location: expect.objectContaining({
            address: 'Poseidonos Avenue',
            locality: 'Pafos',
            postcode: '8042',
          }),
          name: expect.objectContaining({
            normalized: 'EXAMPLE APARTMENTS',
            original: 'EXAMPLE APARTMENTS',
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
