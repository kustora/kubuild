import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';

export interface CustomHttpAdapterOptions {
  url: string;
  name?: string;
  headers?: Record<string, string>;
  formatRequestBody?: (params: AiProviderGenerateParams) => unknown;
  parseResponse?: (json: unknown) => string;
}

export class CustomHttpAdapter implements AiProviderAdapter {
  readonly name: string;
  private url: string;
  private headers?: Record<string, string>;
  private formatRequestBody: (params: AiProviderGenerateParams) => unknown;
  private parseResponse: (json: unknown) => string;

  constructor(options: CustomHttpAdapterOptions) {
    if (!options.url) {
      throw new Error('CustomHttpAdapter requires a url');
    }
    this.url = options.url;
    this.name = options.name || 'custom-http';
    this.headers = options.headers;

    // Default body formatter (OpenAI compatible or Ollama chat compatible)
    this.formatRequestBody =
      options.formatRequestBody ||
      ((params) => ({
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt },
        ],
      }));

    // Default response parser
    this.parseResponse =
      options.parseResponse ||
      ((json: unknown) => {
        if (!json || typeof json !== 'object') {
          throw new Error('Response is not a valid JSON object');
        }
        const obj = json as Record<string, unknown>;
        if (typeof obj.response === 'string') return obj.response; // Ollama generate
        if (typeof obj.text === 'string') return obj.text;
        const choices = obj.choices as Array<{ message?: { content?: string } }>;
        if (Array.isArray(choices) && choices[0]?.message?.content) {
          return choices[0].message.content; // OpenAI format
        }
        const message = obj.message as { content?: string };
        if (message && typeof message.content === 'string') {
          return message.content; // Ollama chat format
        }
        throw new Error('Unable to extract generated text from custom HTTP response');
      });
  }

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const body = this.formatRequestBody(params);

    const res = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Custom HTTP adapter error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    const json = await res.json();
    const text = this.parseResponse(json);

    return { text };
  }
}
