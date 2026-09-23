import { describe, it, expect, vi } from 'vitest';
import { KubuildAiEngine } from '../src/server/engine';
import { KubuildAiAgent } from '../src/server/agent';
import { createAiHandler, resolveClientInstructions } from '../src/server/handler';
import type { AiProviderAdapter, AiProviderGenerateParams, PagePlan } from '../src/types';
import type { PageDocument } from '@kubuild/schema';

function sectionJson(id: string) {
  return JSON.stringify({ id, type: 'section', children: [] });
}

function recordingAdapter(respond: (params: AiProviderGenerateParams, index: number) => string) {
  const calls: AiProviderGenerateParams[] = [];
  const adapter: AiProviderAdapter = {
    name: 'recording',
    generate: vi.fn(async (params: AiProviderGenerateParams) => {
      calls.push(params);
      return { text: respond(params, calls.length - 1) };
    }),
  };
  return { adapter, calls };
}

function post(body: unknown) {
  return new Request('http://localhost/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('generatePage honours plan and sectionCount like streamPage', () => {
  it('generates each section of an approved plan instead of a single-shot page', async () => {
    const { adapter, calls } = recordingAdapter((_p, i) => sectionJson(`sec-${i}`));
    const engine = new KubuildAiEngine({ adapter });
    const plan: PagePlan = {
      title: 'Bakery',
      sections: [
        { type: 'hero', title: 'Hero', prompt: 'hero' },
        { type: 'cta', title: 'CTA', prompt: 'cta' },
      ],
    };

    const res = await engine.generatePage({ prompt: 'bakery', plan });

    expect(res.success).toBe(true);
    // One generate() per planned section, no re-planning call.
    expect(calls).toHaveLength(2);
    expect(res.data?.metadata.title).toBe('Bakery');
    expect(res.data?.document.children?.map((c) => c.id)).toEqual(['sec-0', 'sec-1']);
  });

  it('passes sectionCount into the single-shot prompt with the same phrasing as the planner', async () => {
    const { adapter, calls } = recordingAdapter(() =>
      JSON.stringify({
        schema: 'stora.page',
        version: '1.0.0',
        metadata: { title: 'T' },
        document: { id: 'root', type: 'page', children: [] },
      }),
    );
    const engine = new KubuildAiEngine({ adapter });
    await engine.generatePage({ prompt: 'x', sectionCount: 3 });
    expect(calls[0].userPrompt).toContain('exactly 3 cohesive sections');

    await engine.planPage({ prompt: 'x', sectionCount: 3 });
    expect(calls[1].systemPrompt).toContain('exactly 3 cohesive sections');
  });
});

