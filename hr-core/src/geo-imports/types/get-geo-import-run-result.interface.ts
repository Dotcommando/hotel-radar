import { GEO_IMPORT_KIND } from '../../geo-import-runs/constants/geo-import-kind.enum';
import { GEO_IMPORT_RUN_STATUS } from '../../geo-import-runs/constants/geo-import-run-status.enum';
import { GEO_SOURCE_DATASET } from '../../geo-import-runs/constants/geo-source-dataset.enum';
import { GEO_SOURCE_TYPE } from '../../geo-import-runs/constants/geo-source-type.enum';
import { IGeoImportRunStats } from '../../geo-import-runs/types/geo-import-run-stats.interface';

export interface IGetGeoImportRunResult {
  ok: boolean;
  runId: string;
  sourceType: GEO_SOURCE_TYPE;
  sourceDataset: GEO_SOURCE_DATASET;
  importKind: GEO_IMPORT_KIND;
  status: GEO_IMPORT_RUN_STATUS;
  filePath: string;
  fileName: string;
  fileSizeBytes: number | null;
  fileSha256: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  stats: IGeoImportRunStats;
  error: string | null;
}
