import { describe, it, expect, vi, afterEach } from 'vitest';
import { GeminiAdapter } from '../src/server/adapters/gemini';
import { OpenAiAdapter } from '../src/server/adapters/openai';
import { AnthropicAdapter } from '../src/server/adapters/anthropic';
import { CustomHttpAdapter } from '../src/server/adapters/custom';

/**
 * Helper: build a ReadableStream<Uint8Array> from an array of raw SSE frame strings
 * (each already newline-terminated) so adapters can consume it exactly like a real
 * fetch() response body.
 */
function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame));
      }
      controller.close();
    },
  });
}

async function collect(gen: AsyncGenerator<string, unknown, void>): Promise<{
  chunks: string[];
  result: unknown;
}> {
  const chunks: string[] = [];
  let result: unknown;
  while (true) {
    const { value, done } = await gen.next();
    if (done) {
      result = value;
      break;
    }
    chunks.push(value);
  }
  return { chunks, result };
}

describe('Provider Adapter Streaming (STORA-515)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('OpenAiAdapter.generateStream yields delta.content fragments and returns accumulated text + usage', async () => {
    const frames = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'lo' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 4, completion_tokens: 2 } })}\n\n`,
      `data: [DONE]\n\n`,
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: sseStream(frames) }) as unknown as typeof fetch;

    const adapter = new OpenAiAdapter({ apiKey: 'sk-test' });
    const { chunks, result } = await collect(
      adapter.generateStream!({ systemPrompt: 'sys', userPrompt: 'user' }),
    );

    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ text: 'Hello', usage: { promptTokens: 4, completionTokens: 2 } });
  });

  it('AnthropicAdapter.generateStream yields text_delta fragments and returns accumulated text + usage', async () => {
    const frames = [
      `data: ${JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 10 } } })}\n\n`,
      `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hel' } })}\n\n`,
      `data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'lo' } })}\n\n`,
      `data: ${JSON.stringify({ type: 'message_delta', usage: { output_tokens: 2 } })}\n\n`,
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: sseStream(frames) }) as unknown as typeof fetch;

    const adapter = new AnthropicAdapter({ apiKey: 'ant-test' });
    const { chunks, result } = await collect(
      adapter.generateStream!({ systemPrompt: 'sys', userPrompt: 'user' }),
    );

    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ text: 'Hello', usage: { promptTokens: 10, completionTokens: 2 } });
  });

  it('GeminiAdapter.generateStream yields candidate text fragments and returns accumulated text + usage', async () => {
    const frames = [
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] })}\n\n`,
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'lo' }] } }], usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2 } })}\n\n`,
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: sseStream(frames) }) as unknown as typeof fetch;

    const adapter = new GeminiAdapter({ apiKey: 'gem-test' });
    const { chunks, result } = await collect(
      adapter.generateStream!({ systemPrompt: 'sys', userPrompt: 'user' }),
    );

    expect(chunks).toEqual(['Hel', 'lo']);
    expect(result).toEqual({ text: 'Hello', usage: { promptTokens: 6, completionTokens: 2 } });
  });

  it('CustomHttpAdapter has no generateStream — it is the reference non-streaming-capable adapter', () => {
    const adapter = new CustomHttpAdapter({ url: 'http://localhost:11434/api/chat' });
    expect(adapter.generateStream).toBeUndefined();
  });
});
