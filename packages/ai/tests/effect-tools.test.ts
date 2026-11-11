import { describe, it, expect } from 'vitest';
import type { PageDocument } from '@kubuild/schema';
import { createEffectRegistry, defineEffectPlugin, findNodeById } from '@kubuild/core';
import { KubuildAiAgent } from '../src/server/agent';
import { createEffectTools } from '../src/server/tools';
import { buildAgentSystemPrompt } from '../src/core/prompt-compiler';
import type { AiProviderAdapter, AiProviderGenerateParams, AiProviderGenerateResult, AiStreamEvent } from '../src/types';

const drift = defineEffectPlugin<{ speed: number }>({
  id: 'drift',
  label: 'Drift',
  description: 'Moves the element against the scroll.',
  defaults: { speed: 0.3 },
  configJsonSchema: { type: 'object', properties: { speed: { type: 'number', minimum: -1, maximum: 1 } } },
  fields: [],
  parse(config) {
    const speed = (config as { speed?: unknown }).speed ?? 0.3;
    return typeof speed === 'number' && speed >= -1 && speed <= 1
      ? { success: true, config: { speed } }
      : { success: false, error: 'speed: must be between -1 and 1' };
  },
  ai: { guidance: 'Use on decorative layers.', examples: [{ when: 'Hero blob', config: { speed: 0.2 } }] },
  mount: () => {},
});
const registry = createEffectRegistry([drift]);

function makeDocument(): PageDocument {
  return {
    schema: 'stora.page',
    version: '1.4.0',
    metadata: { title: 'Landing', description: '', tags: [], category: 'landing', version: '1.0.0' },
    document: {
      id: 'root-page',
      type: 'page',
      children: [{ id: 'hero', type: 'section', effects: [{ plugin: 'other', enabled: true, config: {} }], children: [] }],
    },
  } as PageDocument;
}

const [tool] = createEffectTools(registry);
const run = (input: Record<string, unknown>) =>
  tool.execute(input, { document: makeDocument(), catalog: [] }) as Awaited<ReturnType<typeof tool.execute>>;

describe('set_node_effects tool (STORA-651)', () => {
  it('advertises only the registered plugin ids', () => {
    const schema = tool.definition.inputSchema as {
      properties: { effects: { items: { properties: { plugin: { enum: string[] } } } } };
    };
    expect(tool.definition.name).toBe('set_node_effects');
    expect(schema.properties.effects.items.properties.plugin.enum).toEqual(['drift']);
  });

  it('replaces the effect list and returns a set-effects op plus the updated snapshot', () => {
    const result = run({ nodeId: 'hero', effects: [{ plugin: 'drift', config: { speed: 0.5 } }] });
    expect(result.ok).toBe(true);
    expect(result.op).toEqual({
      kind: 'set-effects',
      nodeId: 'hero',
      effects: [{ plugin: 'drift', enabled: true, config: { speed: 0.5 } }],
    });
    expect(findNodeById(result.document!.document, 'hero')?.effects).toEqual([
      { plugin: 'drift', enabled: true, config: { speed: 0.5 } },
    ]);
    expect(result.summary).toMatch(/Set effects on section .*: drift/);
  });

  it('removes all effects with an empty list', () => {
    const result = run({ nodeId: 'hero', effects: [] });
    expect(result.op).toEqual({ kind: 'set-effects', nodeId: 'hero', effects: [] });
    expect(findNodeById(result.document!.document, 'hero')?.effects).toBeUndefined();
  });

  it('reports every invalid entry at once so one retry can fix them', () => {
    const result = run({
      nodeId: 'hero',
      effects: [{ plugin: 'nope' }, { plugin: 'drift', config: { speed: 4 } }, { plugin: 'drift', enabled: 'yes' }, 'x'],
    });
    expect(result.ok).toBe(false);
    const error = (result.content as { error: string }).error;
    expect(error).toContain('effects[0]: unknown plugin "nope". Available: drift');
    expect(error).toContain('effects[1] (drift).config: speed: must be between -1 and 1');
    expect(error).toContain('effects[2].enabled: must be a boolean');
    expect(error).toContain('effects[3]: must be an object');
    expect(result.op).toBeUndefined();
  });

  it('rejects unknown nodes and non-array effects', () => {
    expect(run({ nodeId: 'ghost', effects: [] }).ok).toBe(false);
    expect(run({ nodeId: 'hero', effects: { plugin: 'drift' } }).ok).toBe(false);
  });
});

describe('effects in the agent', () => {
  function adapter(turns: Array<Partial<AiProviderGenerateResult>>) {
    const calls: AiProviderGenerateParams[] = [];
    let i = 0;
    const a: AiProviderAdapter = {
      name: 'scripted',
      supportsTools: true,
      async generate(params) {
        calls.push(params);
        return { text: '', stopReason: 'stop', ...turns[Math.min(i++, turns.length - 1)] } as AiProviderGenerateResult;
      },
    };
    return { adapter: a, calls };
  }

  async function drain(events: AsyncIterable<AiStreamEvent>) {
    const out: AiStreamEvent[] = [];
    for await (const event of events) out.push(event);
    return out;
  }

  it('offers set_node_effects and the effect catalog only when the host passes effect plugins', async () => {
    const without = adapter([{ text: 'ok' }]);
    await drain(new KubuildAiAgent({ adapter: without.adapter }).run({ messages: [{ role: 'user', content: 'x' }], document: makeDocument() }));
    expect(without.calls[0].tools?.map((t) => t.name)).not.toContain('set_node_effects');
    expect(without.calls[0].systemPrompt).not.toContain('EFFECT PLUGINS');

    const withEffects = adapter([
      {
        stopReason: 'tool_calls',
        toolCalls: [{ type: 'tool_use', id: 'c1', name: 'set_node_effects', input: { nodeId: 'hero', effects: [{ plugin: 'drift' }] } }],
      },
      { text: 'Parallax added.' },
    ]);
    const events = await drain(
      new KubuildAiAgent({ adapter: withEffects.adapter, effects: registry }).run({
        messages: [{ role: 'user', content: 'add parallax to the hero' }],
        document: makeDocument(),
      }),
    );
    expect(withEffects.calls[0].tools?.map((t) => t.name)).toContain('set_node_effects');
    expect(withEffects.calls[0].systemPrompt).toContain('### EFFECT PLUGINS');
    const complete = events.at(-1) as Extract<AiStreamEvent, { type: 'agent-complete' }>;
    expect(complete.result.ops.map((r) => r.op)).toEqual([
      { kind: 'set-effects', nodeId: 'hero', effects: [{ plugin: 'drift', enabled: true, config: {} }] },
    ]);
  });

  it('describes each plugin in the system prompt from its own metadata', () => {
    const prompt = buildAgentSystemPrompt({ catalog: [], document: makeDocument(), effects: registry });
    expect(prompt).toContain('- drift — Drift: Moves the element against the scroll.');
    expect(prompt).toContain('When: Use on decorative layers.');
    expect(prompt).toContain('Config: {"type":"object","properties":{"speed":');
    expect(prompt).toContain('Example (Hero blob): {"speed":0.2}');
  });
});
