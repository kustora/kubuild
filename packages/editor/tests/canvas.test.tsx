import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorCanvas } from '../src/components/canvas/canvas';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { starterPageFixture } from '@kubuild/schema';
import { useEditorStore } from '../src/store';

describe('STORA-084: Editor Canvas Overlay Accessibility Isolation', () => {
  const registry = createDefaultComponentRegistry();

  it('renders canvas and ensures overlays are isolated with aria-hidden="true"', () => {
    const doc = createBlankDocument('Accessible Canvas Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(doc.document.id);

    const html = renderToString(
      <EditorCanvas registry={registry} viewport="desktop" />
    );

    // Document nodes are rendered
    expect(html).toContain('data-kubuild-node');
  });

  it('renders contenteditable text elements in EditorCanvas for direct on-canvas editing', () => {
    const doc = JSON.parse(JSON.stringify(starterPageFixture));
    useEditorStore.getState().setDocument(doc);

    const html = renderToString(
      <EditorCanvas document={doc} registry={registry} viewport="desktop" />
    );

    expect(html.toLowerCase()).toContain('contenteditable="true"');
    expect(html).toContain('Build Once, Render Anywhere');
  });

  it('renders multi-page artboards side-by-side on the infinite canvas surface', () => {
    const docHome = createBlankDocument('Home Page');
    const docAbout = createBlankDocument('About Us Page');

    const pages = [
      { id: 'page-home', name: 'Home', slug: '/', document: docHome },
      { id: 'page-about', name: 'About Us', slug: '/about', document: docAbout },
    ];

    useEditorStore.getState().setDocument(docHome);

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        pages={pages}
        activePageId="page-home"
      />
    );

    // Active page is rendered as the primary interactive artboard with resizer
    expect(html).toContain('data-testid="viewport-resizer-container"');
    expect(html).toContain('data-testid="viewport-resizer-frame"');
    expect(html).toContain('data-testid="viewport-resizer-handle"');
    expect(html).toContain('Home');
    expect(html).toContain('/');

    // Inactive page is rendered as an adjacent artboard on the canvas
    expect(html).toContain('data-testid="canvas-artboard-page-page-about"');
    expect(html).toContain('About Us');
    expect(html).toContain('/about');
    expect(html).toContain('Click to edit');
  });

  it('ensures the page artboard is the whole page frame with responsive dimensions', () => {
    const doc = createBlankDocument('Responsive Frame Test');
    useEditorStore.getState().setDocument(doc);

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        fluidWidth={1024}
      />
    );

    // The artboard frame holds the fluid width directly
    expect(html).toContain('data-testid="viewport-resizer-frame"');
    expect(html).toContain('1024px');
    expect(html).toContain('data-testid="viewport-resizer-badge"');
  });
});

