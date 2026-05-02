import { readFile, writeFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { APIRequestContext, chromium, Download } from 'playwright';
import { PDF_DOWNLOAD_METHOD } from '../constants/pdf-download-method.constant';
import { IDownloadGovCyPdfToPathParams } from '../types/download-gov-cy-pdf-to-path-params.interface';
import { IDownloadGovCyPdfToPathResult } from '../types/download-gov-cy-pdf-to-path-result.interface';

@Injectable()
export class GovCyPdfDownloaderService {
  async downloadPdfToPath(
    params: IDownloadGovCyPdfToPathParams,
  ): Promise<IDownloadGovCyPdfToPathResult> {
    console.log(
      `[GovCyPdfDownloaderService] starting browser download pdfUrl=${params.pdfUrl}`,
    );
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });

    try {
      const context = await browser.newContext({
        acceptDownloads: true,
        userAgent:
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
      });
      const page = await context.newPage();
      const downloadPromise = page.waitForEvent('download', {
        timeout: params.timeoutMs,
      });

      await page.goto(this.buildOriginFromUrl(params.pdfUrl), {
        timeout: params.timeoutMs,
        waitUntil: 'domcontentloaded',
      });

      try {
        await page.goto(params.pdfUrl, {
          timeout: params.timeoutMs,
          waitUntil: 'commit',
        });
      } catch (error) {
        if (!this.isAbortNavigationError(error)) {
          throw error;
        }
      }

      try {
        const result = await this.saveViaDownloadEvent(
          downloadPromise,
          params.targetPath,
        );

        console.log(
          `[GovCyPdfDownloaderService] download completed via=${result.method} targetPath=${params.targetPath} bytes=${result.bytes.length}`,
        );

        return result;
      } catch {
        console.log(
          '[GovCyPdfDownloaderService] download event unavailable, falling back to context request',
        );

        const result = await this.saveViaContextRequest(
          context.request,
          params,
        );

        console.log(
          `[GovCyPdfDownloaderService] download completed via=${result.method} targetPath=${params.targetPath} bytes=${result.bytes.length}`,
        );

        return result;
      }
    } finally {
      await browser.close();
    }
  }

  private async saveViaDownloadEvent(
    downloadPromise: Promise<Download>,
    targetPath: string,
  ): Promise<IDownloadGovCyPdfToPathResult> {
    const download = await downloadPromise;

    await download.saveAs(targetPath);

    return {
      bytes: await readFile(targetPath),
      method: PDF_DOWNLOAD_METHOD.DOWNLOAD,
    };
  }

  private async saveViaContextRequest(
    requestContext: APIRequestContext,
    params: IDownloadGovCyPdfToPathParams,
  ): Promise<IDownloadGovCyPdfToPathResult> {
    const response = await requestContext.get(params.pdfUrl, {
      headers: {
        Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
      },
      timeout: params.timeoutMs,
    });

    if (!response.ok()) {
      throw new Error(
        `Failed to fetch PDF. status=${response.status()} body=${(await response.text()).slice(0, 400)}`,
      );
    }

    const bytes = Buffer.from(await response.body());

    await writeFile(params.targetPath, bytes);

    return {
      bytes,
      method: PDF_DOWNLOAD_METHOD.CONTEXT_REQUEST,
    };
  }

  private isAbortNavigationError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    return (
      message.includes('net::ERR_ABORTED') ||
      message.includes('Navigation aborted') ||
      message.includes('Download is starting')
    );
  }

  private buildOriginFromUrl(urlString: string): string {
    const url = new URL(urlString);

    return `${url.protocol}//${url.host}/`;
  }
}
