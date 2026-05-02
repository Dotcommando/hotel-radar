import { constants } from 'node:fs';
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { Inject, Injectable } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { basename, dirname, extname, join } from 'node:path';
import { PROMPT_TYPE } from '../../prompts/constants/prompt-type.enum';
import { PromptsService } from '../../prompts/prompts.service';
import { GOV_CY_PDF_HOTELS_CONFIG } from '../constants/gov-cy-pdf-hotels-config.constant';
import {
  APIFY_DATASET_ITEMS_URL,
  GOV_CY_PDF_DOC_TYPE,
  OPENAI_REQUEST_MAX_ATTEMPTS,
  OPENAI_REQUEST_RETRY_DELAY_MS,
  OPENAI_FILES_URL,
  OPENAI_RESPONSES_POLL_INTERVAL_MS,
  OPENAI_RESPONSES_URL,
} from '../constants/gov-cy-pdf-hotels.constants';
import {
  MAX_PDF_PAGES_WITHOUT_CHUNKING,
  PDF_CHUNK_OVERLAP_PAGES,
  PDF_CHUNK_SIZE_PAGES,
} from '../constants/pdf-chunking.constants';
import { OPENAI_PARSE_PDF_JSON_SCHEMA } from '../constants/openai-parse-pdf.constants';
import { PDF_DISCOVERY_PAGE_FUNCTION } from '../constants/pdf-discovery-page-function.constant';
import { GovCyPdfDownloaderService } from './gov-cy-pdf-downloader.service';
import { IApifyPdfLinksItem } from '../types/apify-pdf-links-item.interface';
import { IDownloadedGovCyPdfFile } from '../types/downloaded-gov-cy-pdf-file.interface';
import { IDiscoveredGovCyPdfFile } from '../types/discovered-gov-cy-pdf-file.interface';
import { IOpenAiFileUploadResponse } from '../types/openai-file-upload-response.interface';
import { IOpenAiHotelsEnvelope } from '../types/openai-hotels-envelope.interface';
import { IOpenAiResponse } from '../types/openai-response.interface';
import { IGovCyHotelSourceFile } from '../types/gov-cy-hotel-source-file.interface';
import { IGovCyHotelContacts } from '../types/gov-cy-hotel-contacts.interface';
import { IGovCyPdfParseChunk } from '../types/gov-cy-pdf-parse-chunk.interface';
import { IGovCyPdfParseChunkProgress } from '../types/gov-cy-pdf-parse-chunk-progress.interface';
import { IRecognizedGovCyHotelRecord } from '../types/recognized-gov-cy-hotel-record.interface';
import type { IGovCyPdfHotelsConfig } from '../types/gov-cy-pdf-hotels-config.interface';
import {
  makeSoftHotelDuplicateCandidateKey,
  makeStrictHotelDedupeKey,
  normalizeHotelName,
} from '../../raw-hotels/utils/hotel-identity.util';
import { normalizeCyprusPhones } from '../utils/cyprus-phone-normalization.util';

interface INormalizedWebsiteCandidate {
  email: string | null;
  index: number;
  specificity: number;
  website: string | null;
}

interface IGovCyPdfParsePrompts {
  systemPrompt: string;
  userPrompt: string;
}

interface IParsePdfFileToBatchesParams {
  downloadedPdfFile: IDownloadedGovCyPdfFile;
  onChunkProcessed?: (
    progress: IGovCyPdfParseChunkProgress,
  ) => Promise<void>;
  onChunksPrepared?: (chunkTotal: number) => Promise<void>;
  onParsedBatch: (parsedHotels: IRecognizedGovCyHotelRecord[]) => Promise<void>;
  runTmpDirectoryPath: string;
}

@Injectable()
export class GovCyPdfHotelsService {
  constructor(
    @Inject(GOV_CY_PDF_HOTELS_CONFIG)
    private readonly config: IGovCyPdfHotelsConfig,
    private readonly govCyPdfDownloaderService: GovCyPdfDownloaderService,
    private readonly promptsService: PromptsService,
  ) {}

  async collectDownloadAndParsePdfFiles(): Promise<
    IRecognizedGovCyHotelRecord[]
  > {
    console.log('[GovCyPdfHotelsService] starting discovery phase');
    const discoveredPdfFiles = await this.discoverPdfFiles();
    console.log(
      `[GovCyPdfHotelsService] discovery completed, pdfFiles=${discoveredPdfFiles.length}`,
    );

    console.log('[GovCyPdfHotelsService] starting download phase');
    const downloadedPdfFiles = await this.downloadPdfFiles(discoveredPdfFiles);
    console.log(
      `[GovCyPdfHotelsService] download completed, downloadedPdfFiles=${downloadedPdfFiles.length}`,
    );

    console.log('[GovCyPdfHotelsService] starting parse phase');
    return this.parsePdfFiles(downloadedPdfFiles);
  }

