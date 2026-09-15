import { describe, it, expect, vi } from 'vitest';
import type { PageDocument } from '@kubuild/schema';
import { KubuildAiAgent } from '../src/server/agent';
import type {
  AiProviderAdapter,
  AiProviderGenerateParams,
  AiProviderGenerateResult,
  AiStreamEvent,
} from '../src/types';

const REGISTRY = {
  list: () => [
    { type: 'page', label: 'Page', category: 'layout', acceptsChildren: true },
    { type: 'section', label: 'Section', category: 'layout', acceptsChildren: true },
    { type: 'container', label: 'Container', category: 'layout', acceptsChildren: true },
    { type: 'heading', label: 'Heading', category: 'content', acceptsChildren: false },
    { type: 'button', label: 'Button', category: 'content', acceptsChildren: false },
  ],
};

function makeDocument(): PageDocument {
  return {
    schema: 'stora.page',
    version: '1.0.0',
    metadata: { title: 'Landing', description: '', tags: [], category: 'landing', version: '1.0.0' },
    document: {
      id: 'root-page',
      type: 'page',
      children: [
        {
          id: 'hero',
          type: 'section',
          children: [
            {
              id: 'cta-btn',
              type: 'button',
              props: { label: 'Coba Gratis' },
              styles: { base: { backgroundColor: '#3b82f6' } },
            },
          ],
        },
      ],
    },
  } as PageDocument;
}

/**
 * Adapter driven by a scripted list of turns — each entry is what the "model" returns for
 * the next `generate()` call, so a whole multi-step run is deterministic.
 */
function scriptedAdapter(turns: Array<Partial<AiProviderGenerateResult>>): AiProviderAdapter & {
  calls: AiProviderGenerateParams[];
} {
  const calls: AiProviderGenerateParams[] = [];
  let index = 0;
  return {
    name: 'scripted',
    supportsTools: true,
    calls,
    async generate(params) {
      // Snapshot `messages`: the agent keeps pushing onto the same array across steps, so
      // storing the live reference would make every recorded call look identical.
      calls.push({
        ...params,
        messages: params.messages ? JSON.parse(JSON.stringify(params.messages)) : undefined,
      });
      const turn = turns[Math.min(index, turns.length - 1)];
      index++;
      return { text: '', stopReason: 'stop', ...turn } as AiProviderGenerateResult;
    },
  };
}

