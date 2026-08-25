import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from './renderer';
import { createDefaultComponentRegistry, ComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { ActionHandler, RuntimeContext } from '@kubuild/core';
import { Node, PageDocument, starterPageFixture } from '@kubuild/schema';

describe('KubuildRenderer', () => {
  it('renders a simple document to HTML markup', () => {
    const doc = createBlankDocument('Test Page');
    doc.document.children = [
      {
        id: 'heading-1',
        type: 'heading',
        props: { text: 'Hello World', level: 1 },
      },
    ];

    const registry = createDefaultComponentRegistry();
    const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
    expect(html).toContain('Hello World');
    expect(html).toContain('heading-1');
  });
});

describe('STORA-030: Recursive Document Renderer & Error Handling', () => {
  const registry = createDefaultComponentRegistry();

  describe('Acceptance Criteria 1: Starter page fixture renders every core component', () => {
    it('renders the complete starter page fixture markup containing page, section, container, heading, text, image, and button', () => {
      const html = renderToString(<KubuildRenderer document={starterPageFixture} registry={registry} />);

      // Root Page
      expect(html).toContain('id="root-page"');
      // Section
      expect(html).toContain('id="hero-section"');
      expect(html).toContain('<section');
      // Container
      expect(html).toContain('id="hero-container"');
      // Heading
      expect(html).toContain('id="hero-heading"');
      expect(html).toContain('Build Once, Render Anywhere');
      // Text
      expect(html).toContain('id="hero-text"');
      expect(html).toContain('KUBUILD is an open, portable web page builder engine');
      // Image
      expect(html).toContain('id="hero-image"');
      expect(html).toContain('alt="KUBUILD Platform Graphic"');
      // Button
      expect(html).toContain('id="hero-button"');
      expect(html).toContain('Get Started');
    });
  });

  describe('Acceptance Criteria 2: Child elements rendered strictly in document order', () => {
    it('preserves the exact chronological order of children nodes in output markup', () => {
      const doc = createBlankDocument('Order Test');
      doc.document.children = [
        { id: 'first-heading', type: 'heading', props: { text: 'First Element', level: 2 } },
        { id: 'second-text', type: 'text', props: { content: 'Second Element' } },
        { id: 'third-button', type: 'button', props: { label: 'Third Element' } },
      ];

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);

      const firstIndex = html.indexOf('First Element');
      const secondIndex = html.indexOf('Second Element');
      const thirdIndex = html.indexOf('Third Element');

      expect(firstIndex).toBeGreaterThan(-1);
      expect(secondIndex).toBeGreaterThan(firstIndex);
      expect(thirdIndex).toBeGreaterThan(secondIndex);
    });
  });

  describe('Acceptance Criteria 3: Unknown component handling in editor vs runtime mode', () => {
    const docWithUnknown = createBlankDocument('Unknown Component Test');
    docWithUnknown.document.children = [
      {
        id: 'node-mystery',
        type: 'non-existent-widget',
        props: { foo: 'bar' },
        children: [
          { id: 'nested-text', type: 'text', props: { content: 'Nested Content' } },
        ],
      },
    ];

    it('renders a diagnostic placeholder in editor mode', () => {
      const html = renderToString(
        <KubuildRenderer document={docWithUnknown} registry={registry} mode="editor" />,
      );

      expect(html).toContain('Unknown Component:');
      expect(html).toContain('non-existent-widget');
      expect(html).toContain('node-mystery');
      expect(html).toContain('data-kubuild-unknown="non-existent-widget"');
      expect(html).toContain('Nested Content');
    });

    it('renders a safe fallback container in runtime mode without diagnostic placeholder', () => {
      const html = renderToString(
        <KubuildRenderer document={docWithUnknown} registry={registry} mode="runtime" />,
      );

      expect(html).not.toContain('Unknown Component:');
      expect(html).toContain('data-kubuild-unknown="non-existent-widget"');
      expect(html).toContain('Nested Content');
    });
  });

  describe('Acceptance Criteria 4: Custom Component Extension rendering via Registry', () => {
    it('executes custom component renderer registered in ComponentRegistry', () => {
      const customRegistry = new ComponentRegistry();
      customRegistry.register({
        type: 'custom-card',
        label: 'Custom Card',
        category: 'custom',
        renderer: ({ props, children }: { props: Record<string, unknown>; children?: React.ReactNode }) => (
          <div className="my-custom-card" data-testid="custom-card">
            <h3>{String(props.cardTitle || '')}</h3>
            <div className="card-body">{children}</div>
          </div>
        ),
      });

      const doc = createBlankDocument('Custom Card Test');
      doc.document.children = [
        {
          id: 'card-1',
          type: 'custom-card',
          props: { cardTitle: 'Special Announcement' },
          children: [
            { id: 'card-text', type: 'text', props: { content: 'Inside the card' } },
          ],
        },
      ];

      const html = renderToString(<KubuildRenderer document={doc} registry={customRegistry} />);

      expect(html).toContain('my-custom-card');
      expect(html).toContain('Special Announcement');
      expect(html).toContain('Inside the card');
    });
  });

  describe('Acceptance Criteria 5: Component Error Boundary prevents full page crash', () => {
    it('catches render errors in editor mode and renders diagnostic error box', () => {
      const faultyRegistry = new ComponentRegistry();
      faultyRegistry.register({
        type: 'faulty-component',
        label: 'Faulty',
        category: 'custom',
        renderer: () => {
          throw new Error('Exploded during render!');
        },
      });

      const doc = createBlankDocument('Error Test');
      doc.document.children = [
        { id: 'good-heading', type: 'heading', props: { text: 'Healthy Component' } },
        { id: 'bad-node', type: 'faulty-component', props: {} },
      ];

      // Suppress expected console.error from React error boundary during test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const html = renderToString(
        <KubuildRenderer document={doc} registry={faultyRegistry} mode="editor" />,
      );

      spy.mockRestore();

      expect(html).toContain('Healthy Component');
      expect(html).toContain('Component Render Error:');
      expect(html).toContain('faulty-component');
      expect(html).toContain('Exploded during render!');
    });

    it('catches render errors in runtime mode and renders safe hidden fallback', () => {
      const faultyRegistry = new ComponentRegistry();
      faultyRegistry.register({
        type: 'faulty-component',
        label: 'Faulty',
        category: 'custom',
        renderer: () => {
          throw new Error('Exploded in production!');
        },
      });

      const doc = createBlankDocument('Error Test Runtime');
      doc.document.children = [
        { id: 'good-heading', type: 'heading', props: { text: 'Healthy Component' } },
        { id: 'bad-node', type: 'faulty-component', props: {} },
      ];

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const html = renderToString(
        <KubuildRenderer document={doc} registry={faultyRegistry} mode="runtime" />,
      );

      spy.mockRestore();

      expect(html).toContain('Healthy Component');
      expect(html).not.toContain('Exploded in production!');
      expect(html).toContain('data-kubuild-error="faulty-component"');
    });
  });

  describe('Acceptance Criteria 6: Renderer operates independently with no editor state required', () => {
    it('renders cleanly from just a PageDocument without any external store or state', () => {
      const doc = createBlankDocument('Pure Document');
      const html = renderToString(<KubuildRenderer document={doc} />);
      expect(html).toContain('id="root-page"');
    });
  });
});

