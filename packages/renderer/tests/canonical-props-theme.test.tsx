import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument, type Diagnostic } from '@kubuild/core';
import type { Node, PageDocument } from '@kubuild/schema';
import {
  KubuildRenderer,
  renderTypographyNode,
  createRenderContext,
  generateDocumentCss,
  resolveRuntimeTheme,
  themeToCssProperties,
  type RenderNodeContentOptions,
} from '../src';

const registry = createDefaultComponentRegistry();

function renderDoc(children: Node[], extra: Partial<PageDocument> = {}, context = createRenderContext()) {
  const doc = { ...createBlankDocument('Test'), ...extra };
  doc.document.children = children;
  const diagnostics: Diagnostic[] = [];
  const html = renderToString(
    <KubuildRenderer document={doc} registry={registry} context={context} onDiagnostic={(d) => diagnostics.push(d)} />,
  );
  return { html, diagnostics };
}

/** Depth-first search for the first element carrying an `onChange` handler (EditableText). */
function findOnChange(element: unknown): ((value: string, isBlur?: boolean) => void) | undefined {
  if (!element || typeof element !== 'object') return undefined;
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findOnChange(child);
      if (found) return found;
    }
    return undefined;
  }
  const props = (element as { props?: Record<string, unknown> }).props;
  if (!props) return undefined;
  if (typeof props.onChange === 'function') return props.onChange as (value: string, isBlur?: boolean) => void;
  return findOnChange(props.children);
}

function inlineEditPropName(node: Node): string | undefined {
  const onNodePropChange = vi.fn();
  const options = {
    node,
    document: createBlankDocument('Edit'),
    registry,
    context: createRenderContext(),
    viewport: 'desktop',
    mode: 'editor',
    styles: {},
    props: node.props ?? {},
    resolvedProps: node.props ?? {},
    domId: node.id,
    handleClick: () => {},
    onNodePropChange,
    selectedNodeId: node.id,
    renderChildNode: () => <span />,
  } as unknown as RenderNodeContentOptions;
  const element = renderTypographyNode(options);
  findOnChange(element)?.('Edited', true);
  return onNodePropChange.mock.calls[0]?.[1];
}

describe('STORA-550: renderer reads deprecated aliases with a DEPRECATED_PROP diagnostic', () => {
  it.each([
    [{ id: 'p', type: 'paragraph', props: { content: 'Alias paragraph' } }, 'content', 'text'],
    [{ id: 'b', type: 'badge', props: { label: 'Alias badge' } }, 'label', 'text'],
    [{ id: 'q', type: 'blockquote', props: { quote: 'Alias quote' } }, 'quote', 'text'],
    [{ id: 'l', type: 'link', props: { label: 'Alias link', href: '/x' } }, 'label', 'text'],
    [{ id: 'btn', type: 'button', props: { text: 'Alias button' } }, 'text', 'label'],
  ] as Array<[Node, string, string]>)('%o', (node, propName, canonicalName) => {
    const { html, diagnostics } = renderDoc([node]);
    expect(html).toContain(String(node.props![propName]));
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: 'DEPRECATED_PROP', nodeId: node.id, propName, canonicalName }),
    );
  });

  it('emits no diagnostic for canonical props', () => {
    const { diagnostics } = renderDoc([
      { id: 'p', type: 'paragraph', props: { text: 'Canonical' } },
      { id: 'b', type: 'badge', props: { text: 'Canonical' } },
    ]);
    expect(diagnostics.filter((d) => d.code === 'DEPRECATED_PROP')).toEqual([]);
  });

  it('keeps legacy content-only text nodes block-level (<p>)', () => {
    const { html } = renderDoc([{ id: 't', type: 'text', props: { content: 'Legacy block' } }]);
    expect(html).toMatch(/<p[^>]*id="t"/);
  });

  it('prefers the canonical prop when both are present', () => {
    const { html } = renderDoc([{ id: 'q', type: 'blockquote', props: { text: 'Canonical', quote: 'Alias' } }]);
    expect(html).toContain('Canonical');
    expect(html).not.toContain('Alias');
  });
});

describe('STORA-550: inline editing writes the canonical prop name', () => {
  it.each([
    { id: 'h', type: 'heading', props: { content: 'x' } },
    { id: 'p', type: 'paragraph', props: { content: 'x' } },
    { id: 't', type: 'text', props: { content: 'x' } },
    { id: 'l', type: 'link', props: { label: 'x', href: '/' } },
    { id: 'b', type: 'badge', props: { label: 'x' } },
    { id: 'q', type: 'blockquote', props: { quote: 'x' } },
  ] as Node[])('$type with legacy alias -> "text"', (node) => {
    expect(inlineEditPropName(node)).toBe('text');
  });
});

describe('STORA-551: theme tokens as CSS custom properties', () => {
  const theme = {
    colors: { primary: '#2563eb' },
    fonts: { body: '"Inter", sans-serif' },
    radii: { md: 8 },
    spacing: { lg: '24px' },
  };

  it('emits document tokens on the renderer root', () => {
    const { html } = renderDoc(
      [{ id: 's', type: 'section', props: {}, styles: { base: { backgroundColor: 'var(--kb-color-primary)' } } }],
      { theme },
    );
    const root = /<div class="kubuild-canvas-root[^"]*" style="([^"]*)"/.exec(html);
    expect(root?.[1]).toContain('--kb-color-primary:#2563eb');
    expect(root?.[1]).toContain('--kb-font-body:&quot;Inter&quot;, sans-serif');
    expect(root?.[1]).toContain('--kb-radius-md:8px');
    expect(root?.[1]).toContain('--kb-space-lg:24px');
    expect(html).toContain('background-color:var(--kb-color-primary)');
  });

  it('lets the host override tokens through RuntimeContext without touching the document', () => {
    const doc = { ...createBlankDocument('Tenant'), theme };
    const context = createRenderContext({ theme: { colors: { primary: '#ff0066' } } });
    const html = renderToString(<KubuildRenderer document={doc} registry={registry} context={context} />);
    expect(html).toContain('--kb-color-primary:#ff0066');
    expect(html).toContain('--kb-radius-md:8px');
    expect(doc.theme.colors.primary).toBe('#2563eb');
  });

  it('drops unsafe host override tokens', () => {
    const style = themeToCssProperties(
      resolveRuntimeTheme(
        { theme },
        { theme: { colors: { primary: 'red;} body{display:none', 'x"y': '#000', ok: '#fff' } } },
      ),
    ) as Record<string, string>;
    expect(style['--kb-color-primary']).toBe('#2563eb');
    expect(style['--kb-color-ok']).toBe('#fff');
    expect(Object.keys(style).some((key) => key.includes('"'))).toBe(false);
  });

  it('emits a :root token block in generated CSS', () => {
    const doc = { ...createBlankDocument('CSS'), theme };
    const css = generateDocumentCss(doc, { includeReset: false });
    expect(css).toContain(':root {');
    expect(css).toContain('--kb-color-primary: #2563eb;');
    expect(css).toContain('--kb-radius-md: 8px;');
  });
});