describe('planPage fallback marking', () => {
  it('marks an unparseable plan with usedFallback and a PLAN_FALLBACK warning', async () => {
    const { adapter } = recordingAdapter(() => 'not json at all');
    const engine = new KubuildAiEngine({ adapter });
    const res = await engine.planPage({ prompt: 'shop' });

    expect(res.success).toBe(true);
    expect(res.usedFallback).toBe(true);
    expect(res.data?.usedFallback).toBe(true);
    expect(res.warnings?.[0].code).toBe('PLAN_FALLBACK');
    expect(res.data?.sections?.length).toBeGreaterThan(0);
  });

  it('does not mark a parsed plan', async () => {
    const { adapter } = recordingAdapter(() =>
      JSON.stringify({ title: 'A', sections: [{ type: 'hero', title: 'H', prompt: 'p' }] }),
    );
    const res = await new KubuildAiEngine({ adapter }).planPage({ prompt: 'shop' });
    expect(res.usedFallback).toBeUndefined();
    expect(res.data?.usedFallback).toBeUndefined();
  });

  it('reports a provider failure as an error instead of a fallback plan', async () => {
    const adapter: AiProviderAdapter = {
      name: 'failing',
      generate: vi.fn().mockRejectedValue(new Error('401 Unauthorized')),
    };
    const res = await new KubuildAiEngine({ adapter }).planPage({ prompt: 'shop' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PLAN_ERROR');
  });
});

describe('createAiHandler streaming routing', () => {
  it.each([
    ['plan', { prompt: 'shop' }, () => JSON.stringify({ sections: [{ type: 'hero', title: 'H', prompt: 'p' }] })],
    ['section', { prompt: 'faq' }, () => sectionJson('faq')],
    [
      'refactor',
      { node: { id: 'b', type: 'button', props: {} }, instruction: 'red' },
      () => JSON.stringify({ id: 'b', type: 'button', props: { label: 'x' } }),
    ],
  ] as const)('answers mode %s with stream:true as JSON, not a full-page stream', async (mode, extra, respond) => {
    const { adapter, calls } = recordingAdapter(respond);
    const handler = createAiHandler(new KubuildAiEngine({ adapter }));
    const res = await handler(post({ mode, stream: true, ...extra }));

    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(calls).toHaveLength(1);
  });
});

describe('client instructions', () => {
  const chatBody = {
    mode: 'chat',
    messages: [{ role: 'user', content: 'hi' }],
    instructions: 'Always answer as the ACME brand assistant.',
  };

  it('appends instructions after the built-in chat prompt (never replacing it)', async () => {
    const { adapter, calls } = recordingAdapter(() => 'hello');
    const handler = createAiHandler(new KubuildAiEngine({ adapter }));
    await handler(post(chatBody));

    const prompt = calls[0].systemPrompt;
    expect(prompt.startsWith('You are the KUBUILD AI Assistant')).toBe(true);
    expect(prompt.indexOf('ACME brand')).toBeGreaterThan(prompt.indexOf('Available KUBUILD Components'));
  });

  it('accepts the deprecated systemPrompt alias over the SSE chat path', async () => {
    const { adapter, calls } = recordingAdapter(() => 'hello');
    const handler = createAiHandler(new KubuildAiEngine({ adapter }));
    const res = await handler(
      post({ mode: 'chat', stream: true, messages: chatBody.messages, systemPrompt: 'Use British spelling.' }),
    );
    await res.text();
    expect(calls[0].systemPrompt).toContain('Use British spelling.');
  });

  it('drops instructions when allowClientInstructions is false', async () => {
    const { adapter, calls } = recordingAdapter(() => 'hello');
    const handler = createAiHandler(new KubuildAiEngine({ adapter }), { allowClientInstructions: false });
    await handler(post(chatBody));
    expect(calls[0].systemPrompt).not.toContain('ACME brand');
  });

  it('caps instruction length', () => {
    expect(resolveClientInstructions({ instructions: 'a'.repeat(5000) })).toHaveLength(4000);
    expect(
      resolveClientInstructions({ instructions: 'abcdef' }, { maxClientInstructionsLength: 3 }),
    ).toBe('abc');
    expect(resolveClientInstructions({ instructions: '   ' })).toBeUndefined();
  });

  it('forwards instructions to plan and page generation prompts', async () => {
    const { adapter, calls } = recordingAdapter(() =>
      JSON.stringify({ sections: [{ type: 'hero', title: 'H', prompt: 'p' }] }),
    );
    const handler = createAiHandler(new KubuildAiEngine({ adapter }));
    await handler(post({ mode: 'plan', prompt: 'shop', instructions: 'Keep it minimal.' }));
    expect(calls[0].systemPrompt).toContain('Keep it minimal.');
  });
});

describe('agent summaries are English', () => {
  it('max-steps summary', async () => {
    const adapter: AiProviderAdapter = {
      name: 'loop',
      supportsTools: true,
      generate: vi.fn().mockResolvedValue({
        text: '',
        toolCalls: [{ type: 'tool_use', id: 't1', name: 'get_page_outline', input: {} }],
      }),
    };
    const agent = new KubuildAiAgent({ adapter });
    const doc = {
      schema: 'stora.page',
      version: '1.0.0',
      metadata: { title: 'x', description: '', tags: [], category: 'landing', version: '1.0.0' },
      document: { id: 'root', type: 'page', children: [] },
    } as PageDocument;
    const result = await agent.execute({
      messages: [{ role: 'user', content: 'go' }],
      document: doc,
      maxSteps: 1,
    });
    expect(result.stoppedBy).toBe('max-steps');
    expect(result.summary).toMatch(/^Stopped after 1 steps/);
  });
});
