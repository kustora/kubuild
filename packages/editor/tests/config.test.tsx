import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument, findNodeById } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { useEditorStore } from '../src/store';
import { KubuildEditor } from '../src/editor';
import { LeftSidebar } from '../src/left-sidebar';
import { InspectorPanel } from '../src/inspector-panel';
import { StyleManagerAccordion } from '../src/style-manager-accordion';
import { resolveEditorConfig } from '../src/config';

describe('Editor Customization & Module Modularity (EditorConfig)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    const doc = createBlankDocument('Custom Config Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(null);
  });

  describe('resolveEditorConfig', () => {
    it('returns default enabled values when no config is provided', () => {
      const resolved = resolveEditorConfig();
      expect(resolved.toolbar.enabled).toBe(true);
      expect(resolved.toolbar.showTitle).toBe(true);
      expect(resolved.toolbar.showHistory).toBe(true);
      expect(resolved.toolbar.showClipboard).toBe(true);
      expect(resolved.toolbar.showCodeViewer).toBe(true);
      expect(resolved.toolbar.showExportImport).toBe(true);
      expect(resolved.toolbar.showViewportSwitcher).toBe(true);
      expect(resolved.toolbar.showSelectionStatus).toBe(true);

      expect(resolved.sidebar.enabled).toBe(true);
      expect(resolved.sidebar.defaultTab).toBe('components');
      expect(resolved.sidebar.availableTabs).toEqual(['components', 'blocks', 'layers']);

      expect(resolved.canvas.showBreadcrumbs).toBe(true);
      expect(resolved.canvas.showFloatingBadges).toBe(true);

      expect(resolved.inspector.enabled).toBe(true);
      expect(resolved.inspector.showProps).toBe(true);
      expect(resolved.inspector.showTraits).toBe(true);
      expect(resolved.inspector.showStyles).toBe(true);
      expect(resolved.inspector.showStateSelector).toBe(true);
      expect(resolved.inspector.allowedStyleSectors).toBeUndefined();
    });

    it('respects boolean false toggles for major sections', () => {
      const resolved = resolveEditorConfig({
        toolbar: false,
        sidebar: false,
        inspector: false,
      });

      expect(resolved.toolbar.enabled).toBe(false);
      expect(resolved.sidebar.enabled).toBe(false);
      expect(resolved.inspector.enabled).toBe(false);
    });

    it('merges granular options correctly', () => {
      const resolved = resolveEditorConfig({
        toolbar: {
          showHistory: false,
          showClipboard: false,
        },
        sidebar: {
          availableTabs: ['components', 'layers'],
          defaultTab: 'layers',
        },
        canvas: {
          showBreadcrumbs: false,
        },
        inspector: {
          showTraits: false,
          allowedStyleSectors: ['typography', 'decorations'],
        },
      });

      expect(resolved.toolbar.enabled).toBe(true);
      expect(resolved.toolbar.showHistory).toBe(false);
      expect(resolved.toolbar.showClipboard).toBe(false);
      expect(resolved.toolbar.showCodeViewer).toBe(true);

      expect(resolved.sidebar.availableTabs).toEqual(['components', 'layers']);
      expect(resolved.sidebar.defaultTab).toBe('layers');

      expect(resolved.canvas.showBreadcrumbs).toBe(false);
      expect(resolved.canvas.showFloatingBadges).toBe(true);

      expect(resolved.inspector.showTraits).toBe(false);
      expect(resolved.inspector.showStyles).toBe(true);
      expect(resolved.inspector.allowedStyleSectors).toEqual(['typography', 'decorations']);
    });
  });

  describe('KubuildEditor Component Rendering with Config', () => {
    it('renders all modules by default', () => {
      const html = renderToString(<KubuildEditor registry={registry} />);

      expect(html).toContain('KUBUILD Editor');
      expect(html).toContain('tab-components');
      expect(html).toContain('tab-blocks');
      expect(html).toContain('tab-layers');
      expect(html).toContain('data-testid="toolbar-copy"');
      expect(html).toContain('data-testid="toolbar-undo"');
      expect(html).toContain('View Code');
      expect(html).toContain('desktop');
      expect(html).toContain('tablet');
      expect(html).toContain('mobile');
      expect(html).toContain('No element selected');
    });

    it('hides top toolbar when toolbar: false', () => {
      const html = renderToString(<KubuildEditor registry={registry} config={{ toolbar: false }} />);

      expect(html).not.toContain('KUBUILD Editor');
      expect(html).not.toContain('data-testid="toolbar-copy"');
      expect(html).not.toContain('data-testid="toolbar-undo"');
      // Sidebar should still be rendered
      expect(html).toContain('tab-components');
    });

    it('hides sidebar when sidebar: false', () => {
      const html = renderToString(<KubuildEditor registry={registry} config={{ sidebar: false }} />);

      expect(html).not.toContain('tab-components');
      expect(html).not.toContain('tab-blocks');
      // Toolbar should still be rendered
      expect(html).toContain('KUBUILD Editor');
    });

    it('hides inspector when inspector: false', () => {
      const html = renderToString(<KubuildEditor registry={registry} config={{ inspector: false }} />);

      expect(html).not.toContain('No element selected.');
    });

    it('renders custom actions in toolbar', () => {
      const html = renderToString(
        <KubuildEditor
          registry={registry}
          config={{
            toolbar: {
              customActions: <button type="button" data-testid="custom-publish-btn">Publish Page</button>,
            },
          }}
        />,
      );

      expect(html).toContain('data-testid="custom-publish-btn"');
      expect(html).toContain('Publish Page');
    });

    it('filters sidebar tabs according to availableTabs', () => {
      const html = renderToString(
        <KubuildEditor
          registry={registry}
          config={{
            sidebar: {
              availableTabs: ['components', 'layers'],
            },
          }}
        />,
      );

      expect(html).toContain('tab-components');
      expect(html).toContain('tab-layers');
      expect(html).not.toContain('tab-blocks');
    });
  });

  describe('Inspector & StyleManager Customization', () => {
    it('filters style sectors when allowedStyleSectors is specified', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{}}
          onCommitStyle={() => {}}
          allowedSectors={['typography', 'decorations']}
        />,
      );

      expect(html).toContain('data-testid="sector-typography"');
      expect(html).toContain('data-testid="sector-decorations"');
      expect(html).not.toContain('data-testid="sector-dimension"');
      expect(html).not.toContain('data-testid="sector-spacing"');
      expect(html).not.toContain('data-testid="sector-flex"');
      expect(html).not.toContain('data-testid="sector-motion"');
    });

    it('hides tab bar in Inspector when showTraits is false', () => {
      const doc = createBlankDocument('Heading Test');
      const headingNode = {
        id: 'heading-1',
        type: 'heading',
        props: { text: 'Hello World', level: 'h1' },
        styles: { base: { color: '#2563eb' } },
      };
      doc.document.children = [headingNode];
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('heading-1');

      const foundInDoc = findNodeById(doc.document, 'heading-1');
      expect(foundInDoc).toBeDefined();
      expect(foundInDoc?.id).toBe('heading-1');
      expect(registry.get('heading')).toBeDefined();

      const html = renderToString(
        <InspectorPanel
          registry={registry}
          document={doc}
          selectedNodeId="heading-1"
          config={{
            showTraits: false,
          }}
        />,
      );

      // Tab switcher bar with "Traits" button should not be rendered
      expect(html).not.toContain('>Traits</span>');
      // But heading props and style manager are present (SSR injects <!-- --> between interpolated tokens)
      expect(html).toContain('Heading');
      expect(html).toContain('Props');
      expect(html).toContain('Style Manager');
    });

    it('hides State selector in Inspector when showStateSelector is false', () => {
      const doc = createBlankDocument('Box Test');
      const boxNode = {
        id: 'box-2',
        type: 'container',
        props: { tag: 'div' },
        styles: { base: { backgroundColor: '#2563eb' } },
      };
      doc.document.children = [boxNode];
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('box-2');

      const html = renderToString(
        <InspectorPanel
          registry={registry}
          document={doc}
          selectedNodeId="box-2"
          config={{
            showStateSelector: false,
          }}
        />,
      );

      expect(html).not.toContain('id="style-state-selector"');
    });
  });
});
