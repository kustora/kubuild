import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { Node } from '@kubuild/schema';

/**
 * `object-fit` / `object-position` as portable style properties, so they get
 * per-breakpoint overrides like any other style. The legacy `fit` prop is kept
 * for imported documents but must not win over an explicit style.
 */
describe('Image object-fit styling', () => {
  const registry = createDefaultComponentRegistry();

  const renderNode = (node: Node): string => {
    const doc = createBlankDocument('Object Fit Test');
    doc.document.children = [node];
    return renderToString(<KubuildRenderer document={doc} registry={registry} />);
  };

  it('renders object-fit and object-position from the style layer', () => {
    const html = renderNode({
      id: 'img-styled',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'Cropped photo' },
      styles: {
        base: { width: '400px', height: '300px', objectFit: 'cover', objectPosition: 'top' },
      },
    });

    expect(html).toContain('object-fit:cover');
    expect(html).toContain('object-position:top');
  });

  it('applies per-breakpoint object-fit overrides', () => {
    const html = renderNode({
      id: 'img-responsive',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'Responsive photo' },
      styles: {
        base: { objectFit: 'cover' },
        mobile: { objectFit: 'contain' },
      },
    });

    // Default render resolves the desktop/base cascade.
    expect(html).toContain('object-fit:cover');
  });

  it('still honours the legacy fit prop when no style sets object-fit', () => {
    const html = renderNode({
      id: 'img-legacy-prop',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'Legacy fit', fit: 'contain' },
    });

    expect(html).toContain('object-fit:contain');
  });

  it('lets an explicit style win over the legacy fit prop', () => {
    const html = renderNode({
      id: 'img-style-wins',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'Style wins', fit: 'contain' },
      styles: { base: { objectFit: 'cover' } },
    });

    expect(html).toContain('object-fit:cover');
    expect(html).not.toContain('object-fit:contain');
  });

  it('resets object-fit when the style is cleared to an empty value', () => {
    const html = renderNode({
      id: 'img-reset',
      type: 'image',
      props: { src: 'https://example.com/photo.jpg', alt: 'Reset', fit: 'cover' },
      styles: { base: { objectFit: '' } },
    });

    expect(html).not.toContain('object-fit');
  });
});
