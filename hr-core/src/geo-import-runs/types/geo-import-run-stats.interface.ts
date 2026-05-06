export interface IGeoImportRunStats {
  read: number;
  inserted: number;
  updated: number;
  unchanged: number;
  markedStale: number;
  failed: number;
}