describe('STORA-022: Content component rendering', () => {
  const registry = createDefaultComponentRegistry();

  function renderNode(node: Node): string {
    const doc = createBlankDocument('Content Test');
    doc.document.children = [node];
    return renderToString(<KubuildRenderer document={doc} registry={registry} />);
  }

  describe('image', () => {
    it('prefers a direct "src" URL when both src and asset are present', () => {
      const html = renderNode({
        id: 'img-1',
        type: 'image',
        props: {
          src: 'https://example.com/direct.png',
          asset: { type: 'asset', assetId: 'a1', fallbackUrl: 'https://example.com/fallback.png' },
          alt: 'A picture',
        },
      });
      expect(html).toContain('src="https://example.com/direct.png"');
      expect(html).toContain('alt="A picture"');
    });

    it('falls back to the asset reference\'s fallbackUrl when no direct src is given', () => {
      const html = renderNode({
        id: 'img-2',
        type: 'image',
        props: {
          asset: { type: 'asset', assetId: 'a1', fallbackUrl: 'https://example.com/fallback.png' },
          alt: 'A picture',
        },
      });
      expect(html).toContain('src="https://example.com/fallback.png"');
    });

    it('renders no src attribute when neither src nor a resolvable asset is present', () => {
      const html = renderNode({ id: 'img-3', type: 'image', props: { alt: 'No source' } });
      expect(html).not.toMatch(/src="[^"]+"/);
      expect(html).toContain('alt="No source"');
    });
  });

  describe('button', () => {
    it('renders as a semantic <a> when href is present', () => {
      const html = renderNode({ id: 'btn-1', type: 'button', props: { label: 'Go', href: '/docs' } });
      expect(html).toMatch(/<a[^>]*href="\/docs"[^>]*>Go<\/a>/);
    });

    it('renders as a <button> when only an action is present (no href)', () => {
      const html = renderNode({
        id: 'btn-2',
        type: 'button',
        props: { label: 'Submit', action: { type: 'navigate', payload: { url: '/docs' } } },
      });
      expect(html).toMatch(/<button[^>]*>Submit<\/button>/);
    });

    it('renders the disabled attribute on <button> when disabled is true', () => {
      const html = renderNode({ id: 'btn-3', type: 'button', props: { label: 'Nope', disabled: true } });
      expect(html).toMatch(/<button[^>]*disabled[^>]*>Nope<\/button>/);
    });

    it('ignores href when disabled, rendering a disabled <button> instead of a link', () => {
      const html = renderNode({
        id: 'btn-4',
        type: 'button',
        props: { label: 'Disabled Link', href: '/docs', disabled: true },
      });
      expect(html).toMatch(/<button[^>]*disabled[^>]*>Disabled Link<\/button>/);
      expect(html).not.toContain('<a');
    });
  });
});

