import { IDiscoveredGovCyPdfFile } from './discovered-gov-cy-pdf-file.interface';

export interface IDownloadedGovCyPdfFile extends IDiscoveredGovCyPdfFile {
  localPath: string;
}