async function drain(events: AsyncIterable<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const collected: AiStreamEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('KubuildAiAgent (STORA-530)', () => {
  it('refuses an adapter without tool calling instead of running a loop that can never edit', () => {
    const adapter: AiProviderAdapter = { name: 'legacy', generate: vi.fn() };
    expect(() => new KubuildAiAgent({ adapter })).toThrow(/does not support tool calling/);
  });

  it('runs a tool call and returns it as a surgical op, not a document', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'update_node_props',
            input: { nodeId: 'cta-btn', props: { label: 'Mulai Gratis' } },
          },
        ],
      },
      { text: 'Label tombol sudah diganti.', stopReason: 'stop' },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const events = await drain(
      agent.run({
        messages: [{ role: 'user', content: 'ganti label tombol jadi Mulai Gratis' }],
        document: makeDocument(),
        selectedNodeId: 'cta-btn',
      }),
    );

    expect(events.map((e) => e.type)).toEqual([
      'agent-step',
      'tool-call',
      'tool-result',
      'agent-step',
      'agent-complete',
    ]);

    const complete = events.at(-1) as Extract<AiStreamEvent, { type: 'agent-complete' }>;
    expect(complete.result.stoppedBy).toBe('complete');
    expect(complete.result.summary).toBe('Label tombol sudah diganti.');
    expect(complete.result.ops).toHaveLength(1);
    expect(complete.result.ops[0]).toMatchObject({
      destructive: false,
      op: { kind: 'update-props', nodeId: 'cta-btn', props: { label: 'Mulai Gratis' } },
    });
  });

  it('grounds the system prompt in the outline and the selected node', async () => {
    const adapter = scriptedAdapter([{ text: 'ok', stopReason: 'stop' }]);
    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });

    await drain(
      agent.run({
        messages: [{ role: 'user', content: 'apa isi halaman ini?' }],
        document: makeDocument(),
        selectedNodeId: 'cta-btn',
      }),
    );

    const systemPrompt = adapter.calls[0].systemPrompt;
    expect(systemPrompt).toContain('#cta-btn (button) "Coba Gratis" ← SELECTED');
    expect(systemPrompt).toContain('Currently Selected Component');
    expect(adapter.calls[0].tools?.map((t) => t.name)).toContain('update_node_props');
  });

  it('feeds a failed tool call back as a tool_result so the model can self-correct', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [
          {
            type: 'tool_use',
            id: 'call_1',
            name: 'update_node_props',
            input: { nodeId: 'cta-button', props: { label: 'X' } },
          },
        ],
      },
      {
        stopReason: 'tool_calls',
        toolCalls: [
          {
            type: 'tool_use',
            id: 'call_2',
            name: 'update_node_props',
            input: { nodeId: 'cta-btn', props: { label: 'X' } },
          },
        ],
      },
      { text: 'Selesai.', stopReason: 'stop' },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const events = await drain(
      agent.run({
        messages: [{ role: 'user', content: 'ubah tombol' }],
        document: makeDocument(),
      }),
    );

    const toolResults = events.filter((e) => e.type === 'tool-result') as Array<
      Extract<AiStreamEvent, { type: 'tool-result' }>
    >;
    expect(toolResults.map((r) => r.ok)).toEqual([false, true]);

    // The retry turn must actually see the error payload, not just a generic failure.
    const retryMessages = adapter.calls[1].messages!;
    const resultBlock = (retryMessages.at(-1)!.content as Array<Record<string, any>>)[0];
    expect(resultBlock.type).toBe('tool_result');
    expect(resultBlock.isError).toBe(true);
    expect(resultBlock.content).toContain('cta-btn');

    // Only the successful call produced an op.
    const complete = events.at(-1) as Extract<AiStreamEvent, { type: 'agent-complete' }>;
    expect(complete.result.ops).toHaveLength(1);
  });

  it('answers an unknown tool name without killing the run', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [{ type: 'tool_use', id: 'c1', name: 'rewrite_everything', input: {} }],
      },
      { text: 'Maaf, saya pakai tool yang salah.', stopReason: 'stop' },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const events = await drain(
      agent.run({ messages: [{ role: 'user', content: 'x' }], document: makeDocument() }),
    );

    const complete = events.at(-1) as Extract<AiStreamEvent, { type: 'agent-complete' }>;
    expect(complete.result.stoppedBy).toBe('complete');
    expect(complete.result.ops).toHaveLength(0);
  });

  it('stops at maxSteps and reports it rather than looping forever', async () => {
    // A model that always asks for another tool call — the cost guard has to be what stops it.
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [{ type: 'tool_use', id: 'c', name: 'get_page_outline', input: {} }],
      },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY, maxAgentSteps: 3 });
    const events = await drain(
      agent.run({ messages: [{ role: 'user', content: 'terus' }], document: makeDocument() }),
    );

    const complete = events.at(-1) as Extract<AiStreamEvent, { type: 'agent-complete' }>;
    expect(complete.result.stoppedBy).toBe('max-steps');
    expect(complete.result.stepsUsed).toBe(3);
  });

  it('marks destructive ops so the editor can withhold auto-apply', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [
          {
            type: 'tool_use',
            id: 'c1',
            name: 'delete_node',
            input: { nodeId: 'hero', reason: 'user minta hapus hero' },
          },
        ],
      },
      { text: 'Hero dihapus.', stopReason: 'stop' },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const result = await agent.execute({
      messages: [{ role: 'user', content: 'hapus section hero' }],
      document: makeDocument(),
    });

    expect(result.ops[0].destructive).toBe(true);
    expect(result.ops[0].op).toEqual({ kind: 'delete-node', nodeId: 'hero' });
  });

  it('accumulates token usage across every step', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [{ type: 'tool_use', id: 'c', name: 'get_page_outline', input: {} }],
        usage: { promptTokens: 100, completionTokens: 20 },
      },
      { text: 'done', stopReason: 'stop', usage: { promptTokens: 150, completionTokens: 30 } },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const result = await agent.execute({
      messages: [{ role: 'user', content: 'lihat halaman' }],
      document: makeDocument(),
    });

    expect(result.usage).toEqual({ promptTokens: 250, completionTokens: 50 });
  });

  it('keeps ops produced before a mid-run provider failure', async () => {
    let call = 0;
    const adapter: AiProviderAdapter = {
      name: 'flaky',
      supportsTools: true,
      async generate() {
        call++;
        if (call === 1) {
          return {
            text: '',
            stopReason: 'tool_calls',
            toolCalls: [
              {
                type: 'tool_use',
                id: 'c1',
                name: 'update_node_props',
                input: { nodeId: 'cta-btn', props: { label: 'Baru' } },
              },
            ],
          };
        }
        throw new Error('provider exploded');
      },
    };

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const result = await agent.execute({
      messages: [{ role: 'user', content: 'ubah label' }],
      document: makeDocument(),
    });

    expect(result.stoppedBy).toBe('error');
    expect(result.ops).toHaveLength(1);
  });

  it('never mutates the caller document', async () => {
    const adapter = scriptedAdapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [
          {
            type: 'tool_use',
            id: 'c1',
            name: 'delete_node',
            input: { nodeId: 'hero', reason: 'user minta' },
          },
        ],
      },
      { text: 'ok', stopReason: 'stop' },
    ]);

    const agent = new KubuildAiAgent({ adapter, registry: REGISTRY });
    const document = makeDocument();
    await agent.execute({ messages: [{ role: 'user', content: 'hapus hero' }], document });

    expect(document.document.children).toHaveLength(1);
    expect(document.document.children![0].id).toBe('hero');
  });
});
