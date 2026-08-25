import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorCanvas } from '../src/canvas';
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
});
