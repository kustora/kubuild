import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from './renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { Node } from '@kubuild/schema';

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
