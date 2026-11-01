import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  KubuildEditor,
  InspectorPanel,
  EditorCanvas,
  resolveEditorConfig,
  SIMPLE_MODE_ALLOWED_COMPONENTS,
  useEditorStore,
} from '../src/index.js';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { starterPageFixture } from '@kubuild/schema';

describe('Editor Mode (Simple | Advance)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    useEditorStore.getState().setDocument(starterPageFixture);
    useEditorStore.getState().setEditorMode('advance');
  });

  it('resolves Simple mode defaults while preserving backward-compatible Advance mode default', () => {
    const defaultResolved = resolveEditorConfig();
    expect(defaultResolved.mode).toBe('advance');
    expect(defaultResolved.sidebar.availableTabs).toEqual(['components', 'blocks', 'layers']);
    expect(defaultResolved.toolbar.showClipboard).toBe(true);
    expect(defaultResolved.toolbar.showCodeViewer).toBe(true);
    expect(defaultResolved.toolbar.showTracking).toBe(true);
    expect(defaultResolved.canvas.showBreadcrumbs).toBe(true);

    const simpleResolved = resolveEditorConfig(undefined, 'simple');
    expect(simpleResolved.mode).toBe('simple');
    expect(simpleResolved.sidebar.availableTabs).toEqual(['blocks', 'components']);
    expect(simpleResolved.sidebar.defaultTab).toBe('blocks');
    expect(simpleResolved.sidebar.allowedComponents).toEqual([...SIMPLE_MODE_ALLOWED_COMPONENTS]);
    expect(simpleResolved.toolbar.showModeSwitcher).toBe(true);
    expect(simpleResolved.toolbar.showClipboard).toBe(false);
    expect(simpleResolved.toolbar.showExportImport).toBe(false);
    expect(simpleResolved.toolbar.showCodeViewer).toBe(false);
    expect(simpleResolved.toolbar.showTracking).toBe(false);
    expect(simpleResolved.toolbar.showSelectionStatus).toBe(false);
    expect(simpleResolved.canvas.showBreadcrumbs).toBe(false);
    expect(simpleResolved.inspector.showTraits).toBe(false);
    expect(simpleResolved.inspector.showStateSelector).toBe(false);
  });

  it('allows explicit host config overrides on top of Simple mode defaults', () => {
    const resolved = resolveEditorConfig(
      {
        mode: 'simple',
        toolbar: {
          showCodeViewer: true,
          showExportImport: true,
        },
        canvas: {
          showBreadcrumbs: true,
        },
      },
      'simple',
    );

    expect(resolved.mode).toBe('simple');
    expect(resolved.toolbar.showCodeViewer).toBe(true);
    expect(resolved.toolbar.showExportImport).toBe(true);
    expect(resolved.toolbar.showClipboard).toBe(false);
    expect(resolved.canvas.showBreadcrumbs).toBe(true);
  });

  it('renders streamlined toolbar, sidebar, and canvas chrome in Simple mode', () => {
    const html = renderToString(
      <KubuildEditor
        registry={registry}
        initialDocument={starterPageFixture}
        mode="simple"
      />,
    );

    // Mode switcher is rendered with Simple active
    expect(html).toContain('data-editor-mode="simple"');
    expect(html).toContain('data-testid="editor-mode-switcher"');
    expect(html).toContain('data-testid="editor-mode-simple"');
    expect(html).toContain('data-testid="editor-mode-advance"');

    // Sidebar hides Layers tab and renders Blocks before Components
    expect(html).toContain('data-testid="tab-blocks"');
    expect(html).toContain('data-testid="tab-components"');
    expect(html).not.toContain('data-testid="tab-layers"');
    expect(html.indexOf('data-testid="tab-blocks"')).toBeLessThan(
      html.indexOf('data-testid="tab-components"'),
    );

    // Toolbar hides technical buttons in Simple mode
    expect(html).not.toContain('data-testid="toolbar-copy"');
    expect(html).not.toContain('data-testid="toolbar-paste"');
    expect(html).not.toContain('View Code');
    expect(html).not.toContain('Export .stora');
    expect(html).not.toContain('data-testid="toolbar-tracking-btn"');
    expect(html).not.toContain('data-testid="multi-device-toolbar-toggle"');
    expect(html).not.toContain('>tablet<');

    // Essential controls remain visible
    expect(html).toContain('>desktop<');
    expect(html).toContain('>mobile<');
    expect(html).toContain('Preview');

    // Canvas zoom toolbar is compact (no Hand tool or 50%/75%/150% presets)
    expect(html).toContain('data-testid="canvas-zoom-toolbar"');
    expect(html).not.toContain('data-testid="tool-mode-hand"');
    expect(html).not.toContain('data-testid="zoom-preset-50"');
    expect(html).not.toContain('data-testid="zoom-multi-device-toggle"');
  });

  it('renders only the active page artboard on canvas in Simple mode when multiple pages exist', () => {
    const pages = [
      { id: 'page-home', name: 'Home', slug: '/', document: starterPageFixture },
      { id: 'page-about', name: 'About', slug: '/about', document: starterPageFixture },
    ];

    const simpleHtml = renderToString(
      <EditorCanvas
        registry={registry}
        pages={pages}
        activePageId="page-home"
        mode="simple"
      />,
    );
    expect(simpleHtml).toContain('data-testid="canvas-artboard-slot-page-home"');
    expect(simpleHtml).not.toContain('data-testid="canvas-artboard-slot-page-about"');

    const advanceHtml = renderToString(
      <EditorCanvas
        registry={registry}
        pages={pages}
        activePageId="page-home"
        mode="advance"
      />,
    );
    expect(advanceHtml).toContain('data-testid="canvas-artboard-slot-page-home"');
    expect(advanceHtml).toContain('data-testid="canvas-artboard-slot-page-about"');
  });

  it('renders unified Simple Inspector without technical Action/Pixel/CSS accordion cards in Simple mode', () => {
    const simpleInspectorHtml = renderToString(
      <InspectorPanel
        registry={registry}
        document={starterPageFixture}
        selectedNodeId="hero-heading"
        mode="simple"
      />,
    );

    // Simple appearance section & switch-to-advance hint are present
    expect(simpleInspectorHtml).toContain('data-testid="simple-appearance-section"');
    expect(simpleInspectorHtml).toContain('data-testid="inspector-switch-to-advance"');

    // Technical cards are hidden in Simple mode
    expect(simpleInspectorHtml).not.toContain('data-testid="open-action-builder-btn"');
    expect(simpleInspectorHtml).not.toContain('data-testid="open-pixel-tracking-btn"');
    expect(simpleInspectorHtml).not.toContain('Event Pixel');
    expect(simpleInspectorHtml).not.toContain('id="style-state-selector"');

    // Advance mode inspector still renders full technical controls
    const advanceInspectorHtml = renderToString(
      <InspectorPanel
        registry={registry}
        document={starterPageFixture}
        selectedNodeId="hero-heading"
        mode="advance"
      />,
    );
    expect(advanceInspectorHtml).toContain('data-testid="open-action-builder-btn"');
    expect(advanceInspectorHtml).toContain('data-testid="open-pixel-tracking-btn"');
    expect(advanceInspectorHtml).toContain('id="style-state-selector"');
    expect(advanceInspectorHtml).not.toContain('data-testid="simple-appearance-section"');
  });

  it('updates store editorMode and exits multiDeviceMode when switching to Simple mode', () => {
    const store = useEditorStore.getState();
    store.setMultiDeviceMode(true);
    expect(useEditorStore.getState().multiDeviceMode).toBe(true);

    store.setEditorMode('simple');
    expect(useEditorStore.getState().editorMode).toBe('simple');
    expect(useEditorStore.getState().multiDeviceMode).toBe(false);

    store.setEditorMode('advance');
    expect(useEditorStore.getState().editorMode).toBe('advance');
  });
});
