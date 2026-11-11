import { describe, it, expect } from 'vitest';
import type { PageDocument } from '@kubuild/schema';
import { createEffectRegistry } from '@kubuild/core';
import { formatEffectCatalog } from '@kubuild/ai';
import { createEffectTools } from '@kubuild/ai/server';
import { animationPlugins } from '../src/index.js';

/**
 * The AI reaches these plugins only through the generic effect catalog and the
 * `set_node_effects` tool; these tests pin that every plugin is usable that way.
 */
const registry = createEffectRegistry([...animationPlugins]);
const [setNodeEffects] = createEffectTools(registry);

const document = {
  schema: 'stora.page',
  version: '1.4.0',
  metadata: { title: 'Landing', description: '', tags: [], category: 'landing', version: '1.0.0' },
  document: { id: 'root', type: 'page', children: [{ id: 'hero', type: 'section', children: [] }] },
} as unknown as PageDocument;

const run = (effects: unknown) =>
  setNodeEffects.execute({ nodeId: 'hero', effects }, { document, catalog: [] }) as Awaited<
    ReturnType<typeof setNodeEffects.execute>
  >;

describe('AI integration', () => {
  it('lists every plugin with its guidance, config schema and examples', () => {
    const catalog = formatEffectCatalog(registry);
    for (const plugin of animationPlugins) {
      expect(catalog).toContain(`- ${plugin.id} — ${plugin.label}`);
      expect(plugin.ai?.guidance).toBeTruthy();
      expect(plugin.ai?.examples?.length).toBeGreaterThan(0);
    }
    // The keyframe timeline's step shape is spelled out for the model.
    const timeline = animationPlugins.find((plugin) => plugin.id === 'animate-timeline')!;
    expect(timeline.configJsonSchema).toMatchObject({
      properties: {
        steps: {
          type: 'array',
          minItems: 2,
          items: { required: ['at'], properties: { ease: { enum: expect.any(Array) } } },
        },
      },
    });
  });

  it.each(
    animationPlugins.flatMap((plugin) =>
      (plugin.ai?.examples ?? []).map((ex) => [plugin.id, ex.when, ex.config] as const),
    ),
  )('accepts the %s example "%s" through set_node_effects', (plugin, _when, config) => {
    const result = run([{ plugin, config }]);
    expect(result.ok).toBe(true);
    expect(result.op).toMatchObject({
      kind: 'set-effects',
      nodeId: 'hero',
      effects: [{ plugin, config }],
    });
  });

  it('rejects a malformed timeline with an error the model can fix in one retry', () => {
    const result = run([
      { plugin: 'animate-timeline', config: { steps: [{ at: 0 }] } },
      { plugin: 'animate-text', config: { split: 'line' } },
    ]);
    expect(result.ok).toBe(false);
    const error = (result.content as { error: string }).error;
    expect(error).toMatch(/effects\[0\] \(animate-timeline\)\.config: steps/);
    expect(error).toMatch(/effects\[1\] \(animate-text\)\.config: split/);
  });

  it('builds a pinned scroll sequence one node at a time', () => {
    const pinned = run([{ plugin: 'scroll-pin', config: { length: 2 } }]);
    expect(pinned.ok).toBe(true);
    const child = setNodeEffects.execute(
      {
        nodeId: 'hero',
        effects: [
          { plugin: 'scroll-pin', config: { length: 2 } },
          {
            plugin: 'animate-timeline',
            config: {
              trigger: 'scroll',
              scrollSource: 'pinned-section',
              scrollStart: 0,
              scrollEnd: 0.3,
              steps: [{ at: 0, opacity: 0 }, { at: 1 }],
            },
          },
        ],
      },
      { document: pinned.document!, catalog: [] },
    ) as Awaited<ReturnType<typeof setNodeEffects.execute>>;
    expect(child.ok).toBe(true);
  });
});
