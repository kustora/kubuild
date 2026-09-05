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
