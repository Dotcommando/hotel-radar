import { Inject, Injectable } from '@nestjs/common';
import { ParsedFilesService } from '../../parsed-files/parsed-files.service';
import { IParsedFile } from '../../parsed-files/types/parsed-file.interface';
import { RawHotelsService } from '../../raw-hotels/raw-hotels.service';
import { GOV_CY_PDF_HOTELS_CONFIG } from '../constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsService } from '../gov-cy-pdf-hotels.service';
import { IGovCyPdfParsedFileResult } from '../types/gov-cy-pdf-parsed-file-result.interface';
import { IGovCyPdfParsingResult } from '../types/gov-cy-pdf-parsing-result.interface';
import type { IGovCyPdfHotelsConfig } from '../types/gov-cy-pdf-hotels-config.interface';

@Injectable()
export class RunGovCyPdfParsingUseCase {
  private inFlightExecution: Promise<IGovCyPdfParsingResult> | null = null;

  constructor(
    private readonly govCyPdfHotelsService: GovCyPdfHotelsService,
    private readonly rawHotelsService: RawHotelsService,
    private readonly parsedFilesService: ParsedFilesService,
    @Inject(GOV_CY_PDF_HOTELS_CONFIG)
    private readonly config: IGovCyPdfHotelsConfig,
  ) {}

  async execute(): Promise<IGovCyPdfParsingResult> {
    if (this.inFlightExecution !== null) {
      console.log('[RunGovCyPdfParsingUseCase] reusing in-flight parsing execution');
      return this.inFlightExecution;
    }

    console.log('[RunGovCyPdfParsingUseCase] starting parsing flow');
    this.inFlightExecution = this.runParsing();

    try {
      return await this.inFlightExecution;
    } finally {
      this.inFlightExecution = null;
    }
  }

  private async runParsing(): Promise<IGovCyPdfParsingResult> {
    console.log('[RunGovCyPdfParsingUseCase] discovering PDF files');
    const discoveredPdfFiles = await this.govCyPdfHotelsService.discoverPdfFiles();
    const sourceFileNames = discoveredPdfFiles.map(({ filename }) => filename);
    const cachedParsedFilesMap = await this.readCachedParsedFilesMap(sourceFileNames);
    const files: IGovCyPdfParsedFileResult[] = [];

    for (const discoveredPdfFile of discoveredPdfFiles) {
      const cachedParsedFile = cachedParsedFilesMap.get(discoveredPdfFile.filename);

      if (cachedParsedFile !== undefined) {
        console.log(
          `[RunGovCyPdfParsingUseCase] skipping cached file filename=${discoveredPdfFile.filename} records=${cachedParsedFile.recordsCount}`,
        );
        files.push({
          filename: discoveredPdfFile.filename,
          recordsCount: cachedParsedFile.recordsCount,
        });
        continue;
      }

      console.log(
        `[RunGovCyPdfParsingUseCase] processing file filename=${discoveredPdfFile.filename}`,
      );

      const downloadedPdfFiles = await this.govCyPdfHotelsService.downloadPdfFiles([
        discoveredPdfFile,
      ]);
      const parsedRecords = await this.govCyPdfHotelsService.parsePdfFiles(downloadedPdfFiles);

      console.log(
        `[RunGovCyPdfParsingUseCase] saving parsed file filename=${discoveredPdfFile.filename} records=${parsedRecords.length}`,
      );
      await this.rawHotelsService.createMany(parsedRecords);
      await this.parsedFilesService.createMany([
        {
          filename: discoveredPdfFile.filename,
          parsedAt: new Date(),
          recordsCount: parsedRecords.length,
        },
      ]);

      files.push({
        filename: discoveredPdfFile.filename,
        recordsCount: parsedRecords.length,
      });
    }

    console.log(
      `[RunGovCyPdfParsingUseCase] parsing completed, files=${files.length}`,
    );

    return {
      files,
    };
  }

  private async readCachedParsedFilesMap(
    fileNames: string[],
  ): Promise<Map<string, IParsedFile>> {
    const parsedAtFrom = new Date(Date.now() - this.config.parsingCacheTimeMs);
    const cachedParsedFiles = await this.parsedFilesService.readManyByFileNamesAndParsedAtFrom(
      fileNames,
      parsedAtFrom,
    );
    const cachedParsedFilesMap = new Map<string, IParsedFile>();

    for (const cachedParsedFile of cachedParsedFiles) {
      const existingParsedFile = cachedParsedFilesMap.get(cachedParsedFile.filename);

      if (
        existingParsedFile === undefined
        || existingParsedFile.parsedAt.getTime() < cachedParsedFile.parsedAt.getTime()
      ) {
        cachedParsedFilesMap.set(cachedParsedFile.filename, cachedParsedFile);
      }
    }

    return cachedParsedFilesMap;
  }
}