  async discoverPdfFiles(): Promise<IDiscoveredGovCyPdfFile[]> {
    const apifyToken = this.getRequiredConfigValue(
      this.config.apifyToken,
      'APIFY_TOKEN',
    );
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

    const body = (await response.json()) as IApifyPdfLinksItem[];

    const normalizedPdfFiles = this.normalizeDiscoveredPdfFiles(body);
    const primaryPdfFiles = normalizedPdfFiles.filter(({ filename }) =>
      this.isPrimaryPdfFile(filename),
    );
    const fallbackPdfFiles = normalizedPdfFiles.filter(({ filename }) =>
      this.isFallbackPdfFile(filename),
    );
    const selectedPdfFiles =
      primaryPdfFiles.length > 0 ? primaryPdfFiles : fallbackPdfFiles;

    console.log(
      `[GovCyPdfHotelsService] normalized discovered pdf files=${normalizedPdfFiles.length} primaryPdfFiles=${primaryPdfFiles.length} fallbackPdfFiles=${fallbackPdfFiles.length} selectedPdfFiles=${selectedPdfFiles.length}`,
    );

    return selectedPdfFiles;
  }

  async ensureStorageDirectoryIsWritable(): Promise<string> {
    await mkdir(this.config.storageDirectoryPath, { recursive: true });
    await chmod(this.config.storageDirectoryPath, 0o775);
    await access(this.config.storageDirectoryPath, constants.W_OK);

    return this.config.storageDirectoryPath;
  }

  async prepareParsingTmpDirectory(runId: string): Promise<string> {
    const runTmpDirectoryPath = this.buildRunTmpDirectoryPath(runId);

    await mkdir(runTmpDirectoryPath, { recursive: true });
    await chmod(runTmpDirectoryPath, 0o775);
    await access(runTmpDirectoryPath, constants.W_OK);

    return runTmpDirectoryPath;
  }

  async cleanupParsingTmpDirectory(runId: string): Promise<void> {
    await rm(this.buildRunTmpDirectoryPath(runId), {
      force: true,
      recursive: true,
    });
  }

  async downloadPdfFiles(
    pdfFiles: IDiscoveredGovCyPdfFile[],
  ): Promise<IDownloadedGovCyPdfFile[]> {
    if (pdfFiles.length === 0) {
      return [];
    }

    const storageDirectoryPath = await this.ensureStorageDirectoryIsWritable();
    const downloadedPdfFiles: IDownloadedGovCyPdfFile[] = [];

    for (const pdfFile of pdfFiles) {
      console.log(
        `[GovCyPdfHotelsService] downloading pdf filename=${pdfFile.filename}`,
      );
      const datedDirectoryPath = join(
        storageDirectoryPath,
        this.resolveDatedDirectoryName(pdfFile),
      );

      await mkdir(datedDirectoryPath, { recursive: true });

      const localPath = join(datedDirectoryPath, pdfFile.filename);

      await this.govCyPdfDownloaderService.downloadPdfToPath({
        pdfUrl: pdfFile.pdfUrl,
        targetPath: localPath,
        timeoutMs: this.config.downloadTimeoutMs,
      });

      console.log(
        `[GovCyPdfHotelsService] downloaded pdf filename=${pdfFile.filename} localPath=${localPath}`,
      );

      downloadedPdfFiles.push({
        ...pdfFile,
        localPath,
      });
    }

    return downloadedPdfFiles;
  }

  async parsePdfFiles(
    downloadedPdfFiles: IDownloadedGovCyPdfFile[],
    onParsedBatch?: (
      parsedHotels: IRecognizedGovCyHotelRecord[],
    ) => Promise<void>,
  ): Promise<IRecognizedGovCyHotelRecord[]> {
    if (downloadedPdfFiles.length === 0) {
      return [];
    }

    const recognizedHotelsMap = new Map<string, IRecognizedGovCyHotelRecord>();
    const systemPrompt = await this.getRequiredPrompt(
      PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
    );
    const userPrompt = await this.getRequiredPrompt(
      PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
    );

    for (const downloadedPdfFile of downloadedPdfFiles) {
      const parseChunks = await this.buildPdfParseChunks(downloadedPdfFile);
      const softDuplicateCandidateKeysMap = new Map<string, string>();

      console.log(
        `[GovCyPdfHotelsService] prepared parse chunks filename=${downloadedPdfFile.filename} chunks=${parseChunks.length}`,
      );

      try {
        for (const parseChunk of parseChunks) {
          const deduplicatedParsedHotels = await this.parsePdfChunk(
            parseChunk,
            systemPrompt,
            userPrompt,
            softDuplicateCandidateKeysMap,
          );

          if (
            onParsedBatch !== undefined &&
            deduplicatedParsedHotels.length > 0
          ) {
            await onParsedBatch(deduplicatedParsedHotels);
          }

          for (const recognizedHotel of deduplicatedParsedHotels) {
            recognizedHotelsMap.set(
              this.buildRecognizedHotelKey(recognizedHotel),
              recognizedHotel,
            );
          }
        }
      } finally {
        await this.cleanupTemporaryPdfChunks(parseChunks);
      }
    }

    const recognizedHotels = Array.from(recognizedHotelsMap.values());

    console.log(
      `[GovCyPdfHotelsService] parse phase completed, totalRecognizedHotels=${recognizedHotels.length}`,
    );

    return recognizedHotels;
  }

