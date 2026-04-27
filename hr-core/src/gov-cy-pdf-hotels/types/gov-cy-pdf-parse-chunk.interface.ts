import { IGovCyHotelSourceFile } from './gov-cy-hotel-source-file.interface';

export interface IGovCyPdfParseChunk {
  chunkIndex: number;
  chunkTotal: number;
  pageFrom: number;
  pageTo: number;
  sourceFile: IGovCyHotelSourceFile;
  uploadFilename: string;
  uploadLocalPath: string;
}
