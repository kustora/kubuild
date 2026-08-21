import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { KubuildRenderer } from './renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';

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