describe('STORA-031: RenderContext resolution', () => {
  const registry = createDefaultComponentRegistry();

  function renderNode(node: Node, context?: RuntimeContext): { html: string; doc: PageDocument } {
    const doc = createBlankDocument('Context Test');
    doc.document.children = [node];
    const html = renderToString(<KubuildRenderer document={doc} registry={registry} context={context} />);
    return { html, doc };
  }

  it('resolves an image asset through context.assetProvider when no direct src is given', () => {
    const context: RuntimeContext = {
      assetProvider: {
        resolve: (assetId) => `https://cdn.example.com/${assetId}.png`,
      },
    };
    const { html } = renderNode(
      {
        id: 'img-ctx',
        type: 'image',
        props: { asset: { type: 'asset', assetId: 'a1', fallbackUrl: 'https://example.com/fallback.png' } },
      },
      context,
    );
    expect(html).toContain('src="https://cdn.example.com/a1.png"');
  });

  it('falls back to fallbackUrl when assetProvider.resolve returns a Promise (async result unusable during sync render)', () => {
    const context: RuntimeContext = {
      assetProvider: {
        resolve: async (assetId) => `https://cdn.example.com/${assetId}.png`,
      },
    };
    const { html } = renderNode(
      {
        id: 'img-async',
        type: 'image',
        props: { asset: { type: 'asset', assetId: 'a1', fallbackUrl: 'https://example.com/fallback.png' } },
      },
      context,
    );
    expect(html).toContain('src="https://example.com/fallback.png"');
  });

  it('marks a button action as resolved when a matching handler is registered in context.actionRegistry', () => {
    const handlers = new Map<string, ActionHandler>();
    const context: RuntimeContext = {
      actionRegistry: {
        get: (type) => handlers.get(type),
        register: (type, handler) => handlers.set(type, handler),
        unregister: (type) => handlers.delete(type),
      },
    };
    context.actionRegistry!.register('navigate', () => {});

    const { html } = renderNode(
      { id: 'btn-ctx', type: 'button', props: { label: 'Go', action: { type: 'navigate' } } },
      context,
    );
    expect(html).toContain('data-kubuild-action="navigate"');
    expect(html).toContain('data-kubuild-action-resolved="true"');
  });

  it('marks a button action as unresolved when no handler is registered for it', () => {
    const context: RuntimeContext = {
      actionRegistry: { get: () => undefined, register: () => {}, unregister: () => {} },
    };
    const { html } = renderNode(
      { id: 'btn-unresolved', type: 'button', props: { label: 'Go', action: { type: 'unknown-action' } } },
      context,
    );
    expect(html).toContain('data-kubuild-action-resolved="false"');
  });

  it('does not mutate the document while resolving asset/action context', () => {
    const context: RuntimeContext = {
      assetProvider: { resolve: (assetId) => `https://cdn.example.com/${assetId}.png` },
      actionRegistry: { get: () => () => {}, register: () => {}, unregister: () => {} },
    };
    const before = JSON.stringify({
      id: 'img-immutable',
      type: 'image',
      props: { asset: { type: 'asset', assetId: 'a1' } },
    });
    const node: Node = JSON.parse(before);
    const { doc } = renderNode(node, context);
    expect(JSON.stringify(doc.document.children![0])).toBe(before);
  });
});

