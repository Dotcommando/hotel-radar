import { constants } from 'node:fs';
import {
  access,
  chmod,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { Inject, Injectable } from '@nestjs/common';
import { basename, join } from 'node:path';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import {
  APIFY_DATASET_ITEMS_URL,
  GOV_CY_PDF_DOC_TYPE,
  OPENAI_FILES_URL,
  OPENAI_RESPONSES_URL,
} from './constants/gov-cy-pdf-hotels.constants';
import {
  OPENAI_PARSE_PDF_JSON_SCHEMA,
  OPENAI_PARSE_PDF_SYSTEM_PROMPT,
  OPENAI_PARSE_PDF_USER_PROMPT,
} from './constants/openai-parse-pdf.constants';
import { PDF_DISCOVERY_PAGE_FUNCTION } from './constants/pdf-discovery-page-function.constant';
import { IApifyPdfLinksItem } from './types/apify-pdf-links-item.interface';
import { IDownloadedGovCyPdfFile } from './types/downloaded-gov-cy-pdf-file.interface';
import { IDiscoveredGovCyPdfFile } from './types/discovered-gov-cy-pdf-file.interface';
import { IOpenAiFileUploadResponse } from './types/openai-file-upload-response.interface';
import { IOpenAiHotelsEnvelope } from './types/openai-hotels-envelope.interface';
import { IOpenAiResponse } from './types/openai-response.interface';
import { IRecognizedGovCyHotelRecord } from './types/recognized-gov-cy-hotel-record.interface';
import type { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';

@Injectable()
export class GovCyPdfHotelsService {
  constructor(
    @Inject(GOV_CY_PDF_HOTELS_CONFIG)
    private readonly config: IGovCyPdfHotelsConfig,
  ) {}

  async collectDownloadAndParsePdfFiles(): Promise<IRecognizedGovCyHotelRecord[]> {
    const discoveredPdfFiles = await this.discoverPdfFiles();
    const downloadedPdfFiles = await this.downloadPdfFiles(discoveredPdfFiles);

    return this.parsePdfFiles(downloadedPdfFiles);
  }

  async discoverPdfFiles(): Promise<IDiscoveredGovCyPdfFile[]> {
    const apifyToken = this.getRequiredConfigValue(this.config.apifyToken, 'APIFY_TOKEN');
    const response = await fetch(
      `${APIFY_DATASET_ITEMS_URL}/${this.config.apifyActorId}/run-sync-get-dataset-items`,
      {
        body: JSON.stringify({
          injectJQuery: true,
          maxCrawlingDepth: 0,
          maxRequestsPerCrawl: 1,
          pageFunction: PDF_DISCOVERY_PAGE_FUNCTION,
          proxyConfiguration: {
            useApifyProxy: true,
          },
          startUrls: [
            {
              url: this.config.govCyHotelsPageUrl,
            },
          ],
        }),
        headers: {
          Authorization: `Bearer ${apifyToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: AbortSignal.timeout(this.config.downloadTimeoutMs),
      },
    );

    await this.assertOkResponse(response, 'Apify PDF discovery');

    const body = await response.json() as IApifyPdfLinksItem[];

    return this.normalizeDiscoveredPdfFiles(body);
  }

  async ensureStorageDirectoryIsWritable(): Promise<string> {
    await mkdir(this.config.storageDirectoryPath, { recursive: true });
    await chmod(this.config.storageDirectoryPath, 0o775);
    await access(this.config.storageDirectoryPath, constants.W_OK);

    return this.config.storageDirectoryPath;
  }

  async downloadPdfFiles(pdfFiles: IDiscoveredGovCyPdfFile[]): Promise<IDownloadedGovCyPdfFile[]> {
    if (pdfFiles.length === 0) {
      return [];
    }

    const storageDirectoryPath = await this.ensureStorageDirectoryIsWritable();
    const downloadedPdfFiles: IDownloadedGovCyPdfFile[] = [];

    for (const pdfFile of pdfFiles) {
      const datedDirectoryPath = join(
        storageDirectoryPath,
        this.resolveDatedDirectoryName(pdfFile),
      );

      await mkdir(datedDirectoryPath, { recursive: true });

      const response = await fetch(pdfFile.pdfUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.downloadTimeoutMs),
      });

      await this.assertOkResponse(response, `PDF download: ${pdfFile.pdfUrl}`);

      const localPath = join(datedDirectoryPath, pdfFile.filename);
      const fileBuffer = Buffer.from(await response.arrayBuffer());

      await writeFile(localPath, fileBuffer);

      downloadedPdfFiles.push({
        ...pdfFile,
        localPath,
      });
    }

    return downloadedPdfFiles;
  }

  async parsePdfFiles(
    downloadedPdfFiles: IDownloadedGovCyPdfFile[],
  ): Promise<IRecognizedGovCyHotelRecord[]> {
    if (downloadedPdfFiles.length === 0) {
      return [];
    }

    const recognizedHotels: IRecognizedGovCyHotelRecord[] = [];

    for (const downloadedPdfFile of downloadedPdfFiles) {
      const openAiFileId = await this.uploadPdfFile(downloadedPdfFile);
      const openAiEnvelope = await this.requestParsedHotels(openAiFileId);

      for (const hotel of openAiEnvelope.hotels) {
        recognizedHotels.push({
          ...hotel,
          createdAt: new Date(),
          sourceFile: {
            filename: downloadedPdfFile.filename,
            localPath: downloadedPdfFile.localPath,
            pdfUrl: downloadedPdfFile.pdfUrl,
          },
          updatedAt: new Date(hotel.updatedAt),
        });
      }
    }

    return recognizedHotels;
  }

  private normalizeDiscoveredPdfFiles(
    apifyItems: IApifyPdfLinksItem[],
  ): IDiscoveredGovCyPdfFile[] {
    const collectedAt = new Date().toISOString();
    const discoveredFiles = new Map<string, IDiscoveredGovCyPdfFile>();

    for (const apifyItem of apifyItems) {
      const pdfLinks = Array.isArray(apifyItem.pdfLinks) ? apifyItem.pdfLinks : [];

      for (const pdfLink of pdfLinks) {
        const pdfUrl = this.normalizePdfUrl(pdfLink);

        if (pdfUrl === null) {
          continue;
        }

        const filename = decodeURIComponent(basename(pdfUrl).split('?')[0] ?? '');
        const filenameLower = filename.toLowerCase();
        const filenameUpper = filename.toUpperCase();

        if (this.shouldIgnorePdfFile(filenameLower) || !this.isGovHotelsList(filenameUpper)) {
          continue;
        }

        if (!discoveredFiles.has(pdfUrl)) {
          discoveredFiles.set(pdfUrl, {
            collectedAt,
            docType: GOV_CY_PDF_DOC_TYPE,
            filename,
            pdfUrl,
            publishedAt: this.parsePublishedAtFromFilename(filename),
            region: this.detectRegionFromFilename(filenameUpper),
          });
        }
      }
    }

    return Array.from(discoveredFiles.values());
  }

  private normalizePdfUrl(pdfLink: string): string | null {
    if (pdfLink.length === 0) {
      return null;
    }

    if (/^https?:\/\//i.test(pdfLink)) {
      return pdfLink;
    }

    if (pdfLink.startsWith('/')) {
      return `https://www.gov.cy${pdfLink}`;
    }

    return `https://www.gov.cy/${pdfLink}`;
  }

  private shouldIgnorePdfFile(filenameLower: string): boolean {
    return /(pet[^a-z0-9]*friendly|vegan[^a-z0-9]*friendly)/i.test(filenameLower);
  }

  private isGovHotelsList(filenameUpper: string): boolean {
    return filenameUpper.includes('_HOTELS_') || filenameUpper.startsWith('HOTELS_');
  }

  private parsePublishedAtFromFilename(filename: string): string | null {
    const match = filename.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);

    if (match === null) {
      return null;
    }

    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];

    return new Date(`${year}-${month}-${day}T00:00:00.000Z`).toISOString();
  }

  private detectRegionFromFilename(filenameUpper: string): string | null {
    const regionPrefixMatch = filenameUpper.match(/^([A-Z_]+?)_HOTELS_/);

    if (regionPrefixMatch !== null) {
      return regionPrefixMatch[1].replace(/_/g, ' ').trim();
    }

    const hotelsPrefixMatch = filenameUpper.match(/^HOTELS_([A-Z_]+?)_/);

    if (hotelsPrefixMatch !== null) {
      return hotelsPrefixMatch[1].replace(/_/g, ' ').trim();
    }

    return null;
  }

  private resolveDatedDirectoryName(pdfFile: IDiscoveredGovCyPdfFile): string {
    const datedValue = pdfFile.publishedAt ?? pdfFile.collectedAt;

    return datedValue.slice(0, 10);
  }

  private async uploadPdfFile(downloadedPdfFile: IDownloadedGovCyPdfFile): Promise<string> {
    const openAiApiKey = this.getRequiredConfigValue(this.config.openAiApiKey, 'OPENAI_API_KEY');
    const fileBuffer = await readFile(downloadedPdfFile.localPath);
    const formData = new FormData();

    formData.set('purpose', 'user_data');
    formData.set(
      'file',
      new File([fileBuffer], downloadedPdfFile.filename, {
        type: 'application/pdf',
      }),
    );

    const response = await fetch(OPENAI_FILES_URL, {
      body: formData,
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.config.downloadTimeoutMs),
    });

    await this.assertOkResponse(response, `OpenAI file upload: ${downloadedPdfFile.filename}`);

    const body = await response.json() as IOpenAiFileUploadResponse;

    return body.id;
  }

  private async requestParsedHotels(openAiFileId: string): Promise<IOpenAiHotelsEnvelope> {
    const openAiApiKey = this.getRequiredConfigValue(this.config.openAiApiKey, 'OPENAI_API_KEY');
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: [
          {
            content: OPENAI_PARSE_PDF_SYSTEM_PROMPT,
            role: 'system',
          },
          {
            content: [
              {
                file_id: openAiFileId,
                type: 'input_file',
              },
              {
                text: OPENAI_PARSE_PDF_USER_PROMPT,
                type: 'input_text',
              },
            ],
            role: 'user',
          },
        ],
        model: this.config.openAiModel,
        store: false,
        temperature: 0,
        text: {
          format: {
            name: 'gov_cy_hotels',
            schema: OPENAI_PARSE_PDF_JSON_SCHEMA,
            strict: true,
            type: 'json_schema',
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.config.openAiResponsesTimeoutMs),
    });

    await this.assertOkResponse(response, 'OpenAI PDF parsing');

    const body = await response.json() as IOpenAiResponse;
    const outputText = this.extractOutputText(body);

    return JSON.parse(outputText) as IOpenAiHotelsEnvelope;
  }

  private extractOutputText(openAiResponse: IOpenAiResponse): string {
    const outputItems = Array.isArray(openAiResponse.output) ? openAiResponse.output : [];

    for (const outputItem of outputItems) {
      const contentItems = Array.isArray(outputItem.content) ? outputItem.content : [];

      for (const contentItem of contentItems) {
        if (typeof contentItem.refusal === 'string' && contentItem.refusal.length > 0) {
          throw new Error(`OpenAI refused to parse the PDF: ${contentItem.refusal}`);
        }

        if (contentItem.type === 'output_text' && typeof contentItem.text === 'string') {
          return contentItem.text;
        }
      }
    }

    throw new Error('OpenAI response did not contain output_text');
  }

  private getRequiredConfigValue(value: string | null, envName: string): string {
    if (value === null || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${envName}`);
    }

    return value;
  }

  private async assertOkResponse(response: Response, context: string): Promise<void> {
    if (response.ok) {
      return;
    }

    const responseText = await response.text();

    throw new Error(`${context} failed with status ${response.status}: ${responseText}`);
  }
}
