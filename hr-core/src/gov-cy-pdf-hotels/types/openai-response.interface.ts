import { IOpenAiResponseItem } from './openai-response-item.interface';

export interface IOpenAiResponse {
  error?: {
    message?: string;
  };
  id?: string;
  incomplete_details?: {
    reason?: string;
  };
  output?: IOpenAiResponseItem[];
  status?: string;
}
