import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';

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

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const { systemPrompt, userPrompt, messages: chatMessages, signal } = params;

    const url = `${this.baseUrl}/chat/completions`;

    const messages = chatMessages && chatMessages.length > 0
      ? [
          { role: 'system', content: systemPrompt },
          ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
        ]
      : [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ];

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
}
