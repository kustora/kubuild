import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from '../src/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument } from '@kubuild/schema';

describe('STORA-083: Renderer Security & XSS Defense Suite', () => {
  const registry = createDefaultComponentRegistry();

  it('sanitizes dangerous javascript: URLs in button href attributes', () => {
    const maliciousDoc: PageDocument = {
      schema: 'stora.page',
      version: '1.0.0',
      document: {
        id: 'root-page',
        type: 'page',
        children: [
          {
            id: 'malicious-btn',
            type: 'button',
            props: {
              label: 'Click for Free Prize',
              href: 'javascript:alert(document.cookie)',
            },
          },
        ],
      },
    };

    const html = renderToString(<KubuildRenderer document={maliciousDoc} registry={registry} />);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
    expect(html).toContain('Click for Free Prize');
  });

  it('sanitizes dangerous javascript: or data:text/html URLs in image src attributes', () => {
    const maliciousDoc: PageDocument = {
      schema: 'stora.page',
      version: '1.0.0',
      document: {
        id: 'root-page',
        type: 'page',
        children: [
          {
            id: 'malicious-img',
            type: 'image',
            props: {
              src: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
              alt: 'Hacked Image',
            },
          },
          {
            id: 'js-img',
            type: 'image',
            props: {
              src: 'javascript:alert("img-xss")',
              alt: 'JS Script Image',
            },
          },
        ],
      },
    };

    const html = renderToString(<KubuildRenderer document={maliciousDoc} registry={registry} />);
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('javascript:');
  });

  it('renders legitimate safe URLs correctly without interference', () => {
    const safeDoc: PageDocument = {
      schema: 'stora.page',
      version: '1.0.0',
      document: {
        id: 'root-page',
        type: 'page',
        children: [
          {
            id: 'safe-btn',
            type: 'button',
            props: {
              label: 'Official Website',
              href: 'https://kustora.com/about',
            },
          },
          {
            id: 'safe-img',
            type: 'image',
            props: {
              src: 'https://cdn.kustora.com/assets/logo.png',
              alt: 'KUBUILD Logo',
            },
          },
        ],
      },
    };

    const html = renderToString(<KubuildRenderer document={safeDoc} registry={registry} />);
    expect(html).toContain('href="https://kustora.com/about"');
    expect(html).toContain('src="https://cdn.kustora.com/assets/logo.png"');
    expect(html).toContain('alt="KUBUILD Logo"');
  });
});
