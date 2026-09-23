import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import type { Node, PageDocument } from '@kubuild/schema';
import type { RenderContext } from '@kubuild/core';

describe('Image Variable Binding and Fallback / Placeholder Behavior', () => {
  const registry = createDefaultComponentRegistry();

  const renderDoc = (
    doc: PageDocument,
    context?: RenderContext,
    mode: 'editor' | 'runtime' = 'runtime',
  ): string => {
    return renderToString(
      <KubuildRenderer document={doc} registry={registry} context={context} mode={mode} />,
    );
  };

  it('renders image src when bound to a nested variable resolving to a valid URL', () => {
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-1',
        type: 'image',
        props: {
          src: { type: 'variable', key: 'product.imageUrl' },
          alt: 'Product image',
        },
      },
    ];

    const context: RenderContext = {
      variables: {
        product: {
          imageUrl: 'https://images.unsplash.com/photo-test-123',
        },
      },
    };

    const html = renderDoc(doc, context);
    expect(html).toContain('<img');
    expect(html).toContain('src="https://images.unsplash.com/photo-test-123"');
    expect(html).toContain('alt="Product image"');
  });

  it('renders image src when bound to a flat key in context.variables', () => {
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-flat',
        type: 'image',
        props: {
          src: { type: 'variable', key: 'product.imageUrl' },
          alt: 'Flat key product',
        },
      },
    ];

    const context: RenderContext = {
      variables: {
        'product.imageUrl': 'https://images.unsplash.com/photo-flat-456',
      },
    };

    const html = renderDoc(doc, context);
    expect(html).toContain('src="https://images.unsplash.com/photo-flat-456"');
  });

  it('uses author fallback when variable resolves to an empty string', () => {
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-fallback',
        type: 'image',
        props: {
          src: {
            type: 'variable',
            key: 'product.imageUrl',
            fallback: 'https://example.com/fallback-product.jpg',
          },
          alt: 'Fallback product',
        },
      },
    ];

    // Variable exists with empty string (as in catalog sampleValue: "")
    const context: RenderContext = {
      variables: {
        product: {
          imageUrl: '',
        },
      },
    };

    const html = renderDoc(doc, context);
    expect(html).toContain('src="https://example.com/fallback-product.jpg"');
  });

  it('renders a valid data-URI placeholder in editor mode when bound to an empty variable with no fallback', () => {
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-editor-bound',
        type: 'image',
        props: {
          src: {
            type: 'variable',
            key: 'product.imageUrl',
          },
          alt: 'Bound empty product',
        },
      },
    ];

    // Variable resolves to empty string (sample: "")
    const context: RenderContext = {
      variables: {
        product: {
          imageUrl: '',
        },
      },
    };

    const html = renderDoc(doc, context, 'editor');
    // Crucial check: <img> MUST have a src attribute in DOM!
    expect(html).toContain('src="data:image/svg+xml');
    // Should display the variable key in the placeholder SVG
    expect(decodeURIComponent(html)).toContain('{product.imageUrl}');
  });

  it('renders a valid fallback src in editor mode when image src is completely empty or missing', () => {
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-empty-static',
        type: 'image',
        props: {
          src: '',
          alt: 'Empty src image',
        },
      },
    ];

    const html = renderDoc(doc, undefined, 'editor');
    // Ensure src attribute is present, not omitted
    expect(html).toContain('src=');
    expect(html).not.toMatch(/<img(?![^>]*\bsrc=)[^>]*>/);
  });

  it('resolves image binding inside a collection repeater scope', () => {
    const doc = createBlankDocument('Collection Test');
    doc.document.children = [
      {
        id: 'col-1',
        type: 'collection',
        props: {
          sourceKey: 'products',
          itemAlias: 'item',
        },
        children: [
          {
            id: 'item-img',
            type: 'image',
            props: {
              src: { type: 'variable', key: 'item.imageUrl' },
              alt: 'Item image',
            },
          },
        ],
      },
    ];

    const context: RenderContext = {
      variables: {
        products: [
          { id: 1, imageUrl: 'https://cdn.example.com/p1.png' },
          { id: 2, imageUrl: 'https://cdn.example.com/p2.png' },
        ],
      },
    };

    const html = renderDoc(doc, context);
    expect(html).toContain('src="https://cdn.example.com/p1.png"');
    expect(html).toContain('src="https://cdn.example.com/p2.png"');
  });
});
