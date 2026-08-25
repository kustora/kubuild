import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument, starterPageFixture } from '@kubuild/schema';

describe('STORA-084: Accessibility Test Suite', () => {
  const registry = createDefaultComponentRegistry();

  describe('Heading Component Accessibility', () => {
    it('renders correct semantic heading levels 1 through 6', () => {
      for (const level of [1, 2, 3, 4, 5, 6]) {
        const doc: PageDocument = {
          schema: 'stora.page',
          version: '1.0.0',
          document: {
            id: 'root-page',
            type: 'page',
            children: [
              {
                id: `heading-${level}`,
                type: 'heading',
                props: { text: `Heading Level ${level}`, level },
              },
            ],
          },
        };

        const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
        expect(html).toContain(`<h${level}`);
        expect(html).toContain(`Heading Level ${level}</h${level}>`);
      }
    });

    it('clamps heading levels outside 1-6 to valid semantic levels', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'heading-low',
              type: 'heading',
              props: { text: 'Clamped Low', level: 0 },
            },
            {
              id: 'heading-high',
              type: 'heading',
              props: { text: 'Clamped High', level: 10 },
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('<h1');
      expect(html).toContain('Clamped Low</h1>');
      expect(html).toContain('<h6');
      expect(html).toContain('Clamped High</h6>');
    });
  });

  describe('Button Component Accessibility', () => {
    it('renders semantic <button type="button"> with proper focus and accessible name', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'btn-1',
              type: 'button',
              props: { label: 'Click Me', ariaLabel: 'Perform Action' },
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('<button');
      expect(html).toContain('type="button"');
      expect(html).toContain('aria-label="Perform Action"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('Click Me</button>');
    });

    it('handles disabled state with aria-disabled and negative tabIndex', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'btn-disabled',
              type: 'button',
              props: { label: 'Disabled Button', disabled: true },
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('<button');
      expect(html).toContain('disabled=""');
      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('tabindex="-1"');
    });

    it('renders semantic <a> link button when href is provided', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'btn-link',
              type: 'button',
              props: { label: 'Visit Docs', href: 'https://docs.kubuild.dev', ariaLabel: 'Open documentation' },
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('<a');
      expect(html).toContain('href="https://docs.kubuild.dev"');
      expect(html).toContain('aria-label="Open documentation"');
      expect(html).toContain('tabindex="0"');
    });
  });

  describe('Image Component Accessibility', () => {
    it('always guarantees an alt attribute', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'img-1',
              type: 'image',
              props: { src: 'https://example.com/photo.jpg', alt: 'A scenic mountain view' },
            },
            {
              id: 'img-decorative',
              type: 'image',
              props: { src: 'https://example.com/decorative-pattern.svg' },
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('alt="A scenic mountain view"');
      expect(html).toContain('loading="lazy"');

      // Decorative image has alt="" and role="presentation"
      expect(html).toContain('alt=""');
      expect(html).toContain('role="presentation"');
    });
  });

  describe('Text and Section Landmarks Accessibility', () => {
    it('renders semantic <p> for text and <section> with optional aria-label', () => {
      const doc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'features-section',
              type: 'section',
              props: { ariaLabel: 'Core Features Section' },
              children: [
                {
                  id: 'body-text',
                  type: 'text',
                  props: { content: 'KUBUILD provides accessible components out of the box.' },
                },
              ],
            },
          ],
        },
      };

      const html = renderToString(<KubuildRenderer document={doc} registry={registry} />);
      expect(html).toContain('<section');
      expect(html).toContain('aria-label="Core Features Section"');
      expect(html).toContain('<p');
      expect(html).toContain('KUBUILD provides accessible components out of the box.</p>');
    });
  });

  describe('Starter Fixture Accessibility Audit', () => {
    it('starterPageFixture has fully compliant heading hierarchy and accessible images', () => {
      const html = renderToString(<KubuildRenderer document={starterPageFixture} registry={registry} />);

      // Has h1
      expect(html).toContain('<h1');
      expect(html).toContain('Build Once, Render Anywhere</h1>');

      // Image has alt
      expect(html).toContain('alt="KUBUILD Platform Graphic"');

      // All buttons/links have tabindex="0"
      expect(html).toContain('tabindex="0"');
    });
  });
});
