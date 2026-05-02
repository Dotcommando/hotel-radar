import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RawHotelsService } from './raw-hotels.service';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IPersistedRawHotel } from './types/persisted-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';
import { HOTEL_PROCESSING_STATUS } from '../hotel-processing/constants/hotel-processing-status.enum';
import {
  makeAddressMergeHotelDedupeKey,
  makeNameMatchKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from './utils/hotel-identity.util';

interface IInsertManyOptions {
  ordered?: boolean;
}

interface IUpdateOneOptions {
  upsert?: boolean;
}

interface IDeleteManyResult {
  deletedCount?: number;
}

interface IUpdateOneResult {
  matchedCount?: number;
  modifiedCount?: number;
  upsertedCount?: number;
}

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface ISortableExecable<TResult> {
  sort: jest.Mock<IExecable<TResult>, [Record<string, 1 | -1>]>;
}

interface IRawHotelModelMock {
  insertMany: jest.Mock<
    Promise<IRawHotel[]>,
    [ICreateRawHotel[], IInsertManyOptions]
  >;
  find: jest.Mock<IExecable<IRawHotel[]>, [Record<string, unknown>]>;
  findOne: jest.Mock<
    ISortableExecable<IPersistedRawHotel | null>,
    [Record<string, unknown>]
  >;
  updateOne: jest.Mock<
    IExecable<IUpdateOneResult>,
    [Record<string, unknown>, Record<string, unknown>, IUpdateOneOptions?]
  >;
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
      deleteMany: jest.fn<
        IExecable<IDeleteManyResult>,
        [Record<string, unknown>]
      >(),
      find: jest.fn<IExecable<IRawHotel[]>, [Record<string, unknown>]>(),
      findOne: jest.fn<
        ISortableExecable<IPersistedRawHotel | null>,
        [Record<string, unknown>]
      >(),
      insertMany: jest.fn<
        Promise<IRawHotel[]>,
        [ICreateRawHotel[], IInsertManyOptions]
      >(),
      updateOne: jest.fn<
        IExecable<IUpdateOneResult>,
        [Record<string, unknown>, Record<string, unknown>, IUpdateOneOptions?]
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

  function mockFindOneResult(rawHotel: IPersistedRawHotel | null): void {
    const exec = jest
      .fn<Promise<IPersistedRawHotel | null>, []>()
      .mockResolvedValue(rawHotel);
    const sort = jest
      .fn<IExecable<IPersistedRawHotel | null>, [Record<string, 1 | -1>]>()
      .mockReturnValue({ exec });

    rawHotelModel.findOne.mockReturnValue({ sort });
  }

  function mockUpdateOneResult(result: IUpdateOneResult = {}): void {
    const exec = jest
      .fn<Promise<IUpdateOneResult>, []>()
      .mockResolvedValue(result);

    rawHotelModel.updateOne.mockReturnValue({ exec });
  }

  it('creates many raw hotels in a single insertMany call', async () => {
    const rawHotels: ICreateRawHotel[] = [createRawHotelFixture];

    rawHotelModel.insertMany.mockResolvedValue([rawHotelFixture]);

    const result = await service.createMany(rawHotels);

    expect(rawHotelModel.insertMany).toHaveBeenCalledWith(
      [
        {
          ...createRawHotelFixture,
          addressMergeDedupeKey: makeAddressMergeHotelDedupeKey({
            contacts: rawHotelFixture.contacts,
            establishmentType: rawHotelFixture.establishmentType,
            locality: rawHotelFixture.locality,
            nameNormalized: normalizeHotelName(rawHotelFixture.name),
            operatorName: rawHotelFixture.operatorName,
            postcode: rawHotelFixture.postcode,
            region: rawHotelFixture.region,
          }),
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
    mockFindOneResult(null);
    mockUpdateOneResult();

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
    const addressMergeDedupeKey = makeAddressMergeHotelDedupeKey({
      contacts: rawHotelFixture.contacts,
      establishmentType: rawHotelFixture.establishmentType,
      locality: rawHotelFixture.locality,
      nameNormalized,
      operatorName: rawHotelFixture.operatorName,
      postcode: rawHotelFixture.postcode,
      region: rawHotelFixture.region,
    });

    expect(rawHotelModel.findOne).toHaveBeenCalledWith({
      $and: [
        {
          'sourceFile.filename': rawHotelFixture.sourceFile.filename,
        },
        {
          $or: [
            {
              address: null,
            },
            {
              address: '',
            },
            {
              address: {
                $exists: false,
              },
            },
          ],
        },
        {
          $or: [
            {
              addressMergeDedupeKey,
            },
            {
              'contacts.phones.0': rawHotelFixture.contacts.phones[0],
              establishmentType: rawHotelFixture.establishmentType,
              locality: rawHotelFixture.locality,
              nameNormalized,
              operatorName: rawHotelFixture.operatorName,
              postcode: rawHotelFixture.postcode,
              region: rawHotelFixture.region,
            },
          ],
        },
      ],
    });
    expect(rawHotelModel.updateOne).toHaveBeenCalledWith(
      {
        'sourceFile.filename': rawHotelFixture.sourceFile.filename,
        strictHotelDedupeKey,
      },
      {
        $set: {
          address: rawHotelFixture.address,
          addressMergeDedupeKey,
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
      {
        upsert: true,
      },
    );
    expect(result).toBe(1);
  });

  it('replaces a matching raw hotel without address when the new record has address', async () => {
    const existingRawHotel: IPersistedRawHotel = {
      ...rawHotelFixture,
      _id: new Types.ObjectId('662000000000000000000001'),
      address: null,
      beds: 1,
      rooms: null,
    };
    const richerRawHotel: ICreateRawHotel = {
      ...createRawHotelFixture,
      address: 'Lofou 4716, Limassol',
      beds: 6,
      rooms: null,
    };

    mockFindOneResult(existingRawHotel);
    mockUpdateOneResult();

    const result =
      await service.upsertManyByStrictHotelDedupeKeyAndSourceFileName([
        richerRawHotel,
      ]);

    expect(rawHotelModel.updateOne).toHaveBeenCalledWith(
      {
        _id: existingRawHotel._id,
      },
      {
        $set: expect.objectContaining({
          address: richerRawHotel.address,
          beds: richerRawHotel.beds,
          rooms: richerRawHotel.rooms,
        }),
      },
    );
    expect(result).toBe(1);
  });

  it('does not replace a matching raw hotel with address when the new record has no address', async () => {
    const existingRawHotel: IPersistedRawHotel = {
      ...rawHotelFixture,
      _id: new Types.ObjectId('662000000000000000000002'),
      address: 'Lofou 4716, Limassol',
      beds: 6,
      rooms: null,
    };
    const poorerRawHotel: ICreateRawHotel = {
      ...createRawHotelFixture,
      address: null,
      beds: 1,
      rooms: null,
    };

    mockFindOneResult(existingRawHotel);
    mockUpdateOneResult();

    const result =
      await service.upsertManyByStrictHotelDedupeKeyAndSourceFileName([
        poorerRawHotel,
      ]);

    expect(rawHotelModel.updateOne).not.toHaveBeenCalled();
    expect(result).toBe(1);
  });

  it('returns zero when upsertManyByStrictHotelDedupeKeyAndSourceFileName receives no records', async () => {
    const result =
      await service.upsertManyByStrictHotelDedupeKeyAndSourceFileName([]);

    expect(rawHotelModel.findOne).not.toHaveBeenCalled();
    expect(rawHotelModel.updateOne).not.toHaveBeenCalled();
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
