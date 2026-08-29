import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { Node } from '@kubuild/schema';

/**
 * STORA-213: Image Alt Text & Lazy Loading Traits
 *
 * Acceptance criteria: the rendered <img> tag carries a semantic `alt`
 * attribute and `loading="lazy"` by default (with `eager` opt-in via the
 * loading trait).
 */
describe('STORA-213: Image Alt Text & Lazy Loading', () => {
  const registry = createDefaultComponentRegistry();

  const renderNode = (node: Node): string => {
    const doc = createBlankDocument('Image Traits Test');
    doc.document.children = [node];
    return renderToString(<KubuildRenderer document={doc} registry={registry} />);
  };

  it('renders <img> with alt attribute and loading="lazy" by default', () => {
    const html = renderNode({
      id: 'img-default',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'A scenic mountain view' },
    });

    expect(html).toContain('<img');
    expect(html).toContain('alt="A scenic mountain view"');
    expect(html).toContain('loading="lazy"');
  });

  it('renders loading="eager" when the trait is set to eager', () => {
    const html = renderNode({
      id: 'img-eager',
      type: 'image',
      props: { src: 'https://example.com/hero.jpg', alt: 'Hero banner', loading: 'eager' },
    });

    expect(html).toContain('loading="eager"');
    expect(html).not.toContain('loading="lazy"');
  });

  it('renders loading="lazy" when explicitly set', () => {
    const html = renderNode({
      id: 'img-lazy',
      type: 'image',
      props: { src: 'https://example.com/below-fold.jpg', alt: 'Below fold image', loading: 'lazy' },
    });

    expect(html).toContain('loading="lazy"');
  });

  it('marks decorative images (empty alt) with role="presentation"', () => {
    const html = renderNode({
      id: 'img-decorative',
      type: 'image',
      props: { src: 'https://example.com/divider.png', alt: '' },
    });

    expect(html).toContain('role="presentation"');
    expect(html).toContain('loading="lazy"');
  });

  it('image definition declares alt and loading traits', () => {
    const imageDef = registry.get('image');
    expect(imageDef?.traits).toBeDefined();

    const altTrait = imageDef?.traits?.find((t) => t.name === 'alt');
    const loadingTrait = imageDef?.traits?.find((t) => t.name === 'loading');

    expect(altTrait).toBeDefined();
    expect(altTrait?.required).toBe(true);
    expect(altTrait?.attribute).toBe('alt');

    expect(loadingTrait).toBeDefined();
    expect(loadingTrait?.type).toBe('select');
    expect(loadingTrait?.defaultValue).toBe('lazy');
    expect(loadingTrait?.attribute).toBe('loading');
    expect(loadingTrait?.options?.map((o) => o.value)).toEqual(['lazy', 'eager']);
  });
});
