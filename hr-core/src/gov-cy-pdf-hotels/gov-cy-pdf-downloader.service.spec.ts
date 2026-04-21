import * as fsPromises from 'node:fs/promises';
import { Test, TestingModule } from '@nestjs/testing';
import { PDF_DOWNLOAD_METHOD } from './constants/pdf-download-method.constant';
import { GovCyPdfDownloaderService } from './gov-cy-pdf-downloader.service';

const browserCloseMock = jest.fn<Promise<void>, []>();
const browserLaunchMock = jest.fn();
const browserNewContextMock = jest.fn();
const contextNewPageMock = jest.fn();
const contextRequestGetMock = jest.fn();
const pageGotoMock = jest.fn();
const pageWaitForEventMock = jest.fn();
const downloadSaveAsMock = jest.fn<Promise<void>, [string]>();
const responseBodyMock = jest.fn();
const responseTextMock = jest.fn();

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('playwright', () => ({
  chromium: {
    launch: (...args: unknown[]) => browserLaunchMock(...args),
  },
}), { virtual: true });

describe('GovCyPdfDownloaderService', () => {
  let service: GovCyPdfDownloaderService;

  const readFileMock = jest.mocked(fsPromises.readFile);
  const writeFileMock = jest.mocked(fsPromises.writeFile);

  beforeEach(async () => {
    jest.clearAllMocks();

    browserLaunchMock.mockResolvedValue({
      close: browserCloseMock,
      newContext: browserNewContextMock,
    });

    browserNewContextMock.mockResolvedValue({
      newPage: contextNewPageMock,
      request: {
        get: contextRequestGetMock,
      },
    });

    contextNewPageMock.mockResolvedValue({
      goto: pageGotoMock,
      waitForEvent: pageWaitForEventMock,
    });

    pageGotoMock.mockResolvedValue(undefined);
    pageWaitForEventMock.mockResolvedValue({
      saveAs: downloadSaveAsMock,
    });
    readFileMock.mockResolvedValue(Buffer.from('downloaded-pdf'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [GovCyPdfDownloaderService],
    }).compile();

    service = module.get<GovCyPdfDownloaderService>(GovCyPdfDownloaderService);
  });

  it('downloads pdf via browser download event when available', async () => {
    const result = await service.downloadPdfToPath({
      pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
      targetPath: '/tmp/HOTELS_POLIS_8.4.2026.pdf',
      timeoutMs: 90000,
    });

    expect(browserLaunchMock).toHaveBeenCalledWith({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });
    expect(downloadSaveAsMock).toHaveBeenCalledWith('/tmp/HOTELS_POLIS_8.4.2026.pdf');
    expect(readFileMock).toHaveBeenCalledWith('/tmp/HOTELS_POLIS_8.4.2026.pdf');
    expect(result).toEqual({
      bytes: Buffer.from('downloaded-pdf'),
      method: PDF_DOWNLOAD_METHOD.DOWNLOAD,
    });
    expect(browserCloseMock).toHaveBeenCalledTimes(1);
  });

  it('treats "Download is starting" from page.goto as a valid download flow', async () => {
    pageGotoMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('page.goto: Download is starting'));

    const result = await service.downloadPdfToPath({
      pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
      targetPath: '/tmp/HOTELS_POLIS_8.4.2026.pdf',
      timeoutMs: 90000,
    });

    expect(downloadSaveAsMock).toHaveBeenCalledWith('/tmp/HOTELS_POLIS_8.4.2026.pdf');
    expect(result).toEqual({
      bytes: Buffer.from('downloaded-pdf'),
      method: PDF_DOWNLOAD_METHOD.DOWNLOAD,
    });
  });

  it('falls back to context request when browser download is unavailable', async () => {
    pageWaitForEventMock.mockRejectedValueOnce(new Error('download timeout'));
    responseBodyMock.mockResolvedValue(Buffer.from('request-pdf'));
    contextRequestGetMock.mockResolvedValue({
      body: responseBodyMock,
      ok: () => true,
      text: responseTextMock,
    });

    const result = await service.downloadPdfToPath({
      pdfUrl: 'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
      targetPath: '/tmp/HOTELS_POLIS_8.4.2026.pdf',
      timeoutMs: 90000,
    });

    expect(contextRequestGetMock).toHaveBeenCalledWith(
      'https://www.gov.cy/app/uploads/sites/26/2026/04/HOTELS_POLIS_8.4.2026.pdf',
      {
        headers: {
          Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
        },
        timeout: 90000,
      },
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      '/tmp/HOTELS_POLIS_8.4.2026.pdf',
      Buffer.from('request-pdf'),
    );
    expect(result).toEqual({
      bytes: Buffer.from('request-pdf'),
      method: PDF_DOWNLOAD_METHOD.CONTEXT_REQUEST,
    });
    expect(browserCloseMock).toHaveBeenCalledTimes(1);
  });
});
