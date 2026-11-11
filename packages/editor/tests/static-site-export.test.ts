import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createBlankDocument, createEffectRegistry, defineEffectPlugin } from '@kubuild/core';
import { KUBUILD_RUNTIME_SOURCE } from '@kubuild/runtime-dom/source';
import { buildStaticSiteArchive } from '../src/utils/export-utils';

const drift = defineEffectPlugin<{ speed: number }>({
  id: 'parallax-scroll',
  label: 'Drift',
  description: 'Test effect',
  defaults: { speed: 0.3 },
  configJsonSchema: { type: 'object' },
  fields: [],
  parse: () => ({ success: true, config: { speed: 0.3 } }),
  mount: () => {},
});

function doc(withEffect: boolean) {
  const d = createBlankDocument('My Page');
  d.document.children = [
    {
      id: 'hero',
      type: 'section',
      props: {},
      styles: {},
      effects: withEffect ? [{ plugin: 'parallax-scroll', enabled: true, config: {} }] : undefined,
      children: [],
    },
  ];
  return d;
}

describe('buildStaticSiteArchive', () => {
  it('ships index.html plus the runtime when the page has effects', () => {
    const result = buildStaticSiteArchive(doc(true), { effectRegistry: createEffectRegistry([drift]) });
    expect(result.files).toEqual(['index.html', 'kubuild-runtime.js']);

    const files = unzipSync(result.archive);
    const html = strFromU8(files['index.html']);
    expect(html).toContain('<script src="kubuild-runtime.js" defer></script>');
    expect(html).toContain('data-kb-node="hero"');
    expect(strFromU8(files['kubuild-runtime.js'])).toBe(KUBUILD_RUNTIME_SOURCE);
  });

  it('is plain HTML + CSS when there is nothing to run or no registry', () => {
    const registry = createEffectRegistry([drift]);
    expect(buildStaticSiteArchive(doc(false), { effectRegistry: registry }).files).toEqual(['index.html']);
    const noRegistry = buildStaticSiteArchive(doc(true));
    expect(noRegistry.files).toEqual(['index.html']);
    expect(strFromU8(unzipSync(noRegistry.archive)['index.html'])).not.toContain('<script');
  });

  it('reports effects it could not ship', () => {
    const d = doc(true);
    d.document.children![0].effects = [{ plugin: 'unknown-fx', enabled: true, config: {} }];
    const result = buildStaticSiteArchive(d, { effectRegistry: createEffectRegistry([drift]) });
    expect(result.skippedEffects).toEqual([{ nodeId: 'hero', plugin: 'unknown-fx', reason: 'unknown-plugin' }]);
    expect(result.files).toEqual(['index.html']);
  });
});