describe('STORA-051: Centralized prop resolution & binding type diagnostics', () => {
  const registry = createDefaultComponentRegistry();

  function renderWithDiagnostics(
    node: Node,
    context?: RuntimeContext,
  ): { html: string; diagnostics: unknown[] } {
    const doc = createBlankDocument('Binding Test');
    doc.document.children = [node];
    const diagnostics: unknown[] = [];
    const html = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        context={context}
        onDiagnostic={(d) => diagnostics.push(d)}
      />,
    );
    return { html, diagnostics };
  }

  it('resolves a compatible binding for heading.text', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      { id: 'h1', type: 'heading', props: { text: { type: 'variable', key: 'site.name' } } },
      { variables: { site: { name: 'My Website' } } },
    );
    expect(html).toContain('My Website');
    expect(diagnostics).toEqual([]);
  });

  it('resolves a compatible binding for text.content', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      { id: 't1', type: 'text', props: { content: { type: 'variable', key: 'tagline' } } },
      { variables: { tagline: 'Build once, render anywhere' } },
    );
    expect(html).toContain('Build once, render anywhere');
    expect(diagnostics).toEqual([]);
  });

  it('resolves compatible bindings for image.src and image.alt', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      {
        id: 'img-1',
        type: 'image',
        props: {
          src: { type: 'variable', key: 'hero.src' },
          alt: { type: 'variable', key: 'hero.alt' },
        },
      },
      { variables: { hero: { src: 'https://example.com/hero.png', alt: 'Hero shot' } } },
    );
    expect(html).toContain('src="https://example.com/hero.png"');
    expect(html).toContain('alt="Hero shot"');
    expect(diagnostics).toEqual([]);
  });

  it('resolves a compatible binding for button.label', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      { id: 'btn-1', type: 'button', props: { label: { type: 'variable', key: 'cta.label' } } },
      { variables: { cta: { label: 'Buy Now' } } },
    );
    expect(html).toContain('Buy Now');
    expect(diagnostics).toEqual([]);
  });

  it('emits an INCOMPATIBLE_BINDING_TYPE diagnostic and falls back safely when a string prop resolves to an object', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      { id: 'img-2', type: 'image', props: { src: { type: 'variable', key: 'bad.src' }, alt: 'ok' } },
      { variables: { bad: { src: { nested: 'object' } } } },
    );
    expect(html).not.toContain('[object Object]');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'INCOMPATIBLE_BINDING_TYPE',
      propName: 'src',
      expectedType: 'string',
      actualType: 'object',
      nodeId: 'img-2',
    });
  });

  it('does not throw and falls back safely when a number prop resolves to a non-number', () => {
    const { html, diagnostics } = renderWithDiagnostics(
      { id: 'img-3', type: 'image', props: { alt: 'ok', width: { type: 'variable', key: 'bad.width' } } },
      { variables: { bad: { width: 'not-a-number' } } },
    );
    expect(html).toContain('alt="ok"');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'INCOMPATIBLE_BINDING_TYPE', propName: 'width' });
  });

  it('leaves static (non-binding) values untouched', () => {
    const { html, diagnostics } = renderWithDiagnostics({
      id: 'h2',
      type: 'heading',
      props: { text: 'Plain Static Text' },
    });
    expect(html).toContain('Plain Static Text');
    expect(diagnostics).toEqual([]);
  });

  it('resolves identically in editor mode and runtime mode (preview/runtime share the same resolver)', () => {
    const doc = createBlankDocument('Mode Parity Test');
    doc.document.children = [
      { id: 'h3', type: 'heading', props: { text: { type: 'variable', key: 'site.name' } } },
    ];
    const context: RuntimeContext = { variables: { site: { name: 'Parity Co' } } };

    const editorHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} context={context} mode="editor" />,
    );
    const runtimeHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} context={context} mode="runtime" />,
    );

    expect(editorHtml).toContain('Parity Co');
    expect(runtimeHtml).toContain('Parity Co');
  });
});

