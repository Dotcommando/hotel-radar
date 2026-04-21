import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PARSED_FILE_MODEL_NAME } from './constants/parsed-file-model-name.constant';
import { ICreateParsedFile } from './types/create-parsed-file.interface';
import { IParsedFile } from './types/parsed-file.interface';

@Injectable()
export class ParsedFilesService {
  constructor(
    @InjectModel(PARSED_FILE_MODEL_NAME)
    private readonly parsedFileModel: Model<IParsedFile>,
  ) {}

  async createMany(parsedFiles: ICreateParsedFile[]): Promise<IParsedFile[]> {
    if (parsedFiles.length === 0) {
      return [];
    }

    return this.parsedFileModel.insertMany(parsedFiles, { ordered: true });
  }

  async readManyByFileNamesAndParsedAtFrom(
    fileNames: string[],
    parsedAtFrom: Date,
  ): Promise<IParsedFile[]> {
    if (fileNames.length === 0) {
      return [];
    }

    return this.parsedFileModel.find({
      filename: {
        $in: fileNames,
      },
      parsedAt: {
        $gte: parsedAtFrom,
      },
    }).exec();
  }

  async deleteManyByFileNames(fileNames: string[]): Promise<number> {
    if (fileNames.length === 0) {
      return 0;
    }

    const deleteResult = await this.parsedFileModel.deleteMany({
      filename: {
        $in: fileNames,
      },
    }).exec();

    return deleteResult.deletedCount ?? 0;
  }
}
