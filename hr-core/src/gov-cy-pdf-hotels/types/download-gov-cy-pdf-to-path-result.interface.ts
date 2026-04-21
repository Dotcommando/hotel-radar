import { PDF_DOWNLOAD_METHOD } from '../constants/pdf-download-method.constant';

export interface IDownloadGovCyPdfToPathResult {
  bytes: Buffer;
  method: PDF_DOWNLOAD_METHOD;
}
