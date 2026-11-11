import { describe, it, expect } from 'vitest';
import { CURRENT_SCHEMA_VERSION, type PageDocument } from '@kubuild/schema';
import {
  updateEffects,
  findNodeById,
  migrateDocument,
  exportPackage,
  importPackage,
  createEffectRegistry,
  defineEffectPlugin,
  resolveNodeEffects,
  collectEffectNodes,
} from '../src';

function doc(): PageDocument {
  return {
    schema: 'stora.page',
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: 'Effects',
      description: '',
      author: '',
      tags: [],
      category: 'general',
      version: '1.0.0',
    },
    document: {
      id: 'root',
      type: 'page',
      props: {},
      styles: {},
      children: [{ id: 'hero', type: 'section', props: {}, styles: {}, children: [] }],
    },
  } as PageDocument;
}

const speedPlugin = defineEffectPlugin<{ speed: number }>({
  id: 'test-speed',
  label: 'Speed',
  description: 'Test plugin',
  defaults: { speed: 0.5 },
  configJsonSchema: { type: 'object', properties: { speed: { type: 'number' } } },
  fields: [{ key: 'speed', label: 'Speed', type: 'number', min: -1, max: 1 }],
  parse(config) {
    const speed = (config as { speed?: unknown }).speed ?? 0.5;
    if (typeof speed !== 'number' || speed < -1 || speed > 1) {
      return { success: false, error: 'speed must be a number between -1 and 1' };
    }
    return { success: true, config: { speed } };
  },
});

describe('updateEffects (STORA-650)', () => {
  it('replaces the effect list, filling schema defaults, without mutating the input', () => {
    const original = doc();
    const result = updateEffects(original, {
      nodeId: 'hero',
      effects: [{ plugin: 'test-speed', config: { speed: 0.2 } }],
    });
    expect(findNodeById(result.document.document, 'hero')?.effects).toEqual([
      { plugin: 'test-speed', enabled: true, config: { speed: 0.2 } },
    ]);
    expect(findNodeById(original.document, 'hero')?.effects).toBeUndefined();
    expect(result.event.type).toBe('EFFECTS_UPDATED');
  });

  it('removes the field for null or an empty list', () => {
    const withEffect = updateEffects(doc(), { nodeId: 'hero', effects: [{ plugin: 'a' }] }).document;
    expect(findNodeById(updateEffects(withEffect, { nodeId: 'hero', effects: null }).document.document, 'hero'))
      .not.toHaveProperty('effects');
    expect(findNodeById(updateEffects(withEffect, { nodeId: 'hero', effects: [] }).document.document, 'hero'))
      .not.toHaveProperty('effects');
  });

  it('throws on unknown nodes and invalid shapes', () => {
    expect(() => updateEffects(doc(), { nodeId: 'nope', effects: null })).toThrow(/not found/);
    expect(() => updateEffects(doc(), { nodeId: 'hero', effects: [{ plugin: 'Bad Id' }] })).toThrow();
  });
});

describe('EffectRegistry', () => {
  it('rejects duplicate and malformed ids', () => {
    const registry = createEffectRegistry([speedPlugin]);
    expect(() => registry.register(speedPlugin)).toThrow(/already registered/);
    expect(() => registry.register({ ...speedPlugin, id: 'Nope' })).toThrow(/Invalid effect plugin id/);
  });

  it('resolves stored effects against registered plugins', () => {
    const registry = createEffectRegistry([speedPlugin]);
    const node = {
      id: 'n',
      type: 'box',
      effects: [
        { plugin: 'test-speed', enabled: true, config: {} },
        { plugin: 'test-speed', enabled: false, config: {} },
        { plugin: 'missing', enabled: true, config: {} },
        { plugin: 'test-speed', enabled: true, config: { speed: 9 } },
      ],
    };
    expect(resolveNodeEffects(node, registry).map((r) => r.status)).toEqual([
      'ok',
      'disabled',
      'unknown-plugin',
      'invalid-config',
    ]);
    const first = resolveNodeEffects(node, registry)[0];
    expect(first.status === 'ok' && first.config).toEqual({ speed: 0.5 });
  });

  it('collects effect-carrying nodes in document order', () => {
    const d = updateEffects(doc(), { nodeId: 'hero', effects: [{ plugin: 'x' }] }).document;
    expect(collectEffectNodes(d.document).map((n) => n.id)).toEqual(['hero']);
  });
});

describe('1.3.0 -> 1.4.0 migration and .stora round trip', () => {
  it('bumps the version without touching content', () => {
    const legacy = { ...doc(), version: '1.3.0' };
    const result = migrateDocument(legacy);
    expect(result.success).toBe(true);
    expect(result.document?.version).toBe('1.4.0');
    expect(result.document?.document).toEqual(legacy.document);
  });

  it('keeps effects (including unknown plugins) through export and import', async () => {
    const d = updateEffects(doc(), {
      nodeId: 'hero',
      effects: [{ plugin: 'some-future-plugin', config: { depth: 3, axis: 'y' } }],
    }).document;
    const exported = await exportPackage(d);
    if (!exported.success) throw new Error(exported.diagnosticMessage);
    const imported = await importPackage(exported.archive);
    if (!imported.success) throw new Error(JSON.stringify(imported));
    expect(findNodeById(imported.document.document, 'hero')?.effects).toEqual([
      { plugin: 'some-future-plugin', enabled: true, config: { depth: 3, axis: 'y' } },
    ]);
  });
});
