import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PARSED_FILE_MODEL_NAME } from './constants/parsed-file-model-name.constant';
import { ParsedFilesService } from './parsed-files.service';
import { ICreateParsedFile } from './types/create-parsed-file.interface';
import { IParsedFile } from './types/parsed-file.interface';

interface IInsertManyOptions {
  ordered?: boolean;
}

interface IDeleteManyResult {
  deletedCount?: number;
}

interface IExecable<TResult> {
  exec: jest.Mock<Promise<TResult>, []>;
}

interface IParsedFileModelMock {
  deleteMany: jest.Mock<IExecable<IDeleteManyResult>, [Record<string, unknown>]>;
  find: jest.Mock<IExecable<IParsedFile[]>, [Record<string, unknown>]>;
  insertMany: jest.Mock<Promise<IParsedFile[]>, [ICreateParsedFile[], IInsertManyOptions]>;
}

describe('ParsedFilesService', () => {
  let service: ParsedFilesService;
  let parsedFileModel: IParsedFileModelMock;

  const parsedFileFixture: IParsedFile = {
    filename: 'HOTELS_POLIS_8.4.2026.pdf',
    parsedAt: new Date('2026-04-21T12:00:00.000Z'),
    recordsCount: 28,
  };

  beforeEach(async () => {
    parsedFileModel = {
      deleteMany: jest.fn(),
      find: jest.fn(),
      insertMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParsedFilesService,
        {
          provide: getModelToken(PARSED_FILE_MODEL_NAME),
          useValue: parsedFileModel,
        },
      ],
    }).compile();

    service = module.get<ParsedFilesService>(ParsedFilesService);
  });

  it('creates many parsed files in a single insertMany call', async () => {
    parsedFileModel.insertMany.mockResolvedValue([parsedFileFixture]);

    const result = await service.createMany([parsedFileFixture]);

    expect(parsedFileModel.insertMany).toHaveBeenCalledWith(
      [parsedFileFixture],
      { ordered: true },
    );
    expect(result).toEqual([parsedFileFixture]);
  });

  it('returns an empty array when createMany receives no records', async () => {
    const result = await service.createMany([]);

    expect(parsedFileModel.insertMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('reads many parsed files by file names and parsedAt lower bound', async () => {
    const parsedAtFrom = new Date('2026-04-21T11:00:00.000Z');
    const exec = jest.fn<Promise<IParsedFile[]>, []>().mockResolvedValue([parsedFileFixture]);

    parsedFileModel.find.mockReturnValue({ exec });

    const result = await service.readManyByFileNamesAndParsedAtFrom(
      [parsedFileFixture.filename],
      parsedAtFrom,
    );

    expect(parsedFileModel.find).toHaveBeenCalledWith({
      filename: {
        $in: [parsedFileFixture.filename],
      },
      parsedAt: {
        $gte: parsedAtFrom,
      },
    });
    expect(result).toEqual([parsedFileFixture]);
  });

  it('returns an empty array when readManyByFileNamesAndParsedAtFrom receives no file names', async () => {
    const result = await service.readManyByFileNamesAndParsedAtFrom(
      [],
      new Date('2026-04-21T11:00:00.000Z'),
    );

    expect(parsedFileModel.find).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('deletes many parsed files by file names', async () => {
    const exec = jest.fn<Promise<IDeleteManyResult>, []>().mockResolvedValue({
      deletedCount: 2,
    });

    parsedFileModel.deleteMany.mockReturnValue({ exec });

    const result = await service.deleteManyByFileNames([parsedFileFixture.filename]);

    expect(parsedFileModel.deleteMany).toHaveBeenCalledWith({
      filename: {
        $in: [parsedFileFixture.filename],
      },
    });
    expect(result).toBe(2);
  });

  it('returns zero when deleteManyByFileNames receives no file names', async () => {
    const result = await service.deleteManyByFileNames([]);

    expect(parsedFileModel.deleteMany).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
