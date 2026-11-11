import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AnyEffectRuntime } from '@kubuild/core';
import { EFFECT_MANIFEST_VERSION, EFFECT_NODE_ATTRIBUTE } from '@kubuild/core/effect-manifest';
import { bootEffects, mountNodeEffects, createRuntimeMap, readEffectManifest, REDUCED_MOTION_QUERY } from '../src/index.js';

function fakeElement(nodeId: string | null, reducedMotion = false): HTMLElement {
  return {
    ownerDocument: { defaultView: { matchMedia: (q: string) => ({ matches: reducedMotion && q === REDUCED_MOTION_QUERY }) } },
    getAttribute: (name: string) => (name === EFFECT_NODE_ATTRIBUTE ? nodeId : null),
  } as unknown as HTMLElement;
}

function fakeDocument(manifestText: string | null, elements: HTMLElement[]): Document {
  return {
    getElementById: (id: string) => (id === 'kb-effects' && manifestText !== null ? { textContent: manifestText } : null),
    querySelectorAll: (selector: string) => (selector === `[${EFFECT_NODE_ATTRIBUTE}]` ? elements : []),
  } as unknown as Document;
}

function recordingRuntime(id: string, log: string[], extra: Partial<AnyEffectRuntime> = {}): AnyEffectRuntime {
  return {
    id,
    mount: (_el, config, context) => {
      log.push(`mount ${id} ${context.nodeId} ${JSON.stringify(config)}`);
      return () => log.push(`unmount ${id} ${context.nodeId}`);
    },
    ...extra,
  };
}

const manifest = (nodes: Record<string, unknown>) => JSON.stringify({ version: EFFECT_MANIFEST_VERSION, nodes });

describe('bootEffects', () => {
  it('mounts each manifest entry on its element and unmounts in reverse', () => {
    const log: string[] = [];
    const doc = fakeDocument(
      manifest({
        hero: [{ plugin: 'a', config: { speed: 1 } }, { plugin: 'b', config: {} }],
        card: [{ plugin: 'a', config: {} }],
      }),
      [fakeElement('hero'), fakeElement('card'), fakeElement('other')],
    );
    const destroy = bootEffects({ document: doc, runtimes: [recordingRuntime('a', log), recordingRuntime('b', log)] });
    expect(log).toEqual(['mount a hero {"speed":1}', 'mount b hero {}', 'mount a card {}']);

    log.length = 0;
    destroy();
    expect(log).toEqual(['unmount a card', 'unmount b hero', 'unmount a hero']);
  });

  it('skips plugins the bundle does not ship and tolerates a missing or broken manifest', () => {
    const log: string[] = [];
    const runtimes = [recordingRuntime('a', log)];
    bootEffects({ document: fakeDocument(manifest({ x: [{ plugin: 'unknown', config: {} }] }), [fakeElement('x')]), runtimes });
    bootEffects({ document: fakeDocument(null, [fakeElement('x')]), runtimes });
    bootEffects({ document: fakeDocument('{not json', [fakeElement('x')]), runtimes });
    bootEffects({ document: fakeDocument('{"version":2,"nodes":{}}', [fakeElement('x')]), runtimes });
    expect(log).toEqual([]);
  });

  it('does not treat inherited keys as node ids', () => {
    const log: string[] = [];
    bootEffects({
      document: fakeDocument(manifest({}), [fakeElement('constructor'), fakeElement('toString')]),
      runtimes: [recordingRuntime('a', log)],
    });
    expect(log).toEqual([]);
  });

  it('reads the manifest from the page', () => {
    expect(readEffectManifest(fakeDocument(manifest({ n: [{ plugin: 'a', config: {} }] }), []))?.nodes.n).toEqual([
      { plugin: 'a', config: {} },
    ]);
  });
});

describe('mountNodeEffects', () => {
  it('honours prefers-reduced-motion per runtime', () => {
    const log: string[] = [];
    const runtimes = createRuntimeMap([
      recordingRuntime('moves', log),
      recordingRuntime('safe', log, { reducedMotion: 'mount' }),
    ]);
    mountNodeEffects(fakeElement('n', true), [{ plugin: 'moves', config: {} }, { plugin: 'safe', config: {} }], runtimes, {
      nodeId: 'n',
    });
    expect(log).toEqual(['mount safe n {}']);
  });

  it('isolates a throwing runtime and reports it', () => {
    const log: string[] = [];
    const onError = vi.fn();
    const boom: AnyEffectRuntime = { id: 'boom', mount: () => { throw new Error('x'); } };
    const cleanup = mountNodeEffects(
      fakeElement('n'),
      [{ plugin: 'boom', config: {} }, { plugin: 'ok', config: {} }],
      createRuntimeMap([boom, recordingRuntime('ok', log)]),
      { nodeId: 'n', onError },
    );
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'boom');
    cleanup();
    expect(log).toEqual(['mount ok n {}', 'unmount ok n']);
  });
});

describe('kubuild-runtime.js bundle', () => {
  // `test` runs after `build` (turbo.json), so dist is present.
  const bundle = readFileSync(fileURLToPath(new URL('../dist/kubuild-runtime.js', import.meta.url)), 'utf8');

  it('stays small: no engine, schema or zod pulled in', () => {
    // ~20 KiB of this is Motion's value-animation engine (plugin-animation); the rest is
    // the effect runtimes. Raise deliberately, not to make room for a stray import.
    expect(bundle.length).toBeLessThan(40 * 1024);
    expect(bundle).not.toMatch(/ZodError|\$ZodType/);
  });

  it('ships the first-party parallax runtimes', () => {
    for (const id of ['parallax-scroll', 'parallax-background', 'scroll-transform', 'pointer-parallax']) {
      expect(bundle).toContain(`"${id}"`);
    }
  });

  it('ships the first-party animation runtimes', () => {
    for (const id of [
      'animate-entrance',
      'animate-loop',
      'animate-hover',
      'animate-timeline',
      'animate-text',
      'animate-counter',
      'animate-draw',
      'scroll-pin',
    ]) {
      expect(bundle).toContain(`"${id}"`);
    }
  });

  it('is exposed as a string module for exporters', async () => {
    const source = await import('../dist/source.js');
    expect(source.KUBUILD_RUNTIME_SOURCE).toBe(bundle);
    expect(source.KUBUILD_RUNTIME_FILENAME).toBe('kubuild-runtime.js');
  });
});
