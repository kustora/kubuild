import type { PageDocument, Node } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiGenerateResponse,
} from '../types';

export interface AiClientOptions {
  endpoint: string;
  headers?:
    | Record<string, string>
    | (() => Promise<Record<string, string>> | Record<string, string>);
  fetch?: typeof fetch;
}

export class KubuildAiClient {
  private endpoint: string;
  private headers?: AiClientOptions['headers'];
  private fetchFn: typeof fetch;

  constructor(options: AiClientOptions) {
    if (!options.endpoint) {
      throw new Error('KubuildAiClient requires an endpoint URL');
    }
    this.endpoint = options.endpoint;
    this.headers = options.headers;
    this.fetchFn = options.fetch || globalThis.fetch;
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    if (!this.headers) return {};
    if (typeof this.headers === 'function') {
      return await this.headers();
    }
    return this.headers;
  }

  private async sendRequest<T>(
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<T> {
    const dynamicHeaders = await this.resolveHeaders();

    const res = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...dynamicHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    const json = (await res.json()) as AiGenerateResponse<T>;

    if (!res.ok || !json.success || !json.data) {
      const errMessage = json?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      const error = new Error(errMessage);
      (error as unknown as { code?: string; details?: unknown }).code = json?.error?.code;
      (error as unknown as { code?: string; details?: unknown }).details = json?.error?.details;
      throw error;
    }

    return json.data;
  }

  async generatePage(
    params: AiGeneratePageRequest,
    options?: { signal?: AbortSignal },
  ): Promise<PageDocument> {
    return this.sendRequest<PageDocument>(
      {
        mode: 'full-page',
        ...params,
      },
      options?.signal,
    );
  }

  async generateSection(
    params: AiGenerateSectionRequest,
    options?: { signal?: AbortSignal },
  ): Promise<Node> {
    return this.sendRequest<Node>(
      {
        mode: 'section',
        ...params,
      },
      options?.signal,
    );
  }

  async refactorNode(
    params: AiRefactorNodeRequest,
    options?: { signal?: AbortSignal },
  ): Promise<Node> {
    return this.sendRequest<Node>(
      {
        mode: 'refactor',
        ...params,
      },
      options?.signal,
    );
  }
}

export function createAiClient(options: AiClientOptions): KubuildAiClient {
  return new KubuildAiClient(options);
}
