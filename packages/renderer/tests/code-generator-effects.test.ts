import { describe, it, expect, vi } from 'vitest';
import { createBlankDocument, createEffectRegistry, defineEffectPlugin, parseEffectManifest } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { generateStandaloneHtml } from '../src/code-generator';

const drift = defineEffectPlugin<{ speed: number }>({
  id: 'drift',
  label: 'Drift',
  description: 'Test effect',
  defaults: { speed: 0.3 },
  configJsonSchema: { type: 'object' },
  fields: [],
  parse(config) {
    const speed = (config as { speed?: unknown }).speed ?? 0.3;
    return typeof speed === 'number' ? { success: true, config: { speed } } : { success: false, error: 'speed' };
  },
  mount: () => {},
});

function docWithEffects(): PageDocument {
  const doc = createBlankDocument('Effects');
  doc.document.children = [
    {
      id: 'hero',
      type: 'section',
      props: {},
      styles: {},
      effects: [{ plugin: 'drift', enabled: true, config: { speed: 0.5 } }],
      children: [
        {
          id: 'pic',
          type: 'image',
          props: { src: 'https://example.com/a.png', alt: 'a' },
          styles: {},
          effects: [{ plugin: 'drift', enabled: true, config: {} }],
          children: [],
        },
        { id: 'plain', type: 'text', props: { content: 'hi' }, styles: {}, children: [] },
      ],
    },
  ];
  return doc;
}

function manifestOf(html: string) {
  const json = html.match(/<script type="application\/json" id="kb-effects">(.*?)<\/script>/)?.[1];
  return json ? parseEffectManifest(JSON.parse(json)) : null;
}

const registry = createEffectRegistry([drift]);

describe('generateStandaloneHtml with effects', () => {
  it('stays HTML + CSS only without the effects option', () => {
    const html = generateStandaloneHtml(docWithEffects());
    expect(html).not.toContain('<script');
    expect(html).not.toContain('data-kb-node');
  });

  it('tags effect nodes, embeds the parsed manifest and loads the runtime with defer', () => {
    const html = generateStandaloneHtml(docWithEffects(), {
      effects: { registry, runtime: { src: 'kubuild-runtime.js' } },
    });
    expect(html).toContain('<section data-kb-node="hero" class="kb-section kb-node-hero"');
    expect(html).toMatch(/<img data-kb-node="pic" /);
    expect(html).not.toContain('data-kb-node="plain"');
    expect({ ...manifestOf(html)?.nodes }).toEqual({
      hero: [{ plugin: 'drift', config: { speed: 0.5 } }],
      pic: [{ plugin: 'drift', config: { speed: 0.3 } }],
    });
    expect(html).toContain('<script src="kubuild-runtime.js" defer></script>\n</body>');
  });

  it('emits no script when nothing is mountable, and reports what was dropped', () => {
    const doc = docWithEffects();
    doc.document.children![0].effects = [{ plugin: 'missing', enabled: true, config: {} }];
    doc.document.children![0].children![0].effects = [{ plugin: 'drift', enabled: false, config: {} }];
    const onSkipped = vi.fn();
    const html = generateStandaloneHtml(doc, { effects: { registry, runtime: { src: 'r.js' }, onSkipped } });
    expect(html).not.toContain('<script');
    expect(onSkipped).toHaveBeenCalledWith([{ nodeId: 'hero', plugin: 'missing', reason: 'unknown-plugin' }]);
  });

  it('cannot be broken out of by config strings or inlined runtime source', () => {
    const doc = docWithEffects();
    // `$1` would be expanded by a string replacer; `&` must be entity-escaped in the attribute.
    doc.document.children![0].id = 'x$1&y';
    doc.document.children![0].effects = [{ plugin: 'drift', enabled: true, config: { speed: 1, label: '</script><b>' } }];
    const sneaky = defineEffectPlugin<Record<string, unknown>>({ ...drift, id: 'drift', parse: (c) => ({ success: true, config: c as Record<string, unknown> }) });
    const html = generateStandaloneHtml(doc, {
      effects: { registry: createEffectRegistry([sneaky]), runtime: { inline: 'var s="</script><i>";' } },
    });
    // Only our own two script elements open, and each closes exactly once.
    expect(html.match(/<script/g)).toHaveLength(2);
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).toContain('<section data-kb-node="x$1&amp;y"');
    expect(manifestOf(html)?.nodes['x$1&y']?.[0].config.label).toBe('</script><b>');
  });
});
