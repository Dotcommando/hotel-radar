export interface IGovCyPdfHotelsConfig {
  apifyActorId: string;
  apifyToken: string | null;
  downloadTimeoutMs: number;
  govCyHotelsPageUrl: string;
  openAiApiKey: string | null;
  openAiModel: string;
  openAiResponsesTimeoutMs: number;
  storageDirectoryPath: string;
}
