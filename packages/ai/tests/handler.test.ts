import { describe, it, expect, vi } from 'vitest';
import { createAiHandler } from '../src/server/handler';
import { KubuildAiEngine } from '../src/server/engine';
import type { AiProviderAdapter } from '../src/types';

describe('createAiHandler', () => {
  const mockAdapter: AiProviderAdapter = {
    name: 'mock',
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        schema: 'stora.page',
        version: '1.0.0',
        metadata: { title: 'Sample' },
        document: { id: 'root', type: 'page', children: [] },
      }),
    }),
  };

  const engine = new KubuildAiEngine({ adapter: mockAdapter });
  const handler = createAiHandler(engine);

  it('rejects GET method with 405 Method Not Allowed', async () => {
    const req = new Request('http://localhost/api/ai', { method: 'GET' });
    const res = await handler(req);
    expect(res.status).toBe(405);
    const body = await res.json();
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('rejects invalid request body with 400', async () => {
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full-page' }), // missing prompt
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_PROMPT');
  });

  it('handles valid POST request for full-page generation', async () => {
    const req = new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'full-page',
        prompt: 'Build a photography portfolio',
      }),
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.schema).toBe('stora.page');
  });
});

describe('createAiHandler beforeRequest hook (STORA-519)', () => {
  const makeRequest = () =>
    new Request('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'full-page',
        prompt: 'Build a photography portfolio',
      }),
    });

  const makeAdapter = (): AiProviderAdapter => ({
    name: 'mock',
    generate: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        schema: 'stora.page',
        version: '1.0.0',
        metadata: { title: 'Sample' },
        document: { id: 'root', type: 'page', children: [] },
      }),
    }),
  });

  it('rejects the request and never reaches the engine/provider when the hook returns a Response', async () => {
    const adapter = makeAdapter();
    const engine = new KubuildAiEngine({ adapter });
    const beforeRequest = vi.fn(() => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }));
    const handler = createAiHandler(engine, { beforeRequest });

    const res = await handler(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('unauthorized');
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('supports an async hook that rejects (e.g. rate limiting)', async () => {
    const adapter = makeAdapter();
    const engine = new KubuildAiEngine({ adapter });
    const beforeRequest = vi.fn(async () => new Response('Too Many Requests', { status: 429 }));
    const handler = createAiHandler(engine, { beforeRequest });

    const res = await handler(makeRequest());

    expect(res.status).toBe(429);
    expect(adapter.generate).not.toHaveBeenCalled();
  });

  it('proceeds with unchanged behavior when the hook allows the request (returns void)', async () => {
    const adapter = makeAdapter();
    const engine = new KubuildAiEngine({ adapter });
    const beforeRequest = vi.fn(() => undefined);
    const handler = createAiHandler(engine, { beforeRequest });

    const res = await handler(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.schema).toBe('stora.page');
    expect(beforeRequest).toHaveBeenCalledTimes(1);
    expect(adapter.generate).toHaveBeenCalledTimes(1);
  });

  it('behaves byte-for-byte the same as before when no hook is provided', async () => {
    const adapter = makeAdapter();
    const engine = new KubuildAiEngine({ adapter });
    const handlerWithoutOptions = createAiHandler(engine);
    const handlerWithEmptyOptions = createAiHandler(engine, {});

    const resWithout = await handlerWithoutOptions(makeRequest());
    const bodyWithout = await resWithout.json();

    const resWithEmpty = await handlerWithEmptyOptions(makeRequest());
    const bodyWithEmpty = await resWithEmpty.json();

    expect(resWithout.status).toBe(200);
    expect(resWithEmpty.status).toBe(200);
    expect(bodyWithout).toEqual(bodyWithEmpty);
    expect(bodyWithout.success).toBe(true);
    expect(bodyWithout.data.schema).toBe('stora.page');
  });
});