  async parsePdfFileToBatches(
    params: IParsePdfFileToBatchesParams,
  ): Promise<number> {
    const prompts = await this.readPdfParsePrompts();
    const parseChunks = await this.buildPdfParseChunks(
      params.downloadedPdfFile,
      params.runTmpDirectoryPath,
    );
    const softDuplicateCandidateKeysMap = new Map<string, string>();
    const recognizedHotelKeys = new Set<string>();
    let recordsCount = 0;

    await params.onChunksPrepared?.(parseChunks.length);

    console.log(
      `[GovCyPdfHotelsService] prepared parse chunks filename=${params.downloadedPdfFile.filename} chunks=${parseChunks.length} tmpDir=${params.runTmpDirectoryPath}`,
    );

    for (const parseChunk of parseChunks) {
      const parsedHotels = await this.parsePdfChunk(
        parseChunk,
        prompts.systemPrompt,
        prompts.userPrompt,
        softDuplicateCandidateKeysMap,
      );
      const newParsedHotels: IRecognizedGovCyHotelRecord[] = [];

      for (const parsedHotel of parsedHotels) {
        const recognizedHotelKey = this.buildRecognizedHotelKey(parsedHotel);

        if (recognizedHotelKeys.has(recognizedHotelKey)) {
          continue;
        }

        recognizedHotelKeys.add(recognizedHotelKey);
        newParsedHotels.push(parsedHotel);
      }

      if (newParsedHotels.length > 0) {
        await params.onParsedBatch(newParsedHotels);
        recordsCount += newParsedHotels.length;
      }

      await params.onChunkProcessed?.({
        chunkIndex: parseChunk.chunkIndex,
        chunkTotal: parseChunk.chunkTotal,
        recordsCount: newParsedHotels.length,
      });
    }

    return recordsCount;
  }

  private normalizeRecognizedHotels(
    hotels: IOpenAiHotelsEnvelope['hotels'],
    sourceFile: IGovCyHotelSourceFile,
  ): IRecognizedGovCyHotelRecord[] {
    const recognizedHotels: IRecognizedGovCyHotelRecord[] = [];

    for (const hotel of hotels) {
      const nameNormalized = normalizeHotelName(hotel.name);

      recognizedHotels.push({
        ...hotel,
        address: this.normalizeOptionalText(hotel.address),
        createdAt: new Date(),
        contacts: this.normalizeContacts(hotel.contacts),
        nameNormalized,
        sourceFile,
        updatedAt: new Date(hotel.updatedAt),
      });
    }

    return recognizedHotels;
  }

  private deduplicateRecognizedHotels(
    recognizedHotels: IRecognizedGovCyHotelRecord[],
  ): IRecognizedGovCyHotelRecord[] {
    const deduplicatedRecognizedHotels = new Map<
      string,
      IRecognizedGovCyHotelRecord
    >();

    for (const recognizedHotel of recognizedHotels) {
      deduplicatedRecognizedHotels.set(
        this.buildRecognizedHotelKey(recognizedHotel),
        recognizedHotel,
      );
    }

    return Array.from(deduplicatedRecognizedHotels.values());
  }

  private async readPdfParsePrompts(): Promise<IGovCyPdfParsePrompts> {
    return {
      systemPrompt: await this.getRequiredPrompt(
        PROMPT_TYPE.GOV_CY_PDF_PARSE_SYSTEM,
      ),
      userPrompt: await this.getRequiredPrompt(
        PROMPT_TYPE.GOV_CY_PDF_PARSE_USER,
      ),
    };
  }

