import { Inject, Injectable } from '@nestjs/common';
import { ParsedFilesService } from '../parsed-files/parsed-files.service';
import { IParsedFile } from '../parsed-files/types/parsed-file.interface';
import { RawHotelsService } from '../raw-hotels/raw-hotels.service';
import { HOTEL_PROCESSING_STAGE } from '../hotel-processing/constants/hotel-processing-stage.enum';
import { HotelProcessingRunsService } from '../hotel-processing/hotel-processing-runs.service';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import { GovCyPdfHotelsService } from './services';
import { IGovCyPdfParsingJobData } from './types/gov-cy-pdf-parsing-job-data.interface';
import type { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';

@Injectable()
export class GovCyPdfParsingProcessor {
  constructor(
    private readonly govCyPdfHotelsService: GovCyPdfHotelsService,
    private readonly rawHotelsService: RawHotelsService,
    private readonly parsedFilesService: ParsedFilesService,
    private readonly hotelProcessingRunsService: HotelProcessingRunsService,
    @Inject(GOV_CY_PDF_HOTELS_CONFIG)
    private readonly config: IGovCyPdfHotelsConfig,
  ) {}

  async processParseRun(data: IGovCyPdfParsingJobData): Promise<void> {
    if (data.stage !== HOTEL_PROCESSING_STAGE.GOV_CY_PDF_PARSE) {
      throw new Error(`Unsupported GovCy PDF parsing stage: ${data.stage}`);
    }

    await this.hotelProcessingRunsService.markRunning(data.runId, 0);

    try {
      const runTmpDirectoryPath =
        await this.govCyPdfHotelsService.prepareParsingTmpDirectory(data.runId);
      const discoveredPdfFiles =
        await this.govCyPdfHotelsService.discoverPdfFiles();
      const sourceFileNames = discoveredPdfFiles.map(
        ({ filename }) => filename,
      );
      const cachedParsedFilesMap =
        await this.readCachedParsedFilesMap(sourceFileNames);
      let processedWorkUnits = 0;
      let totalWorkUnits = 0;

      for (const discoveredPdfFile of discoveredPdfFiles) {
        if (cachedParsedFilesMap.has(discoveredPdfFile.filename)) {
          totalWorkUnits += 1;
          processedWorkUnits += 1;

          await this.hotelProcessingRunsService.setTotal(
            data.runId,
            totalWorkUnits,
          );
          await this.hotelProcessingRunsService.markRunning(
            data.runId,
            processedWorkUnits,
          );
          await this.hotelProcessingRunsService.incrementIgnored(data.runId, 1);
          continue;
        }

        const downloadedPdfFiles =
          await this.govCyPdfHotelsService.downloadPdfFiles([
            discoveredPdfFile,
          ]);
        const downloadedPdfFile = downloadedPdfFiles[0];

        if (downloadedPdfFile === undefined) {
          throw new Error(
            `PDF download did not return a file for ${discoveredPdfFile.filename}`,
          );
        }

        const recordsCount =
          await this.govCyPdfHotelsService.parsePdfFileToBatches({
            downloadedPdfFile,
            onChunkProcessed: async () => {
              processedWorkUnits += 1;

              await this.hotelProcessingRunsService.markRunning(
                data.runId,
                processedWorkUnits,
              );
              await this.hotelProcessingRunsService.incrementProcessed(
                data.runId,
                1,
                0,
              );
            },
            onChunksPrepared: async (chunkTotal) => {
              totalWorkUnits += chunkTotal;

              await this.hotelProcessingRunsService.setTotal(
                data.runId,
                totalWorkUnits,
              );
            },
            onParsedBatch: async (parsedBatch) => {
              await this.rawHotelsService.upsertManyByStrictHotelDedupeKeyAndSourceFileName(
                parsedBatch,
              );
            },
            runTmpDirectoryPath,
          });

        await this.parsedFilesService.createMany([
          {
            filename: discoveredPdfFile.filename,
            parsedAt: new Date(),
            recordsCount,
          },
        ]);
      }

      await this.hotelProcessingRunsService.complete(data.runId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown GovCy PDF parsing error';

      await this.hotelProcessingRunsService.fail(data.runId, message);
      throw error;
    } finally {
      await this.govCyPdfHotelsService
        .cleanupParsingTmpDirectory(data.runId)
        .catch((cleanupError: unknown) => {
          const message =
            cleanupError instanceof Error
              ? cleanupError.message
              : 'Unknown tmp cleanup error';

          console.warn(
            `[GovCyPdfParsingProcessor] failed to cleanup tmp directory runId=${data.runId} error=${message}`,
          );
        });
    }
  }

  private async readCachedParsedFilesMap(
    fileNames: string[],
  ): Promise<Map<string, IParsedFile>> {
    const parsedAtFrom = new Date(Date.now() - this.config.parsingCacheTimeMs);
    const cachedParsedFiles =
      await this.parsedFilesService.readManyByFileNamesAndParsedAtFrom(
        fileNames,
        parsedAtFrom,
      );
    const cachedParsedFilesMap = new Map<string, IParsedFile>();

    for (const cachedParsedFile of cachedParsedFiles) {
      const existingParsedFile = cachedParsedFilesMap.get(
        cachedParsedFile.filename,
      );

      if (
        existingParsedFile === undefined ||
        existingParsedFile.parsedAt.getTime() <
          cachedParsedFile.parsedAt.getTime()
      ) {
        cachedParsedFilesMap.set(cachedParsedFile.filename, cachedParsedFile);
      }
    }

    return cachedParsedFilesMap;
  }
}
