import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PanelResizeHandle } from '../src/components/layout/panel-resize-handle';
import { KubuildEditor } from '../src/components/layout/editor';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { TraitsPanel } from '../src/components/panels/traits-panel';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';

describe('PanelResizeHandle & Resizable Panels', () => {
  it('renders PanelResizeHandle with correct separator semantics and testids', () => {
    const htmlLeft = renderToString(
      <PanelResizeHandle
        side="left"
        onResize={() => {}}
        ariaLabel="Resize Inspector Panel"
      />
    );
    expect(htmlLeft).toContain('role="separator"');
    expect(htmlLeft).toContain('aria-orientation="vertical"');
    expect(htmlLeft).toContain('data-testid="panel-resize-handle-left"');
    expect(htmlLeft).toContain('aria-label="Resize Inspector Panel"');

    const htmlRight = renderToString(
      <PanelResizeHandle
        side="right"
        onResize={() => {}}
        ariaLabel="Resize Left Sidebar"
      />
    );
    expect(htmlRight).toContain('data-testid="panel-resize-handle-right"');
    expect(htmlRight).toContain('aria-label="Resize Left Sidebar"');
  });

  it('renders resize handles in KubuildEditor for desktop docked sidebars', () => {
    const registry = createDefaultComponentRegistry();
    const doc = createBlankDocument('Test Document');

    const html = renderToString(
      <KubuildEditor
        registry={registry}
        initialDocument={doc}
      />
    );

    // Should include resize handle for left sidebar and inspector
    expect(html).toContain('data-testid="panel-resize-handle-right"');
    expect(html).toContain('data-testid="panel-resize-handle-left"');
    expect(html).toContain('aria-label="Resize Left Sidebar"');
    expect(html).toContain('aria-label="Resize Inspector Panel"');
  });

  it('renders clean 2-row image preview card in InspectorPanel without overlapping buttons', () => {
    const registry = createDefaultComponentRegistry();
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-1',
        type: 'image',
        props: {
          src: 'https://images.unsplash.com/photo-rock-ocean.jpg',
          alt: 'KUBUILD Platform Graphic',
        },
        styles: { base: {} },
        children: [],
      },
    ];

    const html = renderToString(
      <InspectorPanel
        registry={registry}
        document={doc}
        selectedNodeId="img-1"
      />
    );

    // Verify Image settings section exists
    expect(html).toContain('Image Settings');
    // Verify file display name is rendered
    expect(html).toContain('photo-rock-ocean.jpg');
    // Verify Replace button and Gallery button are rendered in action row
    expect(html).toContain('Replace');
    expect(html).toContain('Gallery');
    expect(html).toContain('Use manual URL');
    expect(html).toContain('KUBUILD Platform Graphic');
  });

  it('renders clean 2-row image preview card in TraitsPanel', () => {
    const registry = createDefaultComponentRegistry();
    const doc = createBlankDocument('Test');
    doc.document.children = [
      {
        id: 'img-1',
        type: 'image',
        props: {
          src: 'https://cdn.example.com/assets/sample-header-bg.png',
          alt: 'Header Image',
        },
        styles: { base: {} },
        children: [],
      },
    ];

    const html = renderToString(
      <TraitsPanel
        registry={registry}
        document={doc}
        selectedNodeId="img-1"
        onCommitTrait={() => {}}
      />
    );

    expect(html).toContain('sample-header-bg.png');
    expect(html).toContain('Replace');
    expect(html).toContain('Use manual URL');
  });
});
