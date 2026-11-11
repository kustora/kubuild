import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument, createEffectRegistry, defineEffectPlugin, findNodeById } from '@kubuild/core';
import { MAX_NODE_EFFECTS, type Node } from '@kubuild/schema';
import { EffectsPanel } from '../src/components/panels/effects-panel';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { EffectRegistryContext } from '../src/components/layout/effect-registry-context';
import { useEditorStore } from '../src/store';

const drift = defineEffectPlugin<{ speed: number; axis: string; mobile: boolean }>({
  id: 'drift',
  label: 'Drift',
  description: 'Moves things.',
  defaults: { speed: 0.3, axis: 'vertical', mobile: false },
  configJsonSchema: { type: 'object' },
  fields: [
    { key: 'speed', label: 'Speed', type: 'number', min: -1, max: 1, step: 0.05 },
    {
      key: 'axis',
      label: 'Direction',
      type: 'select',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
    { key: 'mobile', label: 'Disable on mobile', type: 'boolean' },
  ],
  parse(config) {
    const c = { speed: 0.3, axis: 'vertical', mobile: false, ...(config as object) } as { speed: unknown; axis: string; mobile: boolean };
    return typeof c.speed === 'number' && c.speed >= -1 && c.speed <= 1
      ? { success: true, config: c as { speed: number; axis: string; mobile: boolean } }
      : { success: false, error: 'speed: out of range' };
  },
  mount: () => {},
});
const registry = createEffectRegistry([drift]);

const section = (effects?: Node['effects']): Node => ({ id: 'hero', type: 'section', props: {}, styles: {}, effects, children: [] });

describe('EffectsPanel', () => {
  it('renders controls generated from the plugin fields with parsed values', () => {
    const html = renderToString(
      <EffectsPanel
        node={section([{ plugin: 'drift', enabled: true, config: { speed: 0.5, axis: 'horizontal' } }])}
        registry={registry}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('data-testid="effect-card-drift"');
    expect(html).toContain('Drift');
    expect(html).toContain('aria-label="Speed value"');
    expect(html).toMatch(/aria-label="Speed value"[^>]*value="0.5"|value="0.5"[^>]*aria-label="Speed value"/);
    expect(html).toMatch(/<option value="horizontal" selected="">/);
    expect(html).toContain('Disable on mobile');
    expect(html).toContain('data-testid="effects-add-select"');
  });

  it('keeps unknown plugins visible but flags them, and shows invalid config', () => {
    const html = renderToString(
      <EffectsPanel
        node={section([
          { plugin: 'from-elsewhere', enabled: true, config: { a: 1 } },
          { plugin: 'drift', enabled: true, config: { speed: 9 } },
        ])}
        registry={registry}
        onChange={() => {}}
      />,
    );
    expect(html).toContain('data-testid="effect-card-from-elsewhere"');
    expect(html).toContain('no plugin for this effect');
    expect(html).toContain('speed: out of range');
  });

  it('hides the add control at the effect limit and without plugins', () => {
    const full = Array.from({ length: MAX_NODE_EFFECTS }, () => ({ plugin: 'drift', enabled: true, config: {} }));
    expect(renderToString(<EffectsPanel node={section(full)} registry={registry} onChange={() => {}} />)).toContain(
      'maximum number of effects',
    );
    expect(
      renderToString(<EffectsPanel node={section()} registry={createEffectRegistry()} onChange={() => {}} />),
    ).toContain('No effect plugins are registered.');
  });
});

describe('Effects in the inspector and store', () => {
  function seed() {
    const doc = createBlankDocument('Effects');
    doc.document.children = [section([{ plugin: 'drift', enabled: true, config: {} }])];
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero');
    return doc;
  }

  it('shows the Effects sector only when the host registered effect plugins', () => {
    const doc = seed();
    const inspector = <InspectorPanel registry={createDefaultComponentRegistry()} document={doc} selectedNodeId="hero" />;
    expect(renderToString(inspector)).not.toContain('data-testid="sector-effects"');
    const html = renderToString(<EffectRegistryContext.Provider value={registry}>{inspector}</EffectRegistryContext.Provider>);
    expect(html).toContain('data-testid="sector-effects"');
    // Opens by default when the node already has effects.
    expect(html).toContain('data-testid="effect-card-drift"');
  });

  it('updateNodeEffects replaces the list, removes it with null and is undoable', () => {
    seed();
    const store = useEditorStore.getState();
    expect(store.updateNodeEffects('hero', [{ plugin: 'drift', enabled: false, config: { speed: 0.1 } }])).toEqual({ success: true });
    expect(findNodeById(useEditorStore.getState().document.document, 'hero')?.effects).toEqual([
      { plugin: 'drift', enabled: false, config: { speed: 0.1 } },
    ]);

    useEditorStore.getState().updateNodeEffects('hero', null);
    expect(findNodeById(useEditorStore.getState().document.document, 'hero')?.effects).toBeUndefined();

    useEditorStore.getState().undo();
    expect(findNodeById(useEditorStore.getState().document.document, 'hero')?.effects?.[0].enabled).toBe(false);

    expect(useEditorStore.getState().updateNodeEffects('missing', null).success).toBe(false);
  });
});

describe('Effects sector in Simple mode', () => {
  it('is available in Simple mode as well', () => {
    const doc = createBlankDocument('Effects');
    doc.document.children = [section([{ plugin: 'drift', enabled: true, config: {} }])];
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero');
    const html = renderToString(
      <EffectRegistryContext.Provider value={registry}>
        <InspectorPanel registry={createDefaultComponentRegistry()} document={doc} selectedNodeId="hero" mode="simple" />
      </EffectRegistryContext.Provider>,
    );
    expect(html).toContain('data-testid="sector-effects"');
  });
});
