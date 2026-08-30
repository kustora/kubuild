import { describe, it, expect } from 'vitest';
import { createBlankDocument } from '@kubuild/core';
import {
  generateSemanticHtml,
  generateDocumentCss,
  generateStandaloneHtml,
} from '../src/code-generator';
import { ResponsiveStyles } from '@kubuild/schema';

describe('Live Code Generator (STORA-251)', () => {
  it('generates clean semantic HTML structure for basic layout & typography', () => {
    const doc = createBlankDocument('Test Page');
    if (doc.metadata) {
      doc.metadata.description = 'A test page description';
    }
    doc.document.styles = { base: { backgroundColor: '#ffffff' } };
    doc.document.children = [
      {
        id: 'sec-1',
        type: 'section',
        props: { ariaLabel: 'Main Hero' },
        children: [
          {
            id: 'head-1',
            type: 'heading',
            props: { level: 1, text: 'Hello World' },
          },
          {
            id: 'para-1',
            type: 'paragraph',
            props: { text: 'This is a clean semantic paragraph.' },
          },
          {
            id: 'btn-1',
            type: 'button',
            props: { label: 'Get Started', type: 'button' },
          },
        ],
      },
    ];

    const html = generateSemanticHtml(doc);
    expect(html).toContain('<main class="kb-page kb-node-root-page">');
    expect(html).toContain('<section class="kb-section kb-node-sec-1" aria-label="Main Hero">');
    expect(html).toContain('<h1 class="kb-heading kb-node-head-1">Hello World</h1>');
    expect(html).toContain('<p class="kb-paragraph kb-node-para-1">This is a clean semantic paragraph.</p>');
    expect(html).toContain('<button class="kb-button kb-node-btn-1" type="button">Get Started</button>');
    expect(html).toContain('</main>');
  });

  it('generates semantic elements for forms, links, media, blockquote, and tables', () => {
    const doc = createBlankDocument('Complex Elements');
    doc.document.children = [
      {
        id: 'quote-1',
        type: 'blockquote',
        props: { quote: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra', cite: 'https://example.com' },
      },
      {
        id: 'link-1',
        type: 'link',
        props: { href: 'https://kustora.com', target: '_blank', text: 'Visit KUBUILD' },
      },
      {
        id: 'code-1',
        type: 'code-block',
        props: { code: 'const a = 10;', language: 'typescript' },
      },
      {
        id: 'img-1',
        type: 'image',
        props: { src: 'https://example.com/img.jpg', alt: 'Test Image', loading: 'lazy' },
      },
      {
        id: 'form-1',
        type: 'form',
        props: { action: '/submit', method: 'POST' },
        children: [
          {
            id: 'input-1',
            type: 'input',
            props: { name: 'email', type: 'email', placeholder: 'Enter email', required: true },
          },
          {
            id: 'select-1',
            type: 'select',
            props: {
              name: 'plan',
              options: [
                { value: 'free', label: 'Free Tier' },
                { value: 'pro', label: 'Pro Tier' },
              ],
              value: 'pro',
            },
          },
        ],
      },
      {
        id: 'table-1',
        type: 'table',
        children: [
          {
            id: 'row-1',
            type: 'table-row',
            children: [
              { id: 'cell-1', type: 'table-cell', props: { isHeader: true, text: 'Feature' } },
              { id: 'cell-2', type: 'table-cell', props: { isHeader: true, text: 'Status' } },
            ],
          },
          {
            id: 'row-2',
            type: 'table-row',
            children: [
              { id: 'cell-3', type: 'table-cell', props: { text: 'Live Code Viewer' } },
              { id: 'cell-4', type: 'table-cell', props: { text: 'Ready' } },
            ],
          },
        ],
      },
      {
        id: 'list-1',
        type: 'list',
        props: { tag: 'ol' },
        children: [
          { id: 'item-1', type: 'list-item', props: { text: 'First Step' } },
          { id: 'item-2', type: 'list-item', props: { text: 'Second Step' } },
        ],
      },
    ];

    const html = generateSemanticHtml(doc);
    expect(html).toContain('<blockquote class="kb-blockquote kb-node-quote-1" cite="https://example.com">');
    expect(html).toContain('<p>Simplicity is prerequisite for reliability.</p>');
    expect(html).toContain('<cite>Edsger W. Dijkstra</cite>');
    expect(html).toContain('<a class="kb-link kb-node-link-1" href="https://kustora.com" target="_blank" rel="noopener noreferrer">Visit KUBUILD</a>');
    expect(html).toContain('<pre class="kb-code-block kb-node-code-1"><code class="language-typescript">const a = 10;</code></pre>');
    expect(html).toContain('<img class="kb-image kb-node-img-1" src="https://example.com/img.jpg" alt="Test Image" loading="lazy" />');
    expect(html).toContain('<form class="kb-form kb-node-form-1" action="/submit" method="POST">');
    expect(html).toContain('<input class="kb-input kb-node-input-1" type="email" name="email" placeholder="Enter email" required />');
    expect(html).toContain('<select class="kb-select kb-node-select-1" name="plan">');
    expect(html).toContain('<option value="pro" selected>Pro Tier</option>');
    expect(html).toContain('<table class="kb-table kb-node-table-1">');
    expect(html).toContain('<th class="kb-table-cell kb-node-cell-1">Feature</th>');
    expect(html).toContain('<td class="kb-table-cell kb-node-cell-3">Live Code Viewer</td>');
    expect(html).toContain('<ol class="kb-list kb-node-list-1">');
    expect(html).toContain('<li class="kb-list-item kb-node-item-1">First Step</li>');
  });

  it('generates structured CSS with base styles, responsive media queries, and hover states', () => {
    const doc = createBlankDocument('CSS Styles');
    const heroStyles: ResponsiveStyles = {
      base: { backgroundColor: '#0f172a', padding: '40px', display: 'flex' },
      tablet: { padding: '24px' },
      mobile: { padding: '16px', flexDirection: 'column' },
      states: {
        ':hover': { backgroundColor: '#1e293b' },
      },
    };
    const btnStyles: ResponsiveStyles = {
      base: { backgroundColor: '#3b82f6', color: '#ffffff' },
      states: {
        ':hover': { backgroundColor: '#2563eb' },
        ':active': { transform: 'scale(0.98)' },
      },
    };

    doc.document.children = [
      {
        id: 'hero-1',
        type: 'section',
        styles: heroStyles,
        children: [
          {
            id: 'btn-cta',
            type: 'button',
            props: { label: 'Click Me' },
            styles: btnStyles,
          },
        ],
      },
    ];

    const css = generateDocumentCss(doc);
    expect(css).toContain('.kb-node-hero-1 {');
    expect(css).toContain('background-color: #0f172a;');
    expect(css).toContain('padding: 40px;');
    expect(css).toContain('.kb-node-btn-cta {');
    expect(css).toContain('background-color: #3b82f6;');
    expect(css).toContain('.kb-node-hero-1:hover {');
    expect(css).toContain('.kb-node-btn-cta:hover {');
    expect(css).toContain('.kb-node-btn-cta:active {');
    expect(css).toContain('@media (max-width: 1024px) {');
    expect(css).toContain('@media (max-width: 640px) {');
  });

  it('generates standalone HTML document with complete doctype and meta tags', () => {
    const doc = createBlankDocument('Awesome Landing Page');
    if (doc.metadata) {
      doc.metadata.description = 'Landing page built with KUBUILD';
      doc.metadata.author = 'KUBUILD Team';
    }

    const standalone = generateStandaloneHtml(doc);
    expect(standalone).toContain('<!DOCTYPE html>');
    expect(standalone).toContain('<html lang="en">');
    expect(standalone).toContain('<title>Awesome Landing Page</title>');
    expect(standalone).toContain('<meta name="description" content="Landing page built with KUBUILD">');
    expect(standalone).toContain('<meta name="author" content="KUBUILD Team">');
    expect(standalone).toContain('<style>');
    expect(standalone).toContain('</style>');
    expect(standalone).toContain('<body>');
    expect(standalone).toContain('</body>');
    expect(standalone).toContain('</html>');
  });
});

