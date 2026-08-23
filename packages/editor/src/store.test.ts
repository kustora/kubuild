import { describe, it, expect, vi } from 'vitest';
import { useEditorStore } from './store';
import { createBlankDocument, insertNode, removeNode } from '@kubuild/core';
import { PageDocument } from '@kubuild/schema';

function docWithChild(): PageDocument {
  const doc = createBlankDocument('Test Doc');
  doc.document.children = [
    {
      id: 'child-node',
      type: 'heading',
      props: { text: 'Hello' },
    },
  ];
  return doc;
}

describe('Editor Store', () => {
  describe('dispatch & history', () => {
    it('dispatch runs a command and updates document/isDirty/canUndo', () => {
      useEditorStore.getState().setDocument(docWithChild());

      useEditorStore.getState().dispatch((doc) =>
        insertNode(doc, {
          parentId: 'root-page',
          node: { id: 'new-node', type: 'text', props: { text: 'New' } },
        }),
      );

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.canUndo).toBe(true);
      expect(state.document.document.children?.some((n) => n.id === 'new-node')).toBe(true);
    });

    it('dispatch with invalid input throws and leaves state unchanged', () => {
      const doc = docWithChild();
      useEditorStore.getState().setDocument(doc);
      const before = useEditorStore.getState().document;

      expect(() =>
        useEditorStore.getState().dispatch((d) => removeNode(d, { nodeId: 'root-page' })),
      ).toThrow();

      const state = useEditorStore.getState();
      expect(state.document).toBe(before);
      expect(state.isDirty).toBe(false);
    });

    it('undo restores prior document, redo restores next document', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const original = useEditorStore.getState().document;

      useEditorStore.getState().dispatch((doc) =>
        insertNode(doc, {
          parentId: 'root-page',
          node: { id: 'new-node', type: 'text', props: { text: 'New' } },
        }),
      );
      const afterInsert = useEditorStore.getState().document;

      useEditorStore.getState().undo();
      let state = useEditorStore.getState();
      expect(state.document).toEqual(original);
      expect(state.canRedo).toBe(true);

      useEditorStore.getState().redo();
      state = useEditorStore.getState();
      expect(state.document).toEqual(afterInsert);
    });

    it('undo/redo are safe no-ops when history is empty', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      useEditorStore.getState().undo();
      useEditorStore.getState().redo();

      const state = useEditorStore.getState();
      expect(state.document).toBe(before);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('onChange wiring', () => {
    it('fires on dispatch, undo, and redo', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const handler = vi.fn();
      useEditorStore.getState().setOnChangeHandler(handler);

      useEditorStore.getState().dispatch((doc) =>
        insertNode(doc, {
          parentId: 'root-page',
          node: { id: 'new-node', type: 'text', props: { text: 'New' } },
        }),
      );
      expect(handler).toHaveBeenCalledTimes(1);

      useEditorStore.getState().undo();
      expect(handler).toHaveBeenCalledTimes(2);

      useEditorStore.getState().redo();
      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('does not fire on setDocument', () => {
      const handler = vi.fn();
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().setOnChangeHandler(handler);

      useEditorStore.getState().setDocument(docWithChild());

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('load/save/dirty lifecycle', () => {
    it('setDocument resets isDirty/canUndo/canRedo/selection/hover/clipboard', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().dispatch((doc) =>
        insertNode(doc, {
          parentId: 'root-page',
          node: { id: 'new-node', type: 'text', props: { text: 'New' } },
        }),
      );
      useEditorStore.getState().selectNode('child-node');
      useEditorStore.getState().hoverNode('child-node');
      useEditorStore.getState().copyNode('child-node');

      useEditorStore.getState().setDocument(docWithChild());

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
      expect(state.selectedNodeId).toBeNull();
      expect(state.hoveredNodeId).toBeNull();
      expect(state.clipboard).toBeNull();
    });

    it('markSaved sets isDirty false without touching document', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().dispatch((doc) =>
        insertNode(doc, {
          parentId: 'root-page',
          node: { id: 'new-node', type: 'text', props: { text: 'New' } },
        }),
      );
      const docBeforeSave = useEditorStore.getState().document;

      useEditorStore.getState().markSaved();

      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.document).toBe(docBeforeSave);
    });
  });

  describe('clipboard', () => {
    it('copyNode clones the node into clipboard without mutating document', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      useEditorStore.getState().copyNode('child-node');

      const state = useEditorStore.getState();
      expect(state.clipboard?.id).toBe('child-node');
      expect(state.document).toBe(before);
    });

    it('pasteNode inserts a cloned subtree with a different id, undoable, firing onChange', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const handler = vi.fn();
      useEditorStore.getState().setOnChangeHandler(handler);
      useEditorStore.getState().copyNode('child-node');

      useEditorStore.getState().pasteNode('root-page');

      const state = useEditorStore.getState();
      const children = state.document.document.children ?? [];
      expect(children).toHaveLength(2);
      const pasted = children.find((n) => n.id !== 'child-node');
      expect(pasted?.id).not.toBe('child-node');
      expect(pasted?.type).toBe('heading');
      expect(state.canUndo).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('pasteNode is a no-op when clipboard is null', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      useEditorStore.getState().pasteNode('root-page');

      expect(useEditorStore.getState().document).toBe(before);
    });
  });

  describe('selection integrity', () => {
    it('clears selectedNodeId when the selected node is removed', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().selectNode('child-node');

      useEditorStore.getState().dispatch((doc) => removeNode(doc, { nodeId: 'child-node' }));

      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });
});
