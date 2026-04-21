import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { GOV_CY_PDF_HOTELS_CONFIG } from './constants/gov-cy-pdf-hotels-config.constant';
import {
  APIFY_USERS_ME_URL,
  OPENAI_INPUT_TOKENS_URL,
  OPENAI_MODELS_URL,
} from './constants/gov-cy-pdf-hotels.constants';
import type { IGovCyPdfHotelsConfig } from './types/gov-cy-pdf-hotels-config.interface';
import type { IOpenAiErrorResponse } from './types/openai-error-response.interface';

@Injectable()
export class GovCyPdfHotelsStartupService implements OnModuleInit {
  constructor(
    @Inject(GOV_CY_PDF_HOTELS_CONFIG)
    private readonly config: IGovCyPdfHotelsConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.checkApifyAvailability();
      await this.checkOpenAiAvailability();
      await this.checkOpenAiQuota();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      console.error('GovCyPdfHotelsModule startup check failed:', message);
      process.exit(1);
    }
  }

  private async checkApifyAvailability(): Promise<void> {
    const apifyToken = this.getRequiredConfigValue(this.config.apifyToken, 'APIFY_TOKEN');
    const response = await fetch(APIFY_USERS_ME_URL, {
      headers: {
        Authorization: `Bearer ${apifyToken}`,
      },
      method: 'GET',
      signal: AbortSignal.timeout(this.config.downloadTimeoutMs),
    });

    await this.assertOkResponse(response, 'Apify health check');
  }

  private async checkOpenAiAvailability(): Promise<void> {
    const openAiApiKey = this.getRequiredConfigValue(this.config.openAiApiKey, 'OPENAI_API_KEY');
    const response = await fetch(
      `${OPENAI_MODELS_URL}/${encodeURIComponent(this.config.openAiModel)}`,
      {
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
        },
        method: 'GET',
        signal: AbortSignal.timeout(this.config.openAiResponsesTimeoutMs),
      },
    );

    await this.assertOkResponse(response, 'OpenAI model availability check');
  }

  private async checkOpenAiQuota(): Promise<void> {
    const openAiApiKey = this.getRequiredConfigValue(this.config.openAiApiKey, 'OPENAI_API_KEY');
    const response = await fetch(OPENAI_INPUT_TOKENS_URL, {
      body: JSON.stringify({
        input: 'health check',
        model: this.config.openAiModel,
      }),
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.config.openAiResponsesTimeoutMs),
    });

    if (response.ok) {
      return;
    }

    const responseBody = await response.json() as IOpenAiErrorResponse;
    const errorCode = responseBody.error?.code ?? null;
    const errorMessage = responseBody.error?.message ?? null;

    if (
      errorCode === 'insufficient_quota'
        || (errorMessage !== null && errorMessage.toLowerCase().includes('quota'))
        || (errorMessage !== null && errorMessage.toLowerCase().includes('billing'))
    ) {
      throw new Error('OpenAI health check failed: insufficient quota or billing limit reached');
    }

    throw new Error(
      `OpenAI quota check failed with status ${response.status}: ${errorMessage ?? 'Unknown error'}`,
    );
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
