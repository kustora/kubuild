import { describe, it, expect, vi, afterEach } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import { createAiHandler } from '../src/server/handler';
import { createAiClient } from '../src/client/ai-client';
import type { AiProviderAdapter, AiStreamEvent } from '../src/types';

describe('Progressive Streaming (SSE)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('engine.streamPage emits progressive events (status, metadata, section, complete)', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn()
        // 1st call: Plan
        .mockResolvedValueOnce({
          text: JSON.stringify({
            title: 'Streaming Bakery',
            description: 'Delicious bakery landing page',
            pageStyles: { base: { backgroundColor: '#fffbf0' } },
            sections: [
              { type: 'hero', title: 'Bakery Hero', prompt: 'Hero with headline and CTA' },
              { type: 'features', title: 'Fresh Breads', prompt: 'Grid of fresh breads' },
            ],
          }),
        })
        // 2nd call: Section 1
        .mockResolvedValueOnce({
          text: JSON.stringify({
            id: 'hero-sec',
            type: 'section',
            props: {},
            children: [{ id: 'btn', type: 'button', props: { label: 'Order Pastry' } }],
          }),
        })
        // 3rd call: Section 2
        .mockResolvedValueOnce({
          text: JSON.stringify({
            id: 'breads-sec',
            type: 'section',
            props: {},
            children: [{ id: 'title', type: 'heading', props: { text: 'Our Specialties' } }],
          }),
        }),
    };

    const engine = new KubuildAiEngine({ adapter: mockAdapter });
    const events: AiStreamEvent[] = [];

    for await (const ev of engine.streamPage({ prompt: 'Bakery shop' })) {
      events.push(ev);
    }

    expect(events.some((e) => e.type === 'status')).toBe(true);

    const metadataEvent = events.find((e) => e.type === 'metadata') as Extract<
      AiStreamEvent,
      { type: 'metadata' }
    >;
    expect(metadataEvent).toBeDefined();
    expect(metadataEvent.metadata.title).toBe('Streaming Bakery');
    expect(metadataEvent.rootPageNode.type).toBe('page');

    const sectionEvents = events.filter((e) => e.type === 'section') as Array<
      Extract<AiStreamEvent, { type: 'section' }>
    >;
    expect(sectionEvents).toHaveLength(2);
    expect(sectionEvents[0].section.id).toBe('hero-sec');
    expect(sectionEvents[1].section.id).toBe('breads-sec');

    const completeEvent = events.find((e) => e.type === 'complete') as Extract<
      AiStreamEvent,
      { type: 'complete' }
    >;
    expect(completeEvent).toBeDefined();
    expect(completeEvent.document.schema).toBe('stora.page');
    expect(completeEvent.document.document.children).toHaveLength(2);
  });

  it('createAiHandler returns text/event-stream when stream: true', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn()
        .mockResolvedValueOnce({
          text: JSON.stringify({
            title: 'Streamed App',
            sections: [{ type: 'hero', title: 'Hero', prompt: 'Hero banner' }],
          }),
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            id: 'sec-1',
            type: 'section',
            children: [],
          }),
        }),
    };

    const engine = new KubuildAiEngine({ adapter: mockAdapter });
    const handler = createAiHandler(engine);

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'full-page',
        stream: true,
        prompt: 'Build SaaS portfolio',
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: status');
    expect(text).toContain('event: metadata');
    expect(text).toContain('event: section');
    expect(text).toContain('event: complete');
  });

  it('createAiHandler remains backward-compatible returning application/json when stream is omitted', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          schema: 'stora.page',
          version: '1.0.0',
          document: { id: 'root', type: 'page', children: [] },
        }),
      }),
    };

    const engine = new KubuildAiEngine({ adapter: mockAdapter });
    const handler = createAiHandler(engine);

    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'full-page',
        // stream not specified (backward compatibility)
        prompt: 'Build portfolio',
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.schema).toBe('stora.page');
  });

  it('KubuildAiClient.streamPage consumes SSE and dispatches progressive callbacks', async () => {
    const ssePayload = [
      `event: status\ndata: ${JSON.stringify({ type: 'status', message: 'Planning...' })}\n\n`,
      `event: metadata\ndata: ${JSON.stringify({ type: 'metadata', metadata: { title: 'Test' }, rootPageNode: { id: 'root', type: 'page' } })}\n\n`,
      `event: section\ndata: ${JSON.stringify({ type: 'section', index: 0, total: 1, section: { id: 'sec-1', type: 'section' } })}\n\n`,
      `event: complete\ndata: ${JSON.stringify({ type: 'complete', document: { schema: 'stora.page', version: '1.0.0', document: { id: 'root', type: 'page', children: [] } } })}\n\n`,
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    });

    const client = createAiClient({
      endpoint: '/api/builder/ai',
      fetch: mockFetch,
    });

    const onStatus = vi.fn();
    const onMetadata = vi.fn();
    const onSection = vi.fn();
    const onComplete = vi.fn();

    const doc = await client.streamPage(
      { prompt: 'Stream test' },
      { onStatus, onMetadata, onSection, onComplete },
    );

    expect(doc.schema).toBe('stora.page');
    expect(onStatus).toHaveBeenCalledWith('Planning...');
    expect(onMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test' }),
      expect.objectContaining({ id: 'root', type: 'page' }),
    );
    expect(onSection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sec-1', type: 'section' }),
      0,
      1,
    );
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ schema: 'stora.page' }));
  });
});
