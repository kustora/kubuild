import { describe, it, expect } from 'vitest';
import { NodeEffectSchema, NodeSchema, MAX_NODE_EFFECTS } from '../src/document.js';

describe('NodeEffectSchema (STORA-650)', () => {
  it('fills defaults for enabled and config', () => {
    expect(NodeEffectSchema.parse({ plugin: 'parallax-scroll' })).toEqual({
      plugin: 'parallax-scroll',
      enabled: true,
      config: {},
    });
  });

  it('rejects malformed plugin ids', () => {
    expect(NodeEffectSchema.safeParse({ plugin: 'Parallax' }).success).toBe(false);
    expect(NodeEffectSchema.safeParse({ plugin: 'para--llax' }).success).toBe(false);
    expect(NodeEffectSchema.safeParse({ plugin: '' }).success).toBe(false);
  });

  it('rejects unsafe string values anywhere in config', () => {
    expect(
      NodeEffectSchema.safeParse({ plugin: 'x', config: { image: 'javascript:alert(1)' } }).success,
    ).toBe(false);
    expect(
      NodeEffectSchema.safeParse({ plugin: 'x', config: { nested: { css: '@import url(x)' } } }).success,
    ).toBe(false);
  });

  it('keeps effects on a parsed node and caps their count', () => {
    const node = NodeSchema.parse({
      id: 'hero',
      type: 'section',
      effects: [{ plugin: 'parallax-scroll', config: { speed: 0.3 } }],
    });
    expect(node.effects).toEqual([{ plugin: 'parallax-scroll', enabled: true, config: { speed: 0.3 } }]);

    const tooMany = Array.from({ length: MAX_NODE_EFFECTS + 1 }, () => ({ plugin: 'x' }));
    expect(NodeSchema.safeParse({ id: 'a', type: 'box', effects: tooMany }).success).toBe(false);
  });
});
