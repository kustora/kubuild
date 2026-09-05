import { describe, it, expect, vi, afterEach } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import { createAiHandler } from '../src/server/handler';
import { createAiClient } from '../src/client/ai-client';
import type { AiProviderAdapter, AiStreamEvent } from '../src/types';

describe('Token-Level Chat Streaming (STORA-515/516)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('engine.chatStream emits chat-chunk events progressively then a chat-complete event for a streaming-capable adapter', async () => {
    const streamingAdapter: AiProviderAdapter = {
      name: 'mock-streaming',
      generate: vi.fn(),
      async *generateStream() {
        yield 'Hello';
        yield ', world';
        yield '!';
        return { text: 'Hello, world!', usage: { promptTokens: 5, completionTokens: 3 } };
      },
    };

    const engine = new KubuildAiEngine({ adapter: streamingAdapter });
    const events: AiStreamEvent[] = [];

    for await (const ev of engine.chatStream({
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      events.push(ev);
    }

    const chunkEvents = events.filter((e) => e.type === 'chat-chunk') as Array<
      Extract<AiStreamEvent, { type: 'chat-chunk' }>
    >;
    expect(chunkEvents.map((e) => e.delta)).toEqual(['Hello', ', world', '!']);
    // `content` is the running accumulation, not just the latest delta.
    expect(chunkEvents.map((e) => e.content)).toEqual(['Hello', 'Hello, world', 'Hello, world!']);

    const completeEvent = events.find((e) => e.type === 'chat-complete') as Extract<
      AiStreamEvent,
      { type: 'chat-complete' }
    >;
    expect(completeEvent).toBeDefined();
    expect(completeEvent.message.role).toBe('assistant');
    expect(completeEvent.message.content).toBe('Hello, world!');

    // Never falls back to the non-streaming path when the adapter can stream.
    expect(streamingAdapter.generate).not.toHaveBeenCalled();
  });

  it('engine.chatStream gracefully falls back to a single generate() call for an adapter without generateStream, emitting the whole response as one chunk', async () => {
    const nonStreamingAdapter: AiProviderAdapter = {
      name: 'custom-http',
      generate: vi.fn().mockResolvedValue({ text: 'Full non-streamed response' }),
      // Deliberately no `generateStream` — mirrors CustomHttpAdapter's real shape.
    };

    const engine = new KubuildAiEngine({ adapter: nonStreamingAdapter });
    const events: AiStreamEvent[] = [];

    for await (const ev of engine.chatStream({
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      events.push(ev);
    }

    expect(nonStreamingAdapter.generate).toHaveBeenCalledTimes(1);

    const chunkEvents = events.filter((e) => e.type === 'chat-chunk') as Array<
      Extract<AiStreamEvent, { type: 'chat-chunk' }>
    >;
    expect(chunkEvents).toHaveLength(1);
    expect(chunkEvents[0].content).toBe('Full non-streamed response');
    expect(chunkEvents[0].delta).toBe('Full non-streamed response');

    const completeEvent = events.find((e) => e.type === 'chat-complete') as Extract<
      AiStreamEvent,
      { type: 'chat-complete' }
    >;
    expect(completeEvent.message.content).toBe('Full non-streamed response');

    // No error event — the fallback path must not surface as a failure.
    expect(events.some((e) => e.type === 'error')).toBe(false);
  });

  it('engine.chatStream yields a single error event for an empty messages array, matching chat()', async () => {
    const adapter: AiProviderAdapter = { name: 'mock', generate: vi.fn() };
    const engine = new KubuildAiEngine({ adapter });

    const events: AiStreamEvent[] = [];
    for await (const ev of engine.chatStream({ messages: [] })) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'error', error: { code: 'INVALID_CHAT_REQUEST' } });
  });

  it('engine.chatStream surfaces adapter failures as an error event instead of throwing', async () => {
    const failingAdapter: AiProviderAdapter = {
      name: 'failing-streaming',
      generate: vi.fn(),
      async *generateStream(): AsyncGenerator<string, never, void> {
        throw new Error('provider exploded');
      },
    };

    const engine = new KubuildAiEngine({ adapter: failingAdapter });
    const events: AiStreamEvent[] = [];
    for await (const ev of engine.chatStream({ messages: [{ role: 'user', content: 'Hi' }] })) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'error',
      error: { code: 'CHAT_STREAM_ERROR', message: expect.stringContaining('provider exploded') },
    });
  });

  it('createAiHandler pipes chatStream over text/event-stream for { mode: "chat", stream: true }', async () => {
    const streamingAdapter: AiProviderAdapter = {
      name: 'mock-streaming',
      generate: vi.fn(),
      async *generateStream() {
        yield 'Hi';
        yield ' there';
        return { text: 'Hi there' };
      },
    };
    const engine = new KubuildAiEngine({ adapter: streamingAdapter });
    const handler = createAiHandler(engine);

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'chat',
        stream: true,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: chat-chunk');
    expect(text).toContain('event: chat-complete');
  });

  it('createAiHandler returns 400 for { mode: "chat", stream: true } with no messages', async () => {
    const adapter: AiProviderAdapter = { name: 'mock', generate: vi.fn() };
    const engine = new KubuildAiEngine({ adapter });
    const handler = createAiHandler(engine);

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'chat', stream: true }),
    });

    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CHAT_PARAMS');
  });

  it('createAiHandler full-page streaming (stream: true, no mode) remains unaffected by the new chat routing', async () => {
    const adapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValueOnce({
        text: JSON.stringify({ title: 'App', sections: [{ type: 'hero', title: 'Hero', prompt: 'Hero' }] }),
      }).mockResolvedValueOnce({
        text: JSON.stringify({ id: 'sec-1', type: 'section', children: [] }),
      }),
    };
    const engine = new KubuildAiEngine({ adapter });
    const handler = createAiHandler(engine);

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full-page', stream: true, prompt: 'Build a page' }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('event: complete');
  });

  it('KubuildAiClient.chatStream parses partial chunks and resolves the final assistant message (reusing streamPage transport)', async () => {
    const ssePayload = [
      `event: chat-chunk\ndata: ${JSON.stringify({ type: 'chat-chunk', delta: 'Hello', content: 'Hello' })}\n\n`,
      `event: chat-chunk\ndata: ${JSON.stringify({ type: 'chat-chunk', delta: ', world', content: 'Hello, world' })}\n\n`,
      `event: chat-complete\ndata: ${JSON.stringify({ type: 'chat-complete', message: { role: 'assistant', content: 'Hello, world', timestamp: 123 } })}\n\n`,
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: stream });
    const client = createAiClient({ endpoint: '/api/builder/ai', fetch: mockFetch });

    const onChatChunk = vi.fn();
    const onChatComplete = vi.fn();

    const message = await client.chatStream(
      { messages: [{ role: 'user', content: 'Hi' }] },
      { onChatChunk, onChatComplete },
    );

    expect(message.content).toBe('Hello, world');
    expect(onChatChunk).toHaveBeenCalledWith('Hello', 'Hello');
    expect(onChatChunk).toHaveBeenCalledWith(', world', 'Hello, world');
    expect(onChatComplete).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hello, world' }));

    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('/api/builder/ai');
    const body = JSON.parse(calledOptions.body);
    expect(body.mode).toBe('chat');
    expect(body.stream).toBe(true);
  });

  it('KubuildAiClient.chatStream rejects and calls onError when the stream emits an error event', async () => {
    const ssePayload = `event: error\ndata: ${JSON.stringify({ type: 'error', error: { code: 'CHAT_STREAM_ERROR', message: 'boom' } })}\n\n`;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, body: stream });
    const client = createAiClient({ endpoint: '/api/builder/ai', fetch: mockFetch });
    const onError = vi.fn();

    await expect(
      client.chatStream({ messages: [{ role: 'user', content: 'Hi' }] }, { onError }),
    ).rejects.toThrow('boom');
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
