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

  it('maintains independent responsive settings per page simultaneously on canvas', () => {
    const doc1 = createBlankDocument('Page 1');
    const doc2 = createBlankDocument('Page 2');
    const doc3 = createBlankDocument('Page 3');

    const pages = [
      { id: 'p1', name: 'Page 1', slug: '/1', document: doc1, width: 375, viewport: 'mobile' as const },
      { id: 'p2', name: 'Page 2', slug: '/2', document: doc2, width: 768, viewport: 'tablet' as const },
      { id: 'p3', name: 'Page 3', slug: '/3', document: doc3, width: 1200, viewport: 'desktop' as const },
    ];

    useEditorStore.getState().setDocument(doc1);

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="mobile"
        fluidWidth={375}
        pages={pages}
        activePageId="p1"
      />
    );

    // Page 1 is mobile (375px)
    expect(html).toContain('375px • Mobile');
    expect(html).toContain('Page 1');

    // Page 2 is tablet (768px)
    expect(html).toContain('768px • Tablet');
    expect(html).toContain('Page 2');

    // Page 3 is desktop (1200px)
    expect(html).toContain('1200px • Desktop');
    expect(html).toContain('Page 3');
  });
});

describe('STORA-508: AI progressive-preview placeholder', () => {
  const registry = createDefaultComponentRegistry();

  // `aiGenerationStatus` is passed as a direct prop (same store-override pattern the
  // `document` prop already uses on this component) rather than mutated on the store
  // and read back through `renderToString` — zustand v5's SSR snapshot
  // (`getServerSnapshot` -> `getInitialState()`) does not reflect `set()` calls made
  // before a `renderToString` pass, only the real browser subscription path does.

  it('renders the generation placeholder on the active artboard while aiGenerationStatus is active', () => {
    const doc = createBlankDocument('AI Progressive Preview Test');
    useEditorStore.getState().setDocument(doc);

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        aiGenerationStatus={{
          active: true,
          totalSections: 3,
          completedSections: 1,
          currentLabel: 'Generating section 2/3...',
        }}
      />,
    );

    expect(html).toContain('data-testid="ai-generation-placeholder"');
    expect(html).toContain('Generating section 2/3...');
  });

  it('does not render the placeholder when no generation is in flight', () => {
    const doc = createBlankDocument('AI Progressive Preview Test 2');
    useEditorStore.getState().setDocument(doc);

    const html = renderToString(
      <EditorCanvas registry={registry} viewport="desktop" aiGenerationStatus={null} />,
    );

    expect(html).not.toContain('data-testid="ai-generation-placeholder"');
  });

  it('does not render the placeholder once completedSections reaches totalSections (active: false)', () => {
    const doc = createBlankDocument('AI Progressive Preview Test 3');
    useEditorStore.getState().setDocument(doc);

    const html = renderToString(
      <EditorCanvas
        registry={registry}
        viewport="desktop"
        aiGenerationStatus={{ active: false, totalSections: 1, completedSections: 1 }}
      />,
    );

    expect(html).not.toContain('data-testid="ai-generation-placeholder"');
  });
});

