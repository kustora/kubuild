import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';
import { readSseDataLines } from './stream-utils';

export interface AnthropicAdapterOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  baseUrl?: string;
  anthropicVersion?: string;
  headers?: Record<string, string>;
}

export class AnthropicAdapter implements AiProviderAdapter {
  readonly name = 'anthropic';
  private apiKey: string;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private baseUrl: string;
  private anthropicVersion: string;
  private customHeaders?: Record<string, string>;

  constructor(options: AnthropicAdapterOptions) {
    if (!options.apiKey) {
      throw new Error('AnthropicAdapter requires an apiKey');
    }
    this.apiKey = options.apiKey;
    this.model = options.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = options.maxTokens ?? 4096;
    this.temperature = options.temperature ?? 0.4;
    this.baseUrl = (options.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.anthropicVersion = options.anthropicVersion || '2023-06-01';
    this.customHeaders = options.headers;
  }

  private buildMessages(
    params: AiProviderGenerateParams,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const { userPrompt, messages: chatMessages } = params;
    return chatMessages && chatMessages.length > 0
      ? chatMessages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [
          {
            role: 'user' as const,
            content: userPrompt,
          },
        ];
  }

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const { systemPrompt, signal } = params;

    const url = `${this.baseUrl}/messages`;
    const messages = this.buildMessages(params);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.anthropicVersion,
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Anthropic API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    const data = (await res.json()) as {
      content?: Array<{
        type?: string;
        text?: string;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    const textPart = data.content?.find((c) => c.type === 'text')?.text;
    if (!textPart) {
      throw new Error('Anthropic returned an empty text content');
    }

    return {
      text: textPart,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    };
  }

  /**
   * Token-level streaming via Anthropic's `stream: true` Messages API (STORA-515).
   * Parses the `content_block_delta` (`text_delta`) events for incremental text and the
   * `message_start`/`message_delta` events for usage accounting.
   */
  async *generateStream(
    params: AiProviderGenerateParams,
  ): AsyncGenerator<string, AiProviderGenerateResult, void> {
    const { systemPrompt, signal } = params;
    const url = `${this.baseUrl}/messages`;
    const messages = this.buildMessages(params);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      system: systemPrompt,
      messages,
      stream: true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': this.anthropicVersion,
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Anthropic API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    if (!res.body) {
      throw new Error('Anthropic streaming response has no readable body');
    }

    let text = '';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;

    for await (const raw of readSseDataLines(res.body, signal)) {
      if (!raw) continue;

      let evt: {
        type?: string;
        delta?: { type?: string; text?: string };
        usage?: { output_tokens?: number };
        message?: { usage?: { input_tokens?: number } };
      };
      try {
        evt = JSON.parse(raw);
      } catch {
        continue;
      }

      if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
        const delta = evt.delta.text;
        if (typeof delta === 'string' && delta.length > 0) {
          text += delta;
          yield delta;
        }
      } else if (evt.type === 'message_start' && evt.message?.usage?.input_tokens !== undefined) {
        promptTokens = evt.message.usage.input_tokens;
      } else if (evt.type === 'message_delta' && evt.usage?.output_tokens !== undefined) {
        completionTokens = evt.usage.output_tokens;
      }
    }

    return {
      text,
      usage:
        promptTokens !== undefined || completionTokens !== undefined
          ? { promptTokens, completionTokens }
          : undefined,
    };
  }
}
