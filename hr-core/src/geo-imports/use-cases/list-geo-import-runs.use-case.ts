import { Injectable } from '@nestjs/common';
import { IGeoImportRun } from '../../geo-import-runs/types/geo-import-run.interface';
import { GeoImportRunsService } from '../../geo-import-runs/geo-import-runs.service';
import { IGetGeoImportRunResult } from '../types/get-geo-import-run-result.interface';
import { IListGeoImportRunsResult } from '../types/list-geo-import-runs-result.interface';

@Injectable()
export class ListGeoImportRunsUseCase {
  constructor(private readonly geoImportRunsService: GeoImportRunsService) {}

  async execute(): Promise<IListGeoImportRunsResult> {
    const runs = await this.geoImportRunsService.listRecent(50);

    return {
      ok: true,
      runs: runs.map((run) => this.toResult(run)),
    };
  }

  private toResult(run: IGeoImportRun): IGetGeoImportRunResult {
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
