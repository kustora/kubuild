import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { LayersPanel } from '../src/components/panels/layers-panel';
import { LeftSidebar } from '../src/components/panels/left-sidebar';
import { EditorToolbar } from '../src/components/layout/toolbar';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { useEditorStore } from '../src/store';

describe('LayersPanel', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Layers Panel Test'));
  });

  it('renders the layer tree inline, with no floating/docked window chrome', () => {
    const html = renderToString(<LayersPanel registry={registry} />);

    expect(html).toContain('layers-panel');
    expect(html).toContain('data-kubuild-layer');
    // The old Navigator window chrome is gone — visibility belongs to the host.
    expect(html).not.toContain('Hide Navigator');
    expect(html).not.toContain('Make floating');
  });

  it('shows the layer tree in the sidebar "Layers" tab', () => {
    const html = renderToString(
      <LeftSidebar registry={registry} defaultTab="layers" />
    );

    expect(html).toContain('tabpanel-layers');
    expect(html).toContain('data-kubuild-layer');
  });

  it('no longer renders a Navigator toggle in the toolbar', () => {
    const html = renderToString(<EditorToolbar registry={registry} />);

    expect(html).not.toContain('Navigator');
  });
});
