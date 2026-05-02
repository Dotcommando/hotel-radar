import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RawHotelsService } from './raw-hotels.service';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import {
  makeNameMatchKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './utils/hotel-identity.util';

interface IInsertManyOptions {
  ordered?: boolean;
}

interface IBulkWriteOptions {
  ordered?: boolean;
}

interface IDeleteManyResult {
  deletedCount?: number;
}

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface IRawHotelModelMock {
  bulkWrite: jest.Mock<
    Promise<unknown>,
    [Array<Record<string, unknown>>, IBulkWriteOptions]
  >;
  insertMany: jest.Mock<
    Promise<IRawHotel[]>,
    [ICreateRawHotel[], IInsertManyOptions]
  >;
  find: jest.Mock<IExecable<IRawHotel[]>, [Record<string, unknown>]>;
  deleteMany: jest.Mock<
    IExecable<IDeleteManyResult>,
    [Record<string, unknown>]
  >;
}

describe('RawHotelsService', () => {
  let service: RawHotelsService;
  let rawHotelModel: IRawHotelModelMock;

  const rawHotelFixture: IRawHotel = {
    address: '40, Alekos Michailides Rd',
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
    processing: {
      claimedAt: null,
      error: null,
      hotelRegistryEntryId: null,
      processedAt: null,
      runId: null,
      status: HOTEL_PROCESSING_STATUS.PENDING,
    },
    region: 'Pafos',
    rooms: 177,
    sourceFile: {
      filename: 'POLIS_HOTELS_16.2.2026.pdf',
      localPath:
        '/opt/media-factory/data/files/2026-02-16/POLIS_HOTELS_16.2.2026.pdf',
      pdfUrl:
        'https://www.gov.cy/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
    },
    stars: 5,
    updatedAt: new Date('2026-02-20T00:00:00.000Z'),
  };
  const { processing, ...createRawHotelFixture } = rawHotelFixture;
  void processing;

  beforeEach(async () => {
    rawHotelModel = {
      bulkWrite: jest.fn<
        Promise<unknown>,
        [Array<Record<string, unknown>>, IBulkWriteOptions]
      >(),
      deleteMany: jest.fn<
        IExecable<IDeleteManyResult>,
        [Record<string, unknown>]
      >(),
      find: jest.fn<IExecable<IRawHotel[]>, [Record<string, unknown>]>(),
      insertMany: jest.fn<
        Promise<IRawHotel[]>,
        [ICreateRawHotel[], IInsertManyOptions]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RawHotelsService,
        {
          provide: getModelToken(RAW_HOTEL_MODEL_NAME),
          useValue: rawHotelModel,
        },
      ],
    }).compile();

    service = module.get<RawHotelsService>(RawHotelsService);
  });

  it('creates many raw hotels in a single insertMany call', async () => {
    const rawHotels: ICreateRawHotel[] = [createRawHotelFixture];

    rawHotelModel.insertMany.mockResolvedValue([rawHotelFixture]);

    const result = await service.createMany(rawHotels);

    expect(rawHotelModel.insertMany).toHaveBeenCalledWith(
      [
        {
          ...createRawHotelFixture,
          nameMatchKey: makeNameMatchKey(
            normalizeHotelName(rawHotelFixture.name),
          ),
          nameNormalized: normalizeHotelName(rawHotelFixture.name),
          strictHotelDedupeKey: makeStrictHotelDedupeKey({
            beds: rawHotelFixture.beds,
            contacts: rawHotelFixture.contacts,
            nameNormalized: normalizeHotelName(rawHotelFixture.name),
            postcode: rawHotelFixture.postcode,
            rooms: rawHotelFixture.rooms,
          }),
        },
      ],
      { ordered: true },
    );
    expect(result).toEqual([rawHotelFixture]);
  });

  it('returns an empty array when createMany receives no records', async () => {
    const result = await service.createMany([]);

    expect(rawHotelModel.insertMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('upserts many raw hotels by source file name and strict dedupe key', async () => {
    rawHotelModel.bulkWrite.mockResolvedValue({});

    const result =
      await service.upsertManyByStrictHotelDedupeKeyAndSourceFileName([
        createRawHotelFixture,
      ]);

    const nameNormalized = normalizeHotelName(rawHotelFixture.name);
    const nameMatchKey = makeNameMatchKey(nameNormalized);
    const strictHotelDedupeKey = makeStrictHotelDedupeKey({
      beds: rawHotelFixture.beds,
      contacts: rawHotelFixture.contacts,
      nameNormalized,
      postcode: rawHotelFixture.postcode,
      rooms: rawHotelFixture.rooms,
    });

    expect(rawHotelModel.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: {
              'sourceFile.filename': rawHotelFixture.sourceFile.filename,
              strictHotelDedupeKey,
            },
            update: {
              $set: {
                address: rawHotelFixture.address,
                beds: rawHotelFixture.beds,
                classRaw: rawHotelFixture.classRaw,
                contacts: rawHotelFixture.contacts,
                establishmentType: rawHotelFixture.establishmentType,
                licenseStatus: rawHotelFixture.licenseStatus,
                locality: rawHotelFixture.locality,
                managerName: rawHotelFixture.managerName,
                name: rawHotelFixture.name,
                nameMatchKey,
                nameNormalized,
                operatorName: rawHotelFixture.operatorName,
                postcode: rawHotelFixture.postcode,
                region: rawHotelFixture.region,
                rooms: rawHotelFixture.rooms,
                sourceFile: rawHotelFixture.sourceFile,
                stars: rawHotelFixture.stars,
                strictHotelDedupeKey,
                updatedAt: rawHotelFixture.updatedAt,
              },
              $setOnInsert: {
                createdAt: rawHotelFixture.createdAt,
                processing: {
                  claimedAt: null,
                  error: null,
                  hotelRegistryEntryId: null,
                  processedAt: null,
                  runId: null,
                  status: HOTEL_PROCESSING_STATUS.PENDING,
                },
              },
            },
            upsert: true,
          },
        },
      ],
      { ordered: true },
    );
    expect(result).toBe(1);
  });

  it('returns zero when upsertManyByStrictHotelDedupeKeyAndSourceFileName receives no records', async () => {
    const result =
      await service.upsertManyByStrictHotelDedupeKeyAndSourceFileName([]);

    expect(rawHotelModel.bulkWrite).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });

  it('reads many raw hotels by source file names', async () => {
    const exec = jest
      .fn<Promise<IRawHotel[]>, []>()
      .mockResolvedValue([rawHotelFixture]);

    rawHotelModel.find.mockReturnValue({ exec });

    const result = await service.readManyBySourceFileNames([
      rawHotelFixture.sourceFile.filename,
    ]);

    expect(rawHotelModel.find).toHaveBeenCalledWith({
      'sourceFile.filename': {
        $in: [rawHotelFixture.sourceFile.filename],
      },
    });
    expect(result).toEqual([rawHotelFixture]);
  });

  it('returns an empty array when readManyBySourceFileNames receives no file names', async () => {
    const result = await service.readManyBySourceFileNames([]);

    expect(rawHotelModel.find).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('deletes many raw hotels by source file names', async () => {
    const exec = jest.fn<Promise<IDeleteManyResult>, []>().mockResolvedValue({
      deletedCount: 3,
    });

    rawHotelModel.deleteMany.mockReturnValue({ exec });

    const result = await service.deleteManyBySourceFileNames([
      rawHotelFixture.sourceFile.filename,
    ]);

    expect(rawHotelModel.deleteMany).toHaveBeenCalledWith({
      'sourceFile.filename': {
        $in: [rawHotelFixture.sourceFile.filename],
      },
    });
    expect(result).toBe(3);
  });

  it('reads many raw hotels by source file names and createdAt lower bound', async () => {
    const createdAtFrom = new Date('2026-02-20T00:00:00.000Z');
    const exec = jest
      .fn<Promise<IRawHotel[]>, []>()
      .mockResolvedValue([rawHotelFixture]);

    rawHotelModel.find.mockReturnValue({ exec });

    const result = await service.readManyBySourceFileNamesAndCreatedAtFrom(
      [rawHotelFixture.sourceFile.filename],
      createdAtFrom,
    );

    expect(rawHotelModel.find).toHaveBeenCalledWith({
      'sourceFile.filename': {
        $in: [rawHotelFixture.sourceFile.filename],
      },
      createdAt: {
        $gte: createdAtFrom,
      },
    });
    expect(result).toEqual([rawHotelFixture]);
  });

  it('returns zero when deleteManyBySourceFileNames receives no file names', async () => {
    const result = await service.deleteManyBySourceFileNames([]);

    expect(rawHotelModel.deleteMany).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
