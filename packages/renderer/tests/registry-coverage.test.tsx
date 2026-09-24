import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { Node, PageDocument } from '@kubuild/schema';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry, type ComponentDefinition } from '@kubuild/components';
import { NodeRenderer, FormRuntimeProvider } from '../src/index';

/**
 * STORA-531 / STORA-534: every type registered by createDefaultComponentRegistry() must have
 * a real renderer. A registered type that falls through to the "Unknown Component"
 * placeholder is something users can drop into a page but never use — this test fails
 * as soon as a definition is added without a matching renderer.
 */
const registry = createDefaultComponentRegistry();

function nodeFromDefinition(def: ComponentDefinition): Node {
  let counter = 0;
  const children = (def.defaultChildren || []).map((child) => ({
    id: `${def.type}_child_${counter++}`,
    type: child.type,
    props: { ...(child.props || {}) },
    styles: {},
    children: [],
  }));
  return {
    id: `node_${def.type}`,
    type: def.type,
    props: { ...(def.defaultProps || {}) },
    styles: {},
    children,
  };
}

function render(node: Node, mode: 'editor' | 'runtime'): string {
  const doc: PageDocument = createBlankDocument('Coverage');
  return renderToString(
    <FormRuntimeProvider formId="coverage_form">
      <NodeRenderer node={node} document={doc} registry={registry} mode={mode} />
    </FormRuntimeProvider>,
  );
}

describe('registry coverage: every default registry type has a renderer', () => {
  const definitions = registry.list();

  it('the default registry is not empty', () => {
    expect(definitions.length).toBeGreaterThan(0);
  });

  it('control: an unregistered type does hit the fallback', () => {
    const html = render({ id: 'n_x', type: 'definitely-not-registered', props: {}, children: [] }, 'editor');
    expect(html).toContain('data-kubuild-unknown');
  });

  for (const mode of ['editor', 'runtime'] as const) {
    it.each(definitions.map((def) => [def.type, def] as const))(
      `"%s" renders without the unknown-component fallback (${mode})`,
      (_type, def) => {
        const html = render(nodeFromDefinition(def), mode);
        expect(html).not.toContain('data-kubuild-unknown');
        expect(html).not.toContain('Unknown Component');
        expect(html).not.toContain('data-kubuild-error');
      },
    );
  }
});
