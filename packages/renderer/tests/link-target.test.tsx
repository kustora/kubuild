import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { Node } from '@kubuild/schema';

/**
 * STORA-212: Link & Target Control (Button & Links)
 *
 * Acceptance criteria: Button and link apply `target="_blank"` when the
 * "Open in new tab" toggle is enabled (i.e. the `target` trait is set to
 * `_blank`), and the renderer auto-adds `rel="noopener noreferrer"` for
 * security when no explicit rel is provided.
 */
describe('STORA-212: Link & Target Control', () => {
  const registry = createDefaultComponentRegistry();

  const renderNode = (node: Node): string => {
    const doc = createBlankDocument('Target Test');
    doc.document.children = [node];
    return renderToString(<KubuildRenderer document={doc} registry={registry} />);
  };

  describe('link component', () => {
    it('applies target="_blank" when the trait is set', () => {
      const html = renderNode({
        id: 'link-blank',
        type: 'link',
        props: { text: 'External', href: 'https://example.com', target: '_blank' },
      });

      expect(html).toContain('target="_blank"');
      expect(html).toContain('href="https://example.com"');
    });

    it('auto-adds rel="noopener noreferrer" with target="_blank" when rel is unset', () => {
      const html = renderNode({
        id: 'link-auto-rel',
        type: 'link',
        props: { text: 'External', href: 'https://example.com', target: '_blank' },
      });

      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('respects an explicit rel value instead of the default', () => {
      const html = renderNode({
        id: 'link-explicit-rel',
        type: 'link',
        props: { text: 'External', href: 'https://example.com', target: '_blank', rel: 'external' },
      });

      expect(html).toContain('rel="external"');
      expect(html).not.toContain('rel="noopener noreferrer"');
    });

    it('does not set target when the trait is absent', () => {
      const html = renderNode({
        id: 'link-same-tab',
        type: 'link',
        props: { text: 'Internal', href: '/about' },
      });

      expect(html).not.toContain('target=');
    });
  });

  describe('button component', () => {
    it('renders as <a> with target="_blank" when href + target traits are set', () => {
      const html = renderNode({
        id: 'button-blank',
        type: 'button',
        props: { label: 'Go', href: 'https://example.com', target: '_blank' },
      });

      expect(html).toContain('<a');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('href="https://example.com"');
    });

    it('auto-adds rel="noopener noreferrer" on button links with target="_blank"', () => {
      const html = renderNode({
        id: 'button-auto-rel',
        type: 'button',
        props: { label: 'Go', href: 'https://example.com', target: '_blank' },
      });

      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('renders as <button> (no target) when no href is set', () => {
      const html = renderNode({
        id: 'button-plain',
        type: 'button',
        props: { label: 'Go', target: '_blank' },
      });

      expect(html).toContain('<button');
      expect(html).not.toContain('target=');
    });

    it('does not set target when the trait is absent', () => {
      const html = renderNode({
        id: 'button-same-tab',
        type: 'button',
        props: { label: 'Go', href: '/pricing' },
      });

      expect(html).not.toContain('target=');
    });
  });
});
