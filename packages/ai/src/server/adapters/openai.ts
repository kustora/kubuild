import type {
  AiChatMessage,
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
  AiStopReason,
  AiToolUseBlock,
} from '../../types';
import { getMessageText, getToolResultBlocks, getToolUseBlocks } from '../../core/messages';
import { readSseDataLines } from './stream-utils';

export interface OpenAiAdapterOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  baseUrl?: string;
  headers?: Record<string, string>;
}

/** OpenAI Chat Completions message shape — `tool_calls`/`role: 'tool'` included. */
interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

interface OpenAiToolCallPayload {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

/**
 * Maps OpenAI's `finish_reason` onto the provider-agnostic `AiStopReason` the agent loop
 * branches on (STORA-530).
 */
function mapStopReason(finishReason: string | undefined | null): AiStopReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'tool_calls':
    case 'function_call':
      return 'tool_calls';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'unknown';
  }
}

/**
 * Parses OpenAI `tool_calls` into `AiToolUseBlock`s. A call whose `arguments` isn't valid
 * JSON is surfaced with an empty `input` rather than throwing: the agent's tool executor
 * then rejects it with a `tool_result` error and the model self-corrects on the next step,
 * which is far better than killing the whole run over one malformed argument blob.
 */
function parseToolCalls(raw: OpenAiToolCallPayload[] | undefined): AiToolUseBlock[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .filter((call) => call?.function?.name)
    .map((call, index) => {
      let input: Record<string, unknown> = {};
      const argsText = call.function?.arguments;
      if (argsText && argsText.trim()) {
        try {
          const parsed = JSON.parse(argsText);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            input = parsed as Record<string, unknown>;
          }
        } catch {
          input = {};
        }
      }
      return {
        type: 'tool_use' as const,
        id: call.id || `call_${index}`,
        name: call.function!.name!,
        input,
      };
    });
}

export class OpenAiAdapter implements AiProviderAdapter {
  readonly name = 'openai';
  readonly supportsTools = true;
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

  /**
   * Expands one `AiChatMessage` into the one-or-more OpenAI messages it corresponds to
   * (STORA-530).
   *
   * The block model is Anthropic-shaped — tool results ride along inside a `user` message —
   * while OpenAI wants each result as its own `role: 'tool'` message keyed by
   * `tool_call_id`. That fan-out happens here so the rest of the stack stays
   * provider-agnostic.
   */
  private mapMessage(message: AiChatMessage): OpenAiMessage[] {
    const toolUses = getToolUseBlocks(message);
    const toolResults = getToolResultBlocks(message);
    const text = getMessageText(message);

    if (toolResults.length > 0) {
      const results: OpenAiMessage[] = toolResults.map((block) => ({
        role: 'tool',
        content: block.content,
        tool_call_id: block.toolUseId,
      }));
      // Any free text riding alongside tool results becomes a separate user turn — OpenAI
      // rejects a `role: 'tool'` message that carries anything but the result payload.
      if (text.trim()) {
        results.push({ role: 'user', content: text });
      }
      return results;
    }

    if (toolUses.length > 0) {
      return [
        {
          role: 'assistant',
          content: text.trim() ? text : null,
          tool_calls: toolUses.map((block) => ({
            id: block.id,
            type: 'function' as const,
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          })),
        },
      ];
    }

    return [{ role: message.role, content: text }];
  }

  private buildMessages(params: AiProviderGenerateParams): OpenAiMessage[] {
    const { systemPrompt, userPrompt, messages: chatMessages } = params;
    if (chatMessages && chatMessages.length > 0) {
      return [
        { role: 'system', content: systemPrompt },
        ...chatMessages.flatMap((m) => this.mapMessage(m)),
      ];
    }
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Shared request body builder for `generate`/`generateStream` — notably the
   * `response_format` decision, which must never fire in tool mode: OpenAI rejects
   * `json_object` combined with `tools`, and a tool-calling turn's text output is a
   * natural-language summary, not JSON.
   */
  private buildBody(params: AiProviderGenerateParams): Record<string, unknown> {
    const { systemPrompt, jsonSchema, messages: chatMessages, tools, toolChoice } = params;

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: params.temperature ?? this.temperature,
      messages: this.buildMessages(params),
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      }));
      if (toolChoice) {
        body.tool_choice =
          typeof toolChoice === 'string'
            ? toolChoice
            : { type: 'function', function: { name: toolChoice.name } };
      }
      return body;
    }

    // Only force json_object when JSON schema is provided or specifically requested,
    // allowing natural conversation text in chat mode.
    if (jsonSchema || (!chatMessages && (systemPrompt.includes('JSON') || systemPrompt.includes('json')))) {
      body.response_format = { type: 'json_object' };
    }

    return body;
  }

  private async post(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
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

    return res;
  }

  async generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult> {
    const res = await this.post(this.buildBody(params), params.signal);

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: {
          content?: string;
          tool_calls?: OpenAiToolCallPayload[];
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    const toolCalls = parseToolCalls(choice?.message?.tool_calls);

    // A tool-calling turn legitimately has null content — only a turn with neither text
    // nor tool calls is an empty response worth throwing over.
    if (!content && toolCalls.length === 0) {
      throw new Error('OpenAI returned an empty message content');
    }

    return {
      text: content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: mapStopReason(choice?.finish_reason),
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
   *
   * Tool calls arrive fragmented too (STORA-530): `delta.tool_calls[].function.arguments`
   * is delivered as a character stream across many chunks, keyed by array `index`. They're
   * accumulated per index and parsed only once the stream ends — parsing a partial
   * arguments string would always fail. Tool call deltas are never `yield`ed as text,
   * since they aren't part of the assistant's visible message.
   */
  async *generateStream(
    params: AiProviderGenerateParams,
  ): AsyncGenerator<string, AiProviderGenerateResult, void> {
    const { signal } = params;
    const res = await this.post({ ...this.buildBody(params), stream: true }, signal);

    if (!res.body) {
      throw new Error('OpenAI streaming response has no readable body');
    }

    let text = '';
    let usage: AiProviderGenerateResult['usage'];
    let finishReason: string | undefined;
    const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

    for await (const raw of readSseDataLines(res.body, signal)) {
      if (raw === '[DONE]') break;

      let parsed: {
        choices?: Array<{
          finish_reason?: string;
          delta?: {
            content?: string;
            tool_calls?: Array<OpenAiToolCallPayload & { index?: number }>;
          };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }

      const choice = parsed.choices?.[0];

      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        text += delta;
        yield delta;
      }

      for (const call of choice?.delta?.tool_calls ?? []) {
        const index = typeof call.index === 'number' ? call.index : 0;
        const entry = toolCallAccumulator.get(index) ?? { id: '', name: '', arguments: '' };
        if (call.id) entry.id = call.id;
        if (call.function?.name) entry.name = call.function.name;
        if (call.function?.arguments) entry.arguments += call.function.arguments;
        toolCallAccumulator.set(index, entry);
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason;
      }

      if (parsed.usage) {
        usage = {
          promptTokens: parsed.usage.prompt_tokens,
          completionTokens: parsed.usage.completion_tokens,
        };
      }
    }

    const toolCalls = parseToolCalls(
      Array.from(toolCallAccumulator.entries())
        .sort(([a], [b]) => a - b)
        .map(([, entry]) => ({
          id: entry.id,
          type: 'function',
          function: { name: entry.name, arguments: entry.arguments },
        })),
    );

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: mapStopReason(finishReason),
      usage,
    };
  }
}
