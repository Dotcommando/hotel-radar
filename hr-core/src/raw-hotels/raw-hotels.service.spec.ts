import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RawHotelsService } from './raw-hotels.service';
import { RAW_HOTEL_MODEL_NAME } from './constants/raw-hotel-model-name.constant';
import { ICreateRawHotel } from './types/create-raw-hotel.interface';
import { IRawHotel } from './types/raw-hotel.interface';

interface IInsertManyOptions {
  ordered?: boolean;
}

interface IDeleteManyResult {
  deletedCount?: number;
}

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface IRawHotelModelMock {
  insertMany: jest.Mock<Promise<IRawHotel[]>, [ICreateRawHotel[], IInsertManyOptions]>;
  find: jest.Mock<IExecable<IRawHotel[]>, [Record<string, unknown>]>;
  deleteMany: jest.Mock<IExecable<IDeleteManyResult>, [Record<string, unknown>]>;
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
    region: 'Pafos',
    rooms: 177,
    sourceFile: {
      filename: 'POLIS_HOTELS_16.2.2026.pdf',
      localPath: '/opt/media-factory/data/files/2026-02-16/POLIS_HOTELS_16.2.2026.pdf',
      pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/02/POLIS_HOTELS_16.2.2026.pdf',
    },
    stars: 5,
    updatedAt: new Date('2026-02-20T00:00:00.000Z'),
  };

  beforeEach(async () => {
    rawHotelModel = {
      deleteMany: jest.fn(),
      find: jest.fn(),
      insertMany: jest.fn(),
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
    const rawHotels: ICreateRawHotel[] = [rawHotelFixture];

    rawHotelModel.insertMany.mockResolvedValue([rawHotelFixture]);

    const result = await service.createMany(rawHotels);

    expect(rawHotelModel.insertMany).toHaveBeenCalledWith(rawHotels, { ordered: true });
    expect(result).toEqual([rawHotelFixture]);
  });

  it('returns an empty array when createMany receives no records', async () => {
    const result = await service.createMany([]);

    expect(rawHotelModel.insertMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('reads many raw hotels by source file names', async () => {
    const exec = jest.fn<Promise<IRawHotel[]>, []>().mockResolvedValue([rawHotelFixture]);

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

  it('returns zero when deleteManyBySourceFileNames receives no file names', async () => {
    const result = await service.deleteManyBySourceFileNames([]);

    expect(rawHotelModel.deleteMany).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
