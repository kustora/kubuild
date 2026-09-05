import type { PageDocument, Node } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiChatRequest,
  AiChatResponse,
  AiChatMessage,
  AiGenerateResponse,
  AiStreamCallbacks,
  AiStreamEvent,
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
    this.fetchFn = options.fetch || globalThis.fetch.bind(globalThis);
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

  /**
   * Standard single-pass full page generator (non-streaming).
   */
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

  /**
   * Low-level SSE frame consumer shared by every streaming method on this client
   * (`streamPage`, `chatStream`) — one transport implementation, reused rather than
   * duplicated per stream "flavor" (STORA-515).
   *
   * Reads `res.body`, decodes `data: <json>\n\n` frames into `AiStreamEvent`s, and
   * invokes `onEvent` for each one in arrival order. If `onEvent` throws (the
   * conventional way callers signal a fatal `error` event), the throw propagates out of
   * this method after the reader lock is released.
   */
  private async consumeSse(
    res: Response,
    onEvent: (event: AiStreamEvent) => void,
  ): Promise<void> {
    if (!res.body) {
      throw new Error('Response body is null, cannot stream');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              let event: AiStreamEvent;
              try {
                event = JSON.parse(line.slice(6).trim()) as AiStreamEvent;
              } catch {
                // Ignore incomplete or non-JSON data frames
                continue;
              }
              onEvent(event);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Progressive section streamer (SSE).
   * Calls callbacks on each event (status, metadata, section, complete).
   */
  async streamPage(
    params: AiGeneratePageRequest,
    callbacks?: AiStreamCallbacks,
    options?: { signal?: AbortSignal },
  ): Promise<PageDocument> {
    const dynamicHeaders = await this.resolveHeaders();

    const res = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...dynamicHeaders,
      },
      body: JSON.stringify({
        mode: 'full-page',
        stream: true,
        ...params,
      }),
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Streaming failed [${res.status} ${res.statusText}]: ${errText}`);
      callbacks?.onError?.(err);
      throw err;
    }

    let finalDoc: PageDocument | null = null;

    await this.consumeSse(res, (event) => {
      if (event.type === 'status') {
        callbacks?.onStatus?.(event.message);
      } else if (event.type === 'metadata') {
        callbacks?.onMetadata?.(event.metadata, event.rootPageNode);
      } else if (event.type === 'section') {
        callbacks?.onSection?.(event.section, event.index, event.total);
      } else if (event.type === 'complete') {
        finalDoc = event.document;
        callbacks?.onComplete?.(event.document);
      } else if (event.type === 'error') {
        const err = new Error(event.error.message || 'Stream error');
        (err as unknown as { code?: string }).code = event.error.code;
        callbacks?.onError?.(err);
        throw err;
      }
    });

    if (!finalDoc) {
      throw new Error('Stream ended without receiving complete document');
    }

    return finalDoc;
  }

  /**
   * Token-level streaming chat (STORA-515). Calls `onChatChunk` for every partial chunk
   * as it arrives and resolves with the fully assembled assistant `AiChatMessage` once
   * the stream's terminal `chat-complete` event is received. Reuses the exact same SSE
   * transport as `streamPage` via `consumeSse` — no separate parsing path.
   */
  async chatStream(
    params: AiChatRequest,
    callbacks?: Pick<AiStreamCallbacks, 'onChatChunk' | 'onChatComplete' | 'onError'>,
    options?: { signal?: AbortSignal },
  ): Promise<AiChatMessage> {
    const dynamicHeaders = await this.resolveHeaders();

    const res = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...dynamicHeaders,
      },
      body: JSON.stringify({
        mode: 'chat',
        stream: true,
        ...params,
      }),
      signal: options?.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`Chat streaming failed [${res.status} ${res.statusText}]: ${errText}`);
      callbacks?.onError?.(err);
      throw err;
    }

    let finalMessage: AiChatMessage | null = null;

    await this.consumeSse(res, (event) => {
      if (event.type === 'chat-chunk') {
        callbacks?.onChatChunk?.(event.delta, event.content);
      } else if (event.type === 'chat-complete') {
        finalMessage = event.message;
        callbacks?.onChatComplete?.(event.message);
      } else if (event.type === 'error') {
        const err = new Error(event.error.message || 'Stream error');
        (err as unknown as { code?: string }).code = event.error.code;
        callbacks?.onError?.(err);
        throw err;
      }
    });

    if (!finalMessage) {
      throw new Error('Chat stream ended without receiving a complete message');
    }

    return finalMessage;
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

  async chat(
    params: AiChatRequest,
    options?: { signal?: AbortSignal },
  ): Promise<AiChatResponse> {
    return this.sendRequest<AiChatResponse>(
      {
        mode: 'chat',
        ...params,
      },
      options?.signal,
    );
  }
}

export function createAiClient(options: AiClientOptions): KubuildAiClient {
  return new KubuildAiClient(options);
}
