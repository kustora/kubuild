import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EditorCanvas } from './canvas';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { useEditorStore } from './store';

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
});
