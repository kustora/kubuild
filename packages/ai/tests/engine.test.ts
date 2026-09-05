import { describe, it, expect, vi } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import type { AiProviderAdapter } from '../src/types';

describe('KubuildAiEngine', () => {
  it('generates a full page document using mock adapter', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          schema: 'stora.page',
          version: '1.0.0',
          metadata: { title: 'Coffee Shop' },
          document: {
            id: 'page_root',
            type: 'page',
            styles: { base: { backgroundColor: '#f0f0f0' } },
            children: [
              {
                id: 'sec_hero',
                type: 'section',
                children: [
                  { id: 'btn_order', type: 'button', props: { label: 'Order Now' } },
                ],
              },
            ],
          },
        }),
        usage: { promptTokens: 50, completionTokens: 100 },
      }),
    };

    const engine = new KubuildAiEngine({
      adapter: mockAdapter,
    });

    const res = await engine.generatePage({
      prompt: 'Create a modern coffee shop landing page',
      stylePreference: 'warm cozy minimal',
    });

    expect(res.success).toBe(true);
    expect(res.data?.metadata?.title).toBe('Coffee Shop');
    expect(res.data?.document.children?.[0].id).toBe('sec_hero');
    expect(res.usage?.promptTokens).toBe(50);
  });

  it('generates a section node using mock adapter', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          id: 'pricing-section',
          type: 'section',
          styles: { base: { paddingTop: '40px' } },
          children: [
            { id: 'pricing-col', type: 'columns' },
          ],
        }),
      }),
    };

    const engine = new KubuildAiEngine({
      adapter: mockAdapter,
    });

    const res = await engine.generateSection({
      prompt: 'Add 3-tier pricing section',
    });

    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('section');
    expect(res.data?.id).toBe('pricing-section');
  });

  it('refactors a node using mock adapter', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          id: 'btn-1',
          type: 'button',
          props: { label: 'Explore Our Menu', variant: 'primary' },
          styles: { base: { backgroundColor: '#d97706' } },
        }),
      }),
    };

    const engine = new KubuildAiEngine({
      adapter: mockAdapter,
    });

    const originalNode = {
      id: 'btn-1',
      type: 'button',
      props: { label: 'Click Me' },
    };

    const res = await engine.refactorNode({
      node: originalNode,
      instruction: 'Make it amber colored with action label Explore Our Menu',
    });

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe('btn-1');
    expect(res.data?.props?.label).toBe('Explore Our Menu');
  });

  // STORA-521 — the security check (depth/node-count limits shared with `.stora` import,
  // via `@kubuild/core`'s `validateDocumentSecurity`) must already be applied *inside*
  // `KubuildAiEngine` itself — this is the exact code path a raw `createAiHandler`
  // consumer hits, with no editor in between. A malicious/deliberately-huge LLM response
  // must come back as a clean `{ success: false }` diagnostic, never `success: true` with
  // an oversized document, and never an unhandled throw/hang.
  it('generatePage rejects a deliberately deep AI-generated tree with a clean diagnostic instead of returning it', async () => {
    function buildDeepTree(depth: number): Record<string, unknown> {
      let node: Record<string, unknown> = { id: 'leaf', type: 'text', props: { text: 'x' } };
      for (let i = 0; i < depth; i++) {
        node = { id: `wrap-${i}`, type: 'container', children: [node] };
      }
      return node;
    }

    const maliciousAdapter: AiProviderAdapter = {
      name: 'malicious-mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          schema: 'stora.page',
          version: '1.0.0',
          metadata: { title: 'Deep Attack Page' },
          document: {
            id: 'root_page',
            type: 'page',
            children: [buildDeepTree(80)],
          },
        }),
      }),
    };

    const engine = new KubuildAiEngine({ adapter: maliciousAdapter });
    const res = await engine.generatePage({ prompt: 'Generate a page' });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('GENERATION_ERROR');
    // `generatePage` -> `normalizeAndValidatePageDocument` -> `@kubuild/core`'s full
    // `validateDocument` re-labels the violation `SECURITY_LIMIT_EXCEEDED` (vs. the raw
    // `MAX_TREE_DEPTH_EXCEEDED` `validateDocumentSecurity` code), but it's the same
    // underlying depth check and the message still names the violation clearly.
    expect(res.error?.message).toMatch(/SECURITY_LIMIT_EXCEEDED.*nesting depth/);
  });

  it('generateSection (and therefore streamPage, which calls it per-section) rejects a deliberately wide AI-generated section', async () => {
    const wideChildren = Array.from({ length: 1500 }, (_, i) => ({
      id: `child-${i}`,
      type: 'text',
      props: { text: `item ${i}` },
    }));

    const maliciousAdapter: AiProviderAdapter = {
      name: 'malicious-mock',
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          id: 'wide-section',
          type: 'section',
          children: wideChildren,
        }),
      }),
    };

    const engine = new KubuildAiEngine({ adapter: maliciousAdapter });
    const res = await engine.generateSection({ prompt: 'Generate a section' });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('SECTION_GENERATION_ERROR');
    expect(res.error?.message).toMatch(/MAX_CHILDREN_COUNT_EXCEEDED|MAX_NODE_COUNT_EXCEEDED/);
  });

  it('handles adapter failure gracefully', async () => {
    const mockAdapter: AiProviderAdapter = {
      name: 'failing-adapter',
      generate: vi.fn().mockRejectedValue(new Error('Rate limit exceeded (429)')),
    };

    const engine = new KubuildAiEngine({
      adapter: mockAdapter,
    });

    const res = await engine.generatePage({ prompt: 'test' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('GENERATION_ERROR');
    expect(res.error?.message).toContain('Rate limit exceeded');
  });
});
