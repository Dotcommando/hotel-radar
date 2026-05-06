import { Injectable } from '@nestjs/common';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { GeoImportRunNotFoundError } from '../errors/geo-import-run-not-found.error';
import { IGetGeoImportRunResult } from '../types/get-geo-import-run-result.interface';

@Injectable()
export class GetGeoImportRunUseCase {
  constructor(private readonly geoImportRunsService: GeoImportRunsService) {}

  async execute(runId: string): Promise<IGetGeoImportRunResult> {
    const run = await this.geoImportRunsService.findByRunId(runId);

    if (run === null) {
      throw new GeoImportRunNotFoundError();
    }

    return {
      error: run.error,
      fileName: run.fileName,
      filePath: run.filePath,
      fileSha256: run.fileSha256,
      fileSizeBytes: run.fileSizeBytes,
      finishedAt: run.finishedAt,
      importKind: run.importKind,
      ok: true,
      runId: run.runId,
      sourceDataset: run.sourceDataset,
      sourceType: run.sourceType,
      startedAt: run.startedAt,
      stats: run.stats,
      status: run.status,
    };
  }
}