  private async parsePdfChunk(
    parseChunk: IGovCyPdfParseChunk,
    systemPrompt: string,
    userPrompt: string,
    softDuplicateCandidateKeysMap: Map<string, string>,
  ): Promise<IRecognizedGovCyHotelRecord[]> {
    console.log(
      `[GovCyPdfHotelsService] uploading pdf to OpenAI filename=${parseChunk.sourceFile.filename} chunk=${parseChunk.chunkIndex}/${parseChunk.chunkTotal} pages=${parseChunk.pageFrom}-${parseChunk.pageTo}`,
    );
    const openAiFileId = await this.uploadPdfFile(parseChunk);
    console.log(
      `[GovCyPdfHotelsService] uploaded pdf to OpenAI filename=${parseChunk.sourceFile.filename} chunk=${parseChunk.chunkIndex}/${parseChunk.chunkTotal} fileId=${openAiFileId}`,
    );

    console.log(
      `[GovCyPdfHotelsService] requesting OpenAI parse filename=${parseChunk.sourceFile.filename} chunk=${parseChunk.chunkIndex}/${parseChunk.chunkTotal} pages=${parseChunk.pageFrom}-${parseChunk.pageTo}`,
    );
    const openAiEnvelope = await this.requestParsedHotels(
      openAiFileId,
      systemPrompt,
      userPrompt,
    );
    console.log(
      `[GovCyPdfHotelsService] OpenAI parse completed filename=${parseChunk.sourceFile.filename} chunk=${parseChunk.chunkIndex}/${parseChunk.chunkTotal} hotels=${openAiEnvelope.hotels.length}`,
    );

    const parsedHotels = this.normalizeRecognizedHotels(
      openAiEnvelope.hotels,
      parseChunk.sourceFile,
    );
    const deduplicatedParsedHotels =
      this.deduplicateRecognizedHotels(parsedHotels);

    for (const recognizedHotel of deduplicatedParsedHotels) {
      this.logSuspiciousOverlapDuplicate(
        softDuplicateCandidateKeysMap,
        recognizedHotel,
      );
    }

    return deduplicatedParsedHotels;
  }

  private normalizeContacts(
    contacts: IGovCyHotelContacts,
  ): IGovCyHotelContacts {
    const emails = new Set<string>();
    const websites: INormalizedWebsiteCandidate[] = [];

    for (const email of contacts.emails) {
      const normalizedEmail = this.normalizeEmail(email);

      if (normalizedEmail !== null) {
        emails.add(normalizedEmail);
      }
    }

    for (const [index, website] of contacts.websites.entries()) {
      const normalizedWebsiteCandidate = this.normalizeWebsiteCandidate(
        website,
        index,
      );

      if (normalizedWebsiteCandidate === null) {
        continue;
      }

      if (normalizedWebsiteCandidate.email !== null) {
        emails.add(normalizedWebsiteCandidate.email);
      }

      if (normalizedWebsiteCandidate.website !== null) {
        websites.push(normalizedWebsiteCandidate);
      }
    }

    const normalizedWebsites = this.normalizeWebsiteCandidates(websites);

    return {
      domain: this.deriveDomainFromWebsite(normalizedWebsites[0] ?? null),
      emails: Array.from(emails),
      faxes: this.normalizePhoneLikeValues(contacts.faxes),
      phones: normalizeCyprusPhones(contacts.phones),
      websites: normalizedWebsites,
    };
  }

  private normalizeWebsiteCandidates(
    websites: INormalizedWebsiteCandidate[],
  ): string[] {
    const normalizedWebsiteCandidates = websites.sort((left, right) => {
      if (left.specificity !== right.specificity) {
        return right.specificity - left.specificity;
      }

      return left.index - right.index;
    });
    const seenWebsites = new Set<string>();
    const normalizedWebsites: string[] = [];

    for (const normalizedWebsiteCandidate of normalizedWebsiteCandidates) {
      if (
        normalizedWebsiteCandidate.website === null ||
        seenWebsites.has(normalizedWebsiteCandidate.website)
      ) {
        continue;
      }

      seenWebsites.add(normalizedWebsiteCandidate.website);
      normalizedWebsites.push(normalizedWebsiteCandidate.website);
    }

    return normalizedWebsites;
  }

