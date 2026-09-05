import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';
import { readSseDataLines } from './stream-utils';

export interface GeminiAdapterOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
}

export class GeminiAdapter implements AiProviderAdapter {
  readonly name = 'gemini';
  private apiKey: string;
  private model: string;
  private temperature: number;
  private baseUrl: string;

  constructor(options: GeminiAdapterOptions) {
    if (!options.apiKey) {
      throw new Error('GeminiAdapter requires an apiKey');
    }
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-2.5-flash';
    this.temperature = options.temperature ?? 0.4;
    this.baseUrl =
      options.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  private buildContents(
    params: AiProviderGenerateParams,
  ): Array<{ role: string; parts: Array<{ text: string }> }> {
    const { userPrompt, messages: chatMessages } = params;
    return chatMessages && chatMessages.length > 0
      ? chatMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))
      : [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ];
  }

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const { systemPrompt, messages: chatMessages, signal } = params;

    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const contents = this.buildContents(params);

    const generationConfig: Record<string, unknown> = {
      temperature: this.temperature,
    };

    if (params.jsonSchema || (!chatMessages && (systemPrompt.includes('JSON') || systemPrompt.includes('json')))) {
      generationConfig.responseMimeType = 'application/json';
    }

    const body: Record<string, unknown> = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Gemini API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Gemini returned an empty or invalid candidate response');
    }

    return {
      text: candidateText,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
          }
        : undefined,
    };
  }

  /**
   * Token-level streaming via Gemini's `streamGenerateContent` SSE endpoint (STORA-515).
   */
  async *generateStream(
    params: AiProviderGenerateParams,
  ): AsyncGenerator<string, AiProviderGenerateResult, void> {
    const { systemPrompt, signal } = params;
    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(this.apiKey)}`;
    const contents = this.buildContents(params);

    const generationConfig: Record<string, unknown> = {
      temperature: this.temperature,
    };

    const body: Record<string, unknown> = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Gemini API error [${res.status} ${res.statusText}]: ${errText || 'Unknown error'}`,
      );
    }

    if (!res.body) {
      throw new Error('Gemini streaming response has no readable body');
    }

    let text = '';
    let usage: AiProviderGenerateResult['usage'];

    for await (const raw of readSseDataLines(res.body, signal)) {
      let parsed: {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof delta === 'string' && delta.length > 0) {
        text += delta;
        yield delta;
      }

      if (parsed.usageMetadata) {
        usage = {
          promptTokens: parsed.usageMetadata.promptTokenCount,
          completionTokens: parsed.usageMetadata.candidatesTokenCount,
        };
      }
    }

    return { text, usage };
  }
}
