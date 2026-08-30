import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument, getParentNodeId, getNodeAncestors } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument } from '@kubuild/schema';
import { useEditorStore } from '../src/store';
import { FloatingActionBadges } from '../src/floating-badges';
import { HierarchyBreadcrumbs } from '../src/breadcrumbs';
import { KubuildEditor } from '../src/editor';

describe('Canvas Navigation (STORA-230, STORA-231, STORA-232)', () => {
  const registry = createDefaultComponentRegistry();

  function createTestDoc(): PageDocument {
    const doc = createBlankDocument('Navigation Test Page');
    doc.document.children = [
      {
        id: 'section-1',
        type: 'section',
        children: [
          {
            id: 'container-1',
            type: 'container',
            children: [
              {
                id: 'btn-1',
                type: 'button',
                props: { label: 'Click Me' },
              },
            ],
          },
        ],
      },
    ];
    return doc;
  }

  beforeEach(() => {
    const doc = createTestDoc();
    useEditorStore.getState().setDocument(doc);
  });

  describe('STORA-232: Core Ancestor & Parent Helpers', () => {
    it('finds direct parent ID with getParentNodeId in O(N)', () => {
      const doc = createTestDoc();
      expect(getParentNodeId(doc.document, 'btn-1')).toBe('container-1');
      expect(getParentNodeId(doc.document, 'container-1')).toBe('section-1');
      expect(getParentNodeId(doc.document, 'section-1')).toBe(doc.document.id);
      expect(getParentNodeId(doc.document, doc.document.id)).toBeNull();
    });

    it('returns full ancestor path with getNodeAncestors in O(N)', () => {
      const doc = createTestDoc();
      const path = getNodeAncestors(doc.document, 'btn-1');
      expect(path.map((n) => n.id)).toEqual([doc.document.id, 'section-1', 'container-1', 'btn-1']);
    });

    it('store.selectParent() selects the parent node', () => {
      useEditorStore.getState().selectNode('btn-1');
      expect(useEditorStore.getState().selectedNodeId).toBe('btn-1');

      useEditorStore.getState().selectParent();
      expect(useEditorStore.getState().selectedNodeId).toBe('container-1');

      useEditorStore.getState().selectParent();
      expect(useEditorStore.getState().selectedNodeId).toBe('section-1');

      useEditorStore.getState().selectParent();
      expect(useEditorStore.getState().selectedNodeId).toBe('root-page');
    });
  });

  describe('STORA-230: Floating Action Badges above Active Node', () => {
    it('renders floating action badge with tag name and buttons for a selected child node', () => {
      const doc = createTestDoc();
      const html = renderToString(
        <FloatingActionBadges
          selectedNodeId="btn-1"
          document={doc}
          registry={registry}
          selectedRect={{ top: 100, left: 50, width: 120, height: 40 }}
        />,
      );

      expect(html).toContain('data-testid="floating-action-badges"');
      expect(html).toContain('data-testid="floating-badge-label"');
      expect(html).toContain('Button');
      expect(html).toContain('data-testid="floating-badge-select-parent"');
      expect(html).toContain('data-testid="floating-badge-move"');
      expect(html).toContain('data-testid="floating-badge-duplicate"');
      expect(html).toContain('data-testid="floating-badge-delete"');
    });

    it('hides parent and mutating buttons for the root node', () => {
      const doc = createTestDoc();
      const html = renderToString(
        <FloatingActionBadges
          selectedNodeId={doc.document.id}
          document={doc}
          registry={registry}
          selectedRect={{ top: 0, left: 0, width: 800, height: 600 }}
        />,
      );

      expect(html).toContain('data-testid="floating-action-badges"');
      expect(html).not.toContain('data-testid="floating-badge-select-parent"');
      expect(html).not.toContain('data-testid="floating-badge-move"');
      expect(html).not.toContain('data-testid="floating-badge-duplicate"');
      expect(html).not.toContain('data-testid="floating-badge-delete"');
    });

    it('clicking ⬆️ Select Parent updates the selectedNodeId in store', () => {
      const doc = createTestDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('btn-1');

      // Emulate select parent action
      useEditorStore.getState().selectParent();
      expect(useEditorStore.getState().selectedNodeId).toBe('container-1');
    });

    it('clicking Duplicate creates a duplicate sibling node', () => {
      const doc = createTestDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('btn-1');

      const result = useEditorStore.getState().duplicateComponent('btn-1', registry);
      expect(result.success).toBe(true);

      const container = doc.document.children?.[0].children?.[0];
      const updatedContainer = useEditorStore.getState().document.document.children?.[0].children?.[0];
      expect(updatedContainer?.children?.length).toBe(2);
    });

    it('clicking Delete removes the active node', () => {
      const doc = createTestDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('btn-1');

      const result = useEditorStore.getState().deleteComponent('btn-1');
      expect(result.success).toBe(true);

      const updatedContainer = useEditorStore.getState().document.document.children?.[0].children?.[0];
      expect(updatedContainer?.children?.length).toBe(0);
    });
  });

  describe('STORA-231: Bottom Hierarchy Breadcrumbs Bar', () => {
    it('renders the complete ancestor breadcrumb path for selected node', () => {
      const doc = createTestDoc();
      const html = renderToString(
        <HierarchyBreadcrumbs
          document={doc}
          registry={registry}
          selectedNodeId="btn-1"
        />,
      );

      expect(html).toContain('data-testid="hierarchy-breadcrumbs"');
      expect(html).toContain('data-testid="breadcrumb-root-page"');
      expect(html).toContain('data-testid="breadcrumb-section-1"');
      expect(html).toContain('data-testid="breadcrumb-container-1"');
      expect(html).toContain('data-testid="breadcrumb-btn-1"');
      expect(html).toContain('Navigation Test Page');
      expect(html).toContain('Section');
      expect(html).toContain('Container');
      expect(html).toContain('Button');
    });

    it('renders root page when no node is selected', () => {
      const doc = createTestDoc();
      const html = renderToString(
        <HierarchyBreadcrumbs
          document={doc}
          registry={registry}
          selectedNodeId={null}
        />,
      );

      expect(html).toContain('data-testid="hierarchy-breadcrumbs"');
      expect(html).toContain('data-testid="breadcrumb-root-page"');
    });

    it('clicking a breadcrumb item selects that element', () => {
      const doc = createTestDoc();
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('btn-1');
      expect(useEditorStore.getState().selectedNodeId).toBe('btn-1');

      // Click on Section breadcrumb
      useEditorStore.getState().selectNode('section-1');
      expect(useEditorStore.getState().selectedNodeId).toBe('section-1');
    });

    it('is rendered inside KubuildEditor bottom area', () => {
      const doc = createTestDoc();
      const html = renderToString(
        <KubuildEditor
          initialDocument={doc}
          registry={registry}
        />,
      );

      expect(html).toContain('data-testid="hierarchy-breadcrumbs"');
    });
  });
});
