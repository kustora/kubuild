import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from './renderer';
import { resolveNodeStyles } from './styles';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument, starterPageFixture } from '@kubuild/schema';

describe('STORA-084: Visual & Responsive Multi-Viewport Baseline Suite', () => {
  const registry = createDefaultComponentRegistry();

  const collectionFixture: PageDocument = {
    schema: 'stora.page',
    version: '1.0.0',
    metadata: {
      title: 'Product Catalog Collection',
      description: 'Collection grid with responsive columns and cards',
      author: 'KUBUILD Team',
      tags: ['catalog', 'collection', 'e-commerce'],
      category: 'ecommerce',
      version: '1.0.0',
    },
    document: {
      id: 'root-page',
      type: 'page',
      styles: {
        base: { backgroundColor: '#ffffff', minHeight: '100vh' },
      },
      children: [
        {
          id: 'catalog-section',
          type: 'section',
          styles: {
            base: { padding: '48px 24px' },
            tablet: { padding: '32px 16px' },
            mobile: { padding: '20px 12px' },
          },
          children: [
            {
              id: 'catalog-container',
              type: 'container',
              styles: {
                base: { maxWidth: '1200px', margin: '0 auto' },
              },
              children: [
                {
                  id: 'catalog-grid',
                  type: 'columns',
                  styles: {
                    base: {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      gap: '24px',
                    },
                    tablet: {
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '16px',
                    },
                    mobile: {
                      gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                      gap: '12px',
                    },
                  },
                  children: [
                    {
                      id: 'card-1',
                      type: 'container',
                      styles: {
                        base: {
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                        },
                        mobile: {
                          padding: '14px',
                        },
                      },
                      children: [
                        {
                          id: 'card-1-heading',
                          type: 'heading',
                          props: { text: 'Product 1', level: 3 },
                          styles: {
                            base: { fontSize: '20px', fontWeight: '600', color: '#1e293b' },
                            mobile: { fontSize: '16px' },
                          },
                        },
                        {
                          id: 'card-1-btn',
                          type: 'button',
                          props: { label: 'View Details' },
                          styles: {
                            base: {
                              display: 'inline-block',
                              padding: '10px 18px',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              borderRadius: '6px',
                              fontSize: '14px',
                            },
                            mobile: {
                              width: '100%',
                              padding: '12px',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  describe('1. Starter Page Viewport Cascading Baseline', () => {
    it('resolves desktop styles correctly for starter page', () => {
      const heroHeadingNode = starterPageFixture.document.children?.[0]?.children?.[0]?.children?.[0];
      expect(heroHeadingNode).toBeDefined();
      if (!heroHeadingNode) return;

      const desktopStyles = resolveNodeStyles(heroHeadingNode.styles, 'desktop');
      expect(desktopStyles.fontSize).toBe('48px');
      expect(desktopStyles.fontWeight).toBe('800');

      const html = renderToString(
        <KubuildRenderer document={starterPageFixture} registry={registry} viewport="desktop" />
      );
      expect(html).toContain('font-size:48px');
      expect(html).toContain('font-weight:800');
    });

    it('resolves tablet styles correctly for starter page', () => {
      const html = renderToString(
        <KubuildRenderer document={starterPageFixture} registry={registry} viewport="tablet" />
      );
      expect(html).toContain('font-size:48px');
    });

    it('resolves mobile styles correctly for starter page', () => {
      const heroHeadingNode = starterPageFixture.document.children?.[0]?.children?.[0]?.children?.[0];
      expect(heroHeadingNode).toBeDefined();
      if (!heroHeadingNode) return;

      const mobileStyles = resolveNodeStyles(heroHeadingNode.styles, 'mobile');
      expect(mobileStyles.fontSize).toBe('32px');

      const html = renderToString(
        <KubuildRenderer document={starterPageFixture} registry={registry} viewport="mobile" />
      );
      expect(html).toContain('font-size:32px');
    });
  });

  describe('2. Collection & Grid Multi-Viewport Responsive Baseline', () => {
    it('applies 3-column grid layout on desktop viewport', () => {
      const html = renderToString(
        <KubuildRenderer document={collectionFixture} registry={registry} viewport="desktop" />
      );

      expect(html).toContain('padding:48px 24px');
      expect(html).toContain('grid-template-columns:repeat(3, minmax(0, 1fr))');
      expect(html).toContain('gap:24px');
      expect(html).toContain('padding:20px');
      expect(html).toContain('padding:10px 18px');
    });

    it('applies 2-column grid layout on tablet viewport', () => {
      const html = renderToString(
        <KubuildRenderer document={collectionFixture} registry={registry} viewport="tablet" />
      );

      expect(html).toContain('padding:32px 16px');
      expect(html).toContain('grid-template-columns:repeat(2, minmax(0, 1fr))');
      expect(html).toContain('gap:16px');
      expect(html).toContain('padding:20px');
    });

    it('applies 1-column stacked layout with full-width button on mobile viewport', () => {
      const html = renderToString(
        <KubuildRenderer document={collectionFixture} registry={registry} viewport="mobile" />
      );

      expect(html).toContain('padding:20px 12px');
      expect(html).toContain('grid-template-columns:repeat(1, minmax(0, 1fr))');
      expect(html).toContain('gap:12px');
      expect(html).toContain('padding:14px');
      expect(html).toContain('font-size:16px');
      expect(html).toContain('width:100%');
      expect(html).toContain('padding:12px');
    });
  });
});