  private normalizeWebsiteCandidate(
    website: string,
    index: number,
  ): INormalizedWebsiteCandidate | null {
    const compactWebsite = website.replace(/\s+/g, '').trim();

    if (compactWebsite.length === 0) {
      return null;
    }

    const normalizedEmail = this.normalizeEmail(
      compactWebsite.replace(/^(https?:\/\/)?www\./i, ''),
    );

    if (normalizedEmail !== null) {
      return {
        email: normalizedEmail,
        index,
        specificity: 0,
        website: null,
      };
    }

    let normalizedWebsite = compactWebsite;

    if (normalizedWebsite.startsWith('//')) {
      normalizedWebsite = `https:${normalizedWebsite}`;
    }

    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedWebsite)) {
      if (!this.looksLikeWebsiteWithoutScheme(normalizedWebsite)) {
        return null;
      }

      normalizedWebsite = `https://${normalizedWebsite}`;
    }

    try {
      const url = new URL(normalizedWebsite);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return null;
      }

      return {
        email: null,
        index,
        specificity: this.getWebsiteSpecificity(url),
        website: url.toString(),
      };
    } catch {
      return null;
    }
  }

  private looksLikeWebsiteWithoutScheme(value: string): boolean {
    return (
      value.includes('.') &&
      !value.startsWith('.') &&
      !value.endsWith('.') &&
      !value.includes('@')
    );
  }

  private getWebsiteSpecificity(url: URL): number {
    if (url.pathname !== '/' || url.search.length > 0 || url.hash.length > 0) {
      return 1;
    }

    return 0;
  }

  private deriveDomainFromWebsite(website: string | null): string | null {
    if (website === null) {
      return null;
    }

    try {
      const url = new URL(website);

      return url.hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return null;
    }
  }

  private normalizeEmail(value: string): string | null {
    const normalizedEmail = value.replace(/\s+/g, '').trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return null;
    }

    return normalizedEmail;
  }

  private normalizePhoneLikeValues(values: string[]): string[] {
    const normalizedValues: string[] = [];
    const seenValues = new Set<string>();

    for (const value of values) {
      const normalizedValue = value.replace(/\s+/g, ' ').trim();

      if (normalizedValue.length === 0 || seenValues.has(normalizedValue)) {
        continue;
      }

      seenValues.add(normalizedValue);
      normalizedValues.push(normalizedValue);
    }

    return normalizedValues;
  }

  private normalizeOptionalText(value: string | null): string | null {
    if (value === null) {
      return null;
    }

    const normalizedValue = value.replace(/\s+/g, ' ').trim();

    if (normalizedValue.length === 0) {
      return null;
    }

    return normalizedValue;
  }

  private normalizeDiscoveredPdfFiles(
    apifyItems: IApifyPdfLinksItem[],
  ): IDiscoveredGovCyPdfFile[] {
    const collectedAt = new Date().toISOString();
    const discoveredFiles = new Map<string, IDiscoveredGovCyPdfFile>();

    for (const apifyItem of apifyItems) {
      const pdfLinks = Array.isArray(apifyItem.pdfLinks)
        ? apifyItem.pdfLinks
        : [];

      for (const pdfLink of pdfLinks) {
        const pdfUrl = this.normalizePdfUrl(pdfLink);

        if (pdfUrl === null) {
          continue;
        }

        const filename = decodeURIComponent(
          basename(pdfUrl).split('?')[0] ?? '',
        ).trim();
        const filenameUpper = filename.toUpperCase();

        if (!this.isSupportedPdfFile(filename)) {
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
    const normalizedPdfLink = pdfLink.trim();

    if (normalizedPdfLink.length === 0) {
      return null;
    }

    if (/^https?:\/\//i.test(normalizedPdfLink)) {
      return normalizedPdfLink;
    }

    if (normalizedPdfLink.startsWith('/')) {
      return `https://www.gov.cy${normalizedPdfLink}`;
    }

    return `https://www.gov.cy/${normalizedPdfLink}`;
  }

  private shouldIgnorePdfFile(filenameLower: string): boolean {
    return /(pet[^a-z0-9]*friendly|vegan[^a-z0-9]*friendly)/i.test(
      filenameLower,
    );
  }

  private isSupportedPdfFile(filename: string): boolean {
    return this.isPrimaryPdfFile(filename) || this.isFallbackPdfFile(filename);
  }

  private isPrimaryPdfFile(filename: string): boolean {
    const normalizedFilename = this.normalizeFilenameForMatching(filename);

    return (
      !this.shouldIgnorePdfFile(normalizedFilename) &&
      normalizedFilename.includes('pancyprian')
    );
  }

  private isFallbackPdfFile(filename: string): boolean {
    const normalizedFilename = this.normalizeFilenameForMatching(filename);

    return (
      !this.shouldIgnorePdfFile(normalizedFilename) &&
      !normalizedFilename.includes('pancyprian') &&
      this.isGovHotelsList(normalizedFilename)
    );
  }

  private isGovHotelsList(normalizedFilename: string): boolean {
    return (
      normalizedFilename.includes('_hotels_') ||
      normalizedFilename.startsWith('hotels_')
    );
  }

  private normalizeFilenameForMatching(filename: string): string {
    return filename.trim().toLowerCase();
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

  private buildRunTmpDirectoryPath(runId: string): string {
    return join(this.config.tmpDirectoryPath, runId);
  }

  private async buildPdfParseChunks(
    downloadedPdfFile: IDownloadedGovCyPdfFile,
    uploadDirectoryPath = dirname(downloadedPdfFile.localPath),
  ): Promise<IGovCyPdfParseChunk[]> {
    const pdfFileBytes = await readFile(downloadedPdfFile.localPath);
    const sourceFile: IGovCyHotelSourceFile = {
      filename: downloadedPdfFile.filename,
      localPath: downloadedPdfFile.localPath,
      pdfUrl: downloadedPdfFile.pdfUrl,
    };
    let sourcePdfDocument: PDFDocument;

    try {
      sourcePdfDocument = await PDFDocument.load(pdfFileBytes);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.warn(
        `[GovCyPdfHotelsService] failed to read PDF page count filename=${downloadedPdfFile.filename} error=${message}; falling back to unchunked parsing`,
      );

      return [
        {
          chunkIndex: 1,
          chunkTotal: 1,
          pageFrom: 1,
          pageTo: 1,
          sourceFile,
          uploadFilename: downloadedPdfFile.filename,
          uploadLocalPath: await this.prepareUnchunkedUploadPdfFile(
            downloadedPdfFile,
            uploadDirectoryPath,
          ),
        },
      ];
    }

    const pageCount = sourcePdfDocument.getPageCount();

    if (pageCount <= MAX_PDF_PAGES_WITHOUT_CHUNKING) {
      return [
        {
          chunkIndex: 1,
          chunkTotal: 1,
          pageFrom: 1,
          pageTo: pageCount,
          sourceFile,
          uploadFilename: downloadedPdfFile.filename,
          uploadLocalPath: await this.prepareUnchunkedUploadPdfFile(
            downloadedPdfFile,
            uploadDirectoryPath,
          ),
        },
      ];
    }

    const pageRanges = this.buildPdfChunkPageRanges(pageCount);
    const parseChunks: IGovCyPdfParseChunk[] = [];

    for (const [index, pageRange] of pageRanges.entries()) {
      const uploadFilename = this.buildPdfChunkFilename(
        downloadedPdfFile.filename,
        pageRange.pageFrom,
        pageRange.pageTo,
      );
      const uploadLocalPath = join(uploadDirectoryPath, uploadFilename);
      const chunkPdfDocument = await PDFDocument.create();
      const sourcePages = await chunkPdfDocument.copyPages(
        sourcePdfDocument,
        this.buildChunkPageIndexes(pageRange.pageFrom, pageRange.pageTo),
      );

      for (const sourcePage of sourcePages) {
        chunkPdfDocument.addPage(sourcePage);
      }

      await writeFile(
        uploadLocalPath,
        Buffer.from(await chunkPdfDocument.save()),
      );

      parseChunks.push({
        chunkIndex: index + 1,
        chunkTotal: pageRanges.length,
        pageFrom: pageRange.pageFrom,
        pageTo: pageRange.pageTo,
        sourceFile,
        uploadFilename,
        uploadLocalPath,
      });
    }

    return parseChunks;
  }

  private async prepareUnchunkedUploadPdfFile(
    downloadedPdfFile: IDownloadedGovCyPdfFile,
    uploadDirectoryPath: string,
  ): Promise<string> {
    const uploadLocalPath = join(
      uploadDirectoryPath,
      downloadedPdfFile.filename,
    );

    if (uploadLocalPath !== downloadedPdfFile.localPath) {
      await copyFile(downloadedPdfFile.localPath, uploadLocalPath);
    }

    return uploadLocalPath;
  }

  private buildPdfChunkPageRanges(
    pageCount: number,
  ): Array<{ pageFrom: number; pageTo: number }> {
    const pageRanges: Array<{ pageFrom: number; pageTo: number }> = [];
    const pageStep = PDF_CHUNK_SIZE_PAGES - PDF_CHUNK_OVERLAP_PAGES;
    let pageFrom = 1;

    while (pageFrom <= pageCount) {
      const pageTo = Math.min(pageFrom + PDF_CHUNK_SIZE_PAGES - 1, pageCount);

      pageRanges.push({
        pageFrom,
        pageTo,
      });

      if (pageTo === pageCount) {
        break;
      }

      pageFrom += pageStep;
    }

    return pageRanges;
  }

  private buildChunkPageIndexes(pageFrom: number, pageTo: number): number[] {
    const pageIndexes: number[] = [];

    for (let pageNumber = pageFrom; pageNumber <= pageTo; pageNumber += 1) {
      pageIndexes.push(pageNumber - 1);
    }

    return pageIndexes;
  }

  private buildPdfChunkFilename(
    filename: string,
    pageFrom: number,
    pageTo: number,
  ): string {
    const filenameExtension = extname(filename);
    const filenameWithoutExtension = filename.slice(
      0,
      filename.length - filenameExtension.length,
    );

    return `${filenameWithoutExtension}.pages-${pageFrom}-${pageTo}${filenameExtension}`;
  }

  private async cleanupTemporaryPdfChunks(
    parseChunks: IGovCyPdfParseChunk[],
  ): Promise<void> {
    for (const parseChunk of parseChunks) {
      if (parseChunk.uploadLocalPath === parseChunk.sourceFile.localPath) {
        continue;
      }

      await unlink(parseChunk.uploadLocalPath).catch(() => undefined);
    }
  }

  private buildRecognizedHotelKey(
    recognizedHotel: IRecognizedGovCyHotelRecord,
  ): string {
    return `${recognizedHotel.sourceFile.filename}::${makeStrictHotelDedupeKey(recognizedHotel)}`;
  }

  private logSuspiciousOverlapDuplicate(
    softDuplicateCandidateKeysMap: Map<string, string>,
    recognizedHotel: IRecognizedGovCyHotelRecord,
  ): void {
    const softDuplicateCandidateKey =
      makeSoftHotelDuplicateCandidateKey(recognizedHotel);
    const strictHotelDedupeKey = this.buildRecognizedHotelKey(recognizedHotel);
    const existingStrictHotelDedupeKey = softDuplicateCandidateKeysMap.get(
      softDuplicateCandidateKey,
    );

    if (
      existingStrictHotelDedupeKey !== undefined &&
      existingStrictHotelDedupeKey !== strictHotelDedupeKey
    ) {
      console.warn(
        `[GovCyPdfHotelsService] suspicious overlap duplicate detected filename=${recognizedHotel.sourceFile.filename} softKey=${softDuplicateCandidateKey} currentKey=${strictHotelDedupeKey} existingKey=${existingStrictHotelDedupeKey}`,
      );
    }

    softDuplicateCandidateKeysMap.set(
      softDuplicateCandidateKey,
      strictHotelDedupeKey,
    );
  }

  private async uploadPdfFile(
    parseChunk: IGovCyPdfParseChunk,
  ): Promise<string> {
    const openAiApiKey = this.getRequiredConfigValue(
      this.config.openAiApiKey,
      'OPENAI_API_KEY',
    );
    const fileBuffer = await readFile(parseChunk.uploadLocalPath);
    const formData = new FormData();

    formData.set('purpose', 'user_data');
    formData.set(
      'file',
      new File([fileBuffer], parseChunk.uploadFilename, {
        type: 'application/pdf',
      }),
    );

    const response = await this.withOpenAiRetry(
      `OpenAI file upload: ${parseChunk.uploadFilename}`,
      async () =>
        await fetch(OPENAI_FILES_URL, {
          body: formData,
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
          },
          method: 'POST',
          signal: AbortSignal.timeout(this.config.downloadTimeoutMs),
        }),
    );

    await this.assertOkResponse(
      response,
      `OpenAI file upload: ${parseChunk.uploadFilename}`,
    );

    const body = (await response.json()) as IOpenAiFileUploadResponse;

    return body.id;
  }

  private async requestParsedHotels(
    openAiFileId: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<IOpenAiHotelsEnvelope> {
    const openAiApiKey = this.getRequiredConfigValue(
      this.config.openAiApiKey,
      'OPENAI_API_KEY',
    );
    const response = await this.withOpenAiRetry(
      'OpenAI PDF parsing',
      async () =>
        await fetch(OPENAI_RESPONSES_URL, {
          body: JSON.stringify({
            background: true,
            input: [
              {
                content: systemPrompt,
                role: 'system',
              },
              {
                content: [
                  {
                    file_id: openAiFileId,
                    type: 'input_file',
                  },
                  {
                    text: userPrompt,
                    type: 'input_text',
                  },
                ],
                role: 'user',
              },
            ],
            model: this.config.openAiModel,
            store: true,
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
        }),
    );

    await this.assertOkResponse(response, 'OpenAI PDF parsing');

    const body = (await response.json()) as IOpenAiResponse;
    const completedResponse = await this.waitForCompletedOpenAiResponse(body);
    const outputText = this.extractOutputText(completedResponse);

    return JSON.parse(outputText) as IOpenAiHotelsEnvelope;
  }

  private async waitForCompletedOpenAiResponse(
    openAiResponse: IOpenAiResponse,
  ): Promise<IOpenAiResponse> {
    if (!this.isOpenAiResponseInProgress(openAiResponse.status)) {
      this.assertCompletedOpenAiResponse(openAiResponse);

      return openAiResponse;
    }

    if (
      typeof openAiResponse.id !== 'string' ||
      openAiResponse.id.length === 0
    ) {
      throw new Error('OpenAI background response did not contain id');
    }

    let currentResponse = openAiResponse;

    while (this.isOpenAiResponseInProgress(currentResponse.status)) {
      console.log(
        `[GovCyPdfHotelsService] polling OpenAI response id=${openAiResponse.id} status=${currentResponse.status}`,
      );

      await this.delay(OPENAI_RESPONSES_POLL_INTERVAL_MS);

      currentResponse = await this.retrieveOpenAiResponse(
        openAiResponse.id,
        this.config.openAiResponsesTimeoutMs,
      );
    }

    this.assertCompletedOpenAiResponse(currentResponse);

    return currentResponse;
  }

  private async retrieveOpenAiResponse(
    responseId: string,
    timeoutMs: number,
  ): Promise<IOpenAiResponse> {
    const openAiApiKey = this.getRequiredConfigValue(
      this.config.openAiApiKey,
      'OPENAI_API_KEY',
    );
    const response = await this.withOpenAiRetry(
      `OpenAI background response retrieve: ${responseId}`,
      async () =>
        await fetch(`${OPENAI_RESPONSES_URL}/${responseId}`, {
          headers: {
            Authorization: `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          method: 'GET',
          signal: AbortSignal.timeout(timeoutMs),
        }),
    );

    await this.assertOkResponse(
      response,
      `OpenAI background response retrieve: ${responseId}`,
    );

    return (await response.json()) as IOpenAiResponse;
  }

  private isOpenAiResponseInProgress(status: string | undefined): boolean {
    return status === 'queued' || status === 'in_progress';
  }

  private assertCompletedOpenAiResponse(openAiResponse: IOpenAiResponse): void {
    if (
      openAiResponse.status === undefined ||
      openAiResponse.status === 'completed'
    ) {
      return;
    }

    const errorMessage =
      openAiResponse.error?.message ??
      openAiResponse.incomplete_details?.reason;

    if (errorMessage !== undefined) {
      throw new Error(
        `OpenAI PDF parsing finished with status ${openAiResponse.status}: ${errorMessage}`,
      );
    }

    throw new Error(
      `OpenAI PDF parsing finished with status ${openAiResponse.status}`,
    );
  }

  private async delay(timeoutMs: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, timeoutMs);
    });
  }

  private async withOpenAiRetry<T>(
    context: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= OPENAI_REQUEST_MAX_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await operation();
      } catch (error) {
        if (
          !this.isTransientOpenAiRequestError(error) ||
          attempt === OPENAI_REQUEST_MAX_ATTEMPTS
        ) {
          throw error;
        }

        const nextAttempt = attempt + 1;

        console.log(
          `[GovCyPdfHotelsService] retrying ${context} after transient error, nextAttempt=${nextAttempt}/${OPENAI_REQUEST_MAX_ATTEMPTS}`,
        );

        await this.delay(OPENAI_REQUEST_RETRY_DELAY_MS);
      }
    }

    throw new Error(`${context} retry loop exited unexpectedly`);
  }

  private isTransientOpenAiRequestError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const normalizedMessage = error.message.toLowerCase();

    if (normalizedMessage.includes('fetch failed')) {
      return true;
    }

    const cause = Reflect.get(error, 'cause');

    if (typeof cause !== 'object' || cause === null) {
      return false;
    }

    const code = Reflect.get(cause, 'code');

    if (typeof code !== 'string') {
      return false;
    }

    return (
      code === 'UND_ERR_HEADERS_TIMEOUT' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT'
    );
  }

  private async getRequiredPrompt(type: PROMPT_TYPE): Promise<string> {
    const prompt = await this.promptsService.readLatestByType(type);

    if (prompt == null) {
      throw new Error(`Prompt not found for type: ${type}`);
    }

    return prompt.content;
  }

  private extractOutputText(openAiResponse: IOpenAiResponse): string {
    const outputItems = Array.isArray(openAiResponse.output)
      ? openAiResponse.output
      : [];

    for (const outputItem of outputItems) {
      const contentItems = Array.isArray(outputItem.content)
        ? outputItem.content
        : [];

      for (const contentItem of contentItems) {
        if (
          typeof contentItem.refusal === 'string' &&
          contentItem.refusal.length > 0
        ) {
          throw new Error(
            `OpenAI refused to parse the PDF: ${contentItem.refusal}`,
          );
        }

        if (
          contentItem.type === 'output_text' &&
          typeof contentItem.text === 'string'
        ) {
          return contentItem.text;
        }
      }
    }

    throw new Error('OpenAI response did not contain output_text');
  }

  private getRequiredConfigValue(
    value: string | null,
    envName: string,
  ): string {
    if (value === null || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${envName}`);
    }

    return value;
  }

  private async assertOkResponse(
    response: Response,
    context: string,
  ): Promise<void> {
    if (response.ok) {
      return;
    }

    const responseText = await response.text();

    throw new Error(
      `${context} failed with status ${response.status}: ${responseText}`,
    );
  }
}
