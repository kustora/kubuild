import { describe, it, expect, vi } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import { processAiRequest, createAiHandler } from '../src/server/handler';
import { KubuildAiClient } from '../src/client/ai-client';
import type { AiProviderAdapter } from '../src/types';

describe('AI Chat and Q&A', () => {
  const mockAdapter: AiProviderAdapter = {
    name: 'mock',
    generate: vi.fn().mockImplementation(async (params) => {
      const lastMsg = params.messages?.[params.messages.length - 1]?.content || '';
      return {
        text: `AI Answer to: "${lastMsg}". Page has 3 sections.`,
        usage: { promptTokens: 10, completionTokens: 15 },
      };
    }),
  };

  it('engine.chat returns assistant response with document grounding', async () => {
    const engine = new KubuildAiEngine({ adapter: mockAdapter });
    const result = await engine.chat({
      messages: [
        { role: 'user', content: 'What components are in this page?' },
      ],
      currentDocument: {
        schema: 'stora.page',
        version: '1.0.0',
        metadata: { title: 'My Awesome Page' },
        document: {
          id: 'root',
          type: 'page',
          children: [
            { id: 'sec-1', type: 'section' },
            { id: 'sec-2', type: 'section' },
          ],
        },
      },
    });

    expect(result.success).toBe(true);
    expect(result.data?.message.role).toBe('assistant');
    expect(result.data?.message.content).toContain('AI Answer to: "What components are in this page?"');
  });

  it('processAiRequest handles mode: chat', async () => {
    const engine = new KubuildAiEngine({ adapter: mockAdapter });
    const { status, response } = await processAiRequest(engine, {
      mode: 'chat',
      messages: [{ role: 'user', content: 'Suggest a better CTA color' }],
    });

    expect(status).toBe(200);
    expect(response.success).toBe(true);
    expect((response.data as any)?.message.content).toBeDefined();
  });

  it('client.chat sends chat request and resolves response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          message: {
            role: 'assistant',
            content: 'Here are some design suggestions...',
            timestamp: 123456,
          },
        },
      }),
    });

    const client = new KubuildAiClient({
      endpoint: 'https://example.com/api/ai',
      fetch: mockFetch as unknown as typeof fetch,
    });

    const res = await client.chat({
      messages: [{ role: 'user', content: 'Review my layout' }],
    });

    expect(res.message.content).toBe('Here are some design suggestions...');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/ai',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          mode: 'chat',
          messages: [{ role: 'user', content: 'Review my layout' }],
        }),
      }),
    );
  });
});