describe('STORA-052: Collection rendering', () => {
  const registry = createDefaultComponentRegistry();

  function renderCollection(
    collectionProps: Record<string, unknown>,
    context: RuntimeContext,
  ): { html: string; diagnostics: unknown[] } {
    const doc = createBlankDocument('Collection Test');
    doc.document.children = [
      {
        id: 'collection-1',
        type: 'collection',
        props: collectionProps,
        children: [
          { id: 'item-name', type: 'text', props: { content: { type: 'variable', key: 'item.name' } } },
          { id: 'item-price', type: 'text', props: { content: 'Price: {{ item.price }}' } },
        ],
      },
    ];
    const diagnostics: unknown[] = [];
    const html = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        context={context}
        onDiagnostic={(d) => diagnostics.push(d)}
      />,
    );
    return { html, diagnostics };
  }

  it('renders 3 subtrees in input order for a 3-item array', () => {
    const { html, diagnostics } = renderCollection(
      { sourceKey: 'products', itemAlias: 'item' },
      {
        variables: {
          products: [
            { name: 'Alpha', price: 10 },
            { name: 'Beta', price: 20 },
            { name: 'Gamma', price: 30 },
          ],
        },
      },
    );

    expect(diagnostics).toEqual([]);
    const alphaIndex = html.indexOf('Alpha');
    const betaIndex = html.indexOf('Beta');
    const gammaIndex = html.indexOf('Gamma');
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(betaIndex).toBeGreaterThan(alphaIndex);
    expect(gammaIndex).toBeGreaterThan(betaIndex);
    expect(html).toContain('10');
    expect(html).toContain('20');
    expect(html).toContain('30');
  });

  it('produces unique DOM ids per iteration while sharing the same template data-kubuild-node', () => {
    const { html } = renderCollection(
      { sourceKey: 'products', itemAlias: 'item' },
      { variables: { products: [{ name: 'A', price: 1 }, { name: 'B', price: 2 }, { name: 'C', price: 3 }] } },
    );

    const idMatches = html.match(/id="item-name[^"]*"/g) ?? [];
    expect(new Set(idMatches).size).toBe(idMatches.length);
    expect(idMatches.length).toBe(3);

    const templateRefs = html.match(/data-kubuild-node="item-name"/g) ?? [];
    expect(templateRefs.length).toBe(3);
  });

  it('resolves item.* bindings only within the collection scope, not for outside siblings', () => {
    const doc = createBlankDocument('Scope Leak Test');
    doc.document.children = [
      {
        id: 'collection-1',
        type: 'collection',
        props: { sourceKey: 'products', itemAlias: 'item' },
        children: [{ id: 'item-name', type: 'text', props: { content: { type: 'variable', key: 'item.name' } } }],
      },
      {
        id: 'outside-text',
        type: 'text',
        props: { content: { type: 'variable', key: 'item.name', fallback: 'NO_LEAK' } },
      },
    ];
    const html = renderToString(
      <KubuildRenderer
        document={doc}
        registry={registry}
        context={{ variables: { products: [{ name: 'Alpha' }] } }}
      />,
    );

    expect(html).toContain('Alpha');
    expect(html).toContain('NO_LEAK');
  });

  it('renders zero subtrees for an empty array without a diagnostic', () => {
    const { html, diagnostics } = renderCollection(
      { sourceKey: 'products', itemAlias: 'item' },
      { variables: { products: [] } },
    );
    expect(diagnostics).toEqual([]);
    expect(html).not.toContain('id="item-name');
  });

  it.each([
    ['a string', 'not-an-array'],
    ['an object', { not: 'an array' }],
    ['missing', undefined],
  ])('emits INVALID_COLLECTION_SOURCE and renders no throw when sourceKey resolves to %s', (_label, value) => {
    const { diagnostics } = renderCollection(
      { sourceKey: 'products', itemAlias: 'item' },
      { variables: value === undefined ? {} : { products: value } },
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'INVALID_COLLECTION_SOURCE', nodeId: 'collection-1' });
  });

  it('shows an editor-mode diagnostic placeholder and a silent runtime-mode fallback for an invalid source', () => {
    const doc = createBlankDocument('Invalid Source Test');
    doc.document.children = [
      { id: 'collection-1', type: 'collection', props: { sourceKey: 'products', itemAlias: 'item' }, children: [] },
    ];
    const context: RuntimeContext = { variables: { products: 'not-an-array' } };

    const editorHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} context={context} mode="editor" />,
    );
    const runtimeHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} context={context} mode="runtime" />,
    );

    expect(editorHtml).toContain('Collection: expected an array');
    expect(runtimeHtml).not.toContain('Collection: expected an array');
    expect(runtimeHtml).toContain('data-kubuild-node="collection-1"');
  });

  it('supports a nested collection with a distinct inner itemAlias without corrupting the outer scope', () => {
    const doc = createBlankDocument('Nested Collection Test');
    doc.document.children = [
      {
        id: 'outer',
        type: 'collection',
        props: { sourceKey: 'categories', itemAlias: 'category' },
        children: [
          { id: 'category-name', type: 'text', props: { content: { type: 'variable', key: 'category.label' } } },
          {
            id: 'inner',
            type: 'collection',
            props: { sourceKey: 'category.products', itemAlias: 'product' },
            children: [
              { id: 'product-name', type: 'text', props: { content: { type: 'variable', key: 'product.name' } } },
            ],
          },
        ],
      },
    ];
    const context: RuntimeContext = {
      variables: {
        categories: [{ label: 'Fruits', products: [{ name: 'Apple' }, { name: 'Pear' }] }],
      },
    };

    const html = renderToString(<KubuildRenderer document={doc} registry={registry} context={context} />);
    expect(html).toContain('Fruits');
    expect(html).toContain('Apple');
    expect(html).toContain('Pear');
  });

  it('renders contentEditable elements for heading and text in editor mode', () => {
    const doc = createBlankDocument('Inline Edit Test');
    doc.document.children = [
      { id: 'heading-1', type: 'heading', props: { text: 'Direct Heading Edit', level: 1 } },
      { id: 'text-1', type: 'text', props: { content: 'Direct Text Edit' } },
      { id: 'button-1', type: 'button', props: { label: 'Direct Button Edit' } },
    ];

    const editorHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} mode="editor" />
    );
    expect(editorHtml.toLowerCase()).toContain('contenteditable="true"');
    expect(editorHtml).toContain('Direct Heading Edit');
    expect(editorHtml).toContain('Direct Text Edit');
    expect(editorHtml).toContain('Direct Button Edit');

    const runtimeHtml = renderToString(
      <KubuildRenderer document={doc} registry={registry} mode="runtime" />
    );
    expect(runtimeHtml.toLowerCase()).not.toContain('contenteditable="true"');
    expect(runtimeHtml).toContain('Direct Heading Edit');
  });
});
