import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAiClient } from '../src/client/ai-client';

describe('KubuildAiClient', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws error if initialized without endpoint', () => {
    expect(() => createAiClient({ endpoint: '' })).toThrow();
  });

  it('sends POST request for generatePage', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          schema: 'stora.page',
          version: '1.0.0',
          metadata: { title: 'Client Generated' },
          document: { id: 'root', type: 'page', children: [] },
        },
      }),
    });

    const client = createAiClient({
      endpoint: '/api/builder/ai',
      fetch: mockFetch,
    });

    const doc = await client.generatePage({
      prompt: 'Minimal agency landing page',
    });

    expect(doc.schema).toBe('stora.page');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
    expect(calledUrl).toBe('/api/builder/ai');
    expect(calledOptions.method).toBe('POST');
    const body = JSON.parse(calledOptions.body);
    expect(body.mode).toBe('full-page');
    expect(body.prompt).toBe('Minimal agency landing page');
  });

  it('handles custom dynamic headers for authentication', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'sec-1',
          type: 'section',
        },
      }),
    });

    const client = createAiClient({
      endpoint: '/api/builder/ai',
      headers: async () => ({ Authorization: 'Bearer test-jwt-token' }),
      fetch: mockFetch,
    });

    await client.generateSection({ prompt: 'Add FAQ section' });

    const [, calledOptions] = mockFetch.mock.calls[0];
    expect(calledOptions.headers.Authorization).toBe('Bearer test-jwt-token');
  });

  it('throws structured error when server responds with failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'User quota exceeded',
        },
      }),
    });

    const client = createAiClient({
      endpoint: '/api/builder/ai',
      fetch: mockFetch,
    });

    await expect(client.generatePage({ prompt: 'test' })).rejects.toThrow(
      'User quota exceeded',
    );
  });
});
