import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
} from '../../types';

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

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const { systemPrompt, userPrompt, messages: chatMessages, signal } = params;

    const url = `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const contents = chatMessages && chatMessages.length > 0
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
}
