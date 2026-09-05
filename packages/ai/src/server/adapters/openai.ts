import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';
import { readSseDataLines } from './stream-utils';

export interface OpenAiAdapterOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class OpenAiAdapter implements AiProviderAdapter {
  readonly name = 'openai';
  private apiKey: string;
  private model: string;
  private temperature: number;
  private baseUrl: string;
  private customHeaders?: Record<string, string>;

  constructor(options: OpenAiAdapterOptions) {
    if (!options.apiKey) {
      throw new Error('OpenAiAdapter requires an apiKey');
    }
    this.apiKey = options.apiKey;
    this.model = options.model || 'gpt-4o';
    this.temperature = options.temperature ?? 0.4;
    this.baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.customHeaders = options.headers;
  }

  private buildMessages(params: AiProviderGenerateParams): Array<{ role: string; content: string }> {
    const { systemPrompt, userPrompt, messages: chatMessages } = params;
    return chatMessages && chatMessages.length > 0
      ? [
          { role: 'system', content: systemPrompt },
          ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        ]
      : [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];
  }

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const { systemPrompt, signal } = params;

    const url = `${this.baseUrl}/chat/completions`;
    const messages = this.buildMessages(params);
    const chatMessages = params.messages;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: this.temperature,
      messages,
    };

    // Only force json_object when JSON schema is provided or specifically requested,
    // allowing natural conversation text in chat mode.
    if (params.jsonSchema || (!chatMessages && (systemPrompt.includes('JSON') || systemPrompt.includes('json')))) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `OpenAI API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI returned an empty message content');
    }

    return {
      text: content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  }

  /**
   * Token-level streaming via OpenAI's `stream: true` chat completions mode (STORA-515).
   * Yields each `delta.content` fragment as it arrives and returns the fully assembled
   * text + usage (when the final chunk includes it) once the stream ends.
   */
  async *generateStream(
    params: AiProviderGenerateParams,
  ): AsyncGenerator<string, AiProviderGenerateResult, void> {
    const { signal } = params;
    const url = `${this.baseUrl}/chat/completions`;
    const messages = this.buildMessages(params);

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: this.temperature,
      messages,
      stream: true,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.customHeaders,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `OpenAI API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    if (!res.body) {
      throw new Error('OpenAI streaming response has no readable body');
    }

    let text = '';
    let usage: AiProviderGenerateResult['usage'];

    for await (const raw of readSseDataLines(res.body, signal)) {
      if (raw === '[DONE]') break;

      let parsed: {
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        text += delta;
        yield delta;
      }

      if (parsed.usage) {
        usage = {
          promptTokens: parsed.usage.prompt_tokens,
          completionTokens: parsed.usage.completion_tokens,
        };
      }
    }

    return { text, usage };
  }
}
