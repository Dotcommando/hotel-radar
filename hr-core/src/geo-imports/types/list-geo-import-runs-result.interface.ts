import { IGetGeoImportRunResult } from './get-geo-import-run-result.interface';

export interface IListGeoImportRunsResult {
  ok: boolean;
  runs: IGetGeoImportRunResult[];
}
