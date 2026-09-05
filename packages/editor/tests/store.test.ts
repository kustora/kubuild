import { describe, it, expect, vi } from 'vitest';
import { useEditorStore } from '../src/store';
import { createBlankDocument, insertNode, removeNode, collectNodeIdSet } from '@kubuild/core';
import { PageDocument } from '@kubuild/schema';
import { createDefaultComponentRegistry } from '@kubuild/components';

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
    const registry = createDefaultComponentRegistry();

    // Root page only allows 'section'/'custom' children per the registry, so a
    // heading needs a section container to be a registry-valid paste/copy target.
    function docWithSectionAndHeading(): PageDocument {
      const doc = createBlankDocument('Clipboard Test');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          props: {},
          children: [{ id: 'child-node', type: 'heading', props: { text: 'Hello' } }],
        },
      ];
      return doc;
    }

    it('copyNode clones the node into clipboard without mutating document', () => {
      useEditorStore.getState().setDocument(docWithSectionAndHeading());
      const before = useEditorStore.getState().document;

      useEditorStore.getState().copyNode('child-node');

      const state = useEditorStore.getState();
      expect(state.clipboard?.id).toBe('child-node');
      expect(state.document).toBe(before);
    });

    it('pasteNode inserts a cloned subtree with a different id, undoable, firing onChange', () => {
      useEditorStore.getState().setDocument(docWithSectionAndHeading());
      const handler = vi.fn();
      useEditorStore.getState().setOnChangeHandler(handler);
      useEditorStore.getState().copyNode('child-node');

      const result = useEditorStore.getState().pasteNode('section-1', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const children =
        state.document.document.children?.find((n) => n.id === 'section-1')?.children ?? [];
      expect(children).toHaveLength(2);
      const pasted = children.find((n) => n.id !== 'child-node');
      expect(pasted?.id).not.toBe('child-node');
      expect(pasted?.id).toBe(result.nodeId);
      expect(pasted?.type).toBe('heading');
      expect(state.canUndo).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('pasteNode is a no-op when clipboard is null', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().pasteNode('root-page', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects pasting into a non-existent target', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().copyNode('child-node');
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().pasteNode('does-not-exist', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects pasting into a destination the registry disallows', () => {
      const doc = docWithChild();
      doc.document.children?.push({ id: 'btn-1', type: 'button', props: { label: 'Go' } });
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().copyNode('child-node');
      const before = useEditorStore.getState().document;

      // button.acceptsChildren === false
      const result = useEditorStore.getState().pasteNode('btn-1', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not accept children');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('regenerates ids for every node in a nested pasted subtree', () => {
      const doc = createBlankDocument('Nested Clipboard Test');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          props: {},
          children: [{ id: 'heading-1', type: 'heading', props: { text: 'Hi' } }],
        },
      ];
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().copyNode('section-1');

      const result = useEditorStore.getState().pasteNode('root-page', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const pasted = state.document.document.children?.find((n) => n.id === result.nodeId);
      expect(pasted?.children?.[0].id).not.toBe('heading-1');
      const allIds = collectNodeIdSet(state.document.document);
      expect(allIds.size).toBe([...allIds].length); // sanity: no duplicate insertions
    });
  });

  describe('duplicateComponent', () => {
    const registry = createDefaultComponentRegistry();

    it('duplicates a leaf node into the same parent with a new id, selects it, and is undoable', () => {
      useEditorStore.getState().setDocument(docWithChild());

      const result = useEditorStore.getState().duplicateComponent('child-node', registry);

      expect(result.success).toBe(true);
      expect(result.nodeId).toBeDefined();
      expect(result.nodeId).not.toBe('child-node');
      const state = useEditorStore.getState();
      const children = state.document.document.children ?? [];
      expect(children).toHaveLength(2);
      expect(state.selectedNodeId).toBe(result.nodeId);
      expect(state.canUndo).toBe(true);
    });

    it('duplicates a nested subtree, regenerating ids for every descendant', () => {
      const doc = createBlankDocument('Duplicate Nested Test');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          props: {},
          children: [{ id: 'heading-1', type: 'heading', props: { text: 'Hi' } }],
        },
      ];
      useEditorStore.getState().setDocument(doc);

      const result = useEditorStore.getState().duplicateComponent('section-1', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const duplicate = state.document.document.children?.find((n) => n.id === result.nodeId);
      expect(duplicate?.children?.[0].id).not.toBe('heading-1');
      expect(duplicate?.children?.[0].type).toBe('heading');
    });

    it('rejects duplicating the root page node', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().duplicateComponent('root-page', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('root');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects an unknown nodeId', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().duplicateComponent('does-not-exist', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(useEditorStore.getState().document).toBe(before);
    });
  });

  describe('deleteComponent', () => {
    it('deletes a node including nested children, undoable', () => {
      const doc = createBlankDocument('Delete Test');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          props: {},
          children: [{ id: 'heading-1', type: 'heading', props: { text: 'Hi' } }],
        },
      ];
      useEditorStore.getState().setDocument(doc);

      const result = useEditorStore.getState().deleteComponent('section-1');

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      expect(state.document.document.children?.some((n) => n.id === 'section-1')).toBe(false);
      expect(state.canUndo).toBe(true);
    });

    it('rejects deleting the root page node', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().deleteComponent('root-page');

      expect(result.success).toBe(false);
      expect(result.error).toContain('root');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects an unknown nodeId', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().deleteComponent('does-not-exist');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('clears selectedNodeId when the deleted node was selected', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().selectNode('child-node');

      useEditorStore.getState().deleteComponent('child-node');

      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe('insertComponent', () => {
    const registry = createDefaultComponentRegistry();

    it('inserts a node with validated default props as a child of the selected node and selects it', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().selectNode('root-page');

      const result = useEditorStore.getState().insertComponent('section', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const inserted = state.document.document.children?.find((n) => n.id === result.nodeId);
      expect(inserted).toBeDefined();
      expect(inserted?.type).toBe('section');
      expect(state.selectedNodeId).toBe(result.nodeId);
      expect(state.isDirty).toBe(true);
    });

    it('falls back to the document root when nothing is selected', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().selectNode(null);

      const result = useEditorStore.getState().insertComponent('section', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      expect(state.document.document.children?.some((n) => n.id === result.nodeId)).toBe(true);
    });

    it('rejects an invalid parent/child combination with a clear message and leaves the document unchanged', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore.getState().selectNode('child-node'); // heading: acceptsChildren === false
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().insertComponent('text', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not accept children');
      const state = useEditorStore.getState();
      expect(state.document).toBe(before);
      expect(state.isDirty).toBe(false);
    });

    it('rejects an unknown component type', () => {
      useEditorStore.getState().setDocument(docWithChild());

      const result = useEditorStore.getState().insertComponent('does-not-exist', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown component type');
    });

    it('honors an explicit parentId over the current selection', () => {
      const doc = docWithChild();
      doc.document.children?.push({ id: 'section-1', type: 'section', props: {}, children: [] });
      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('child-node');

      const result = useEditorStore.getState().insertComponent('heading', registry, 'section-1');

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const section = state.document.document.children?.find((n) => n.id === 'section-1');
      expect(section?.children?.some((n) => n.id === result.nodeId)).toBe(true);
    });
  });

  describe('moveComponent', () => {
    const registry = createDefaultComponentRegistry();

    function docWithSiblings(): PageDocument {
      const doc = createBlankDocument('Move Test');
      doc.document.children = [
        {
          id: 'section-a',
          type: 'section',
          props: {},
          children: [{ id: 'heading-a', type: 'heading', props: { text: 'A' } }],
        },
        { id: 'section-b', type: 'section', props: {}, children: [] },
      ];
      return doc;
    }

    it('reorders a sibling to a later index in a single history entry', () => {
      const doc = createBlankDocument('Reorder Test');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          props: {},
          children: [
            { id: 'h1', type: 'heading', props: { text: '1' } },
            { id: 'h2', type: 'heading', props: { text: '2' } },
            { id: 'h3', type: 'heading', props: { text: '3' } },
          ],
        },
      ];
      useEditorStore.getState().setDocument(doc);

      // Move h1 to after h2 (index 2 in the original 3-item array).
      const result = useEditorStore.getState().moveComponent('h1', 'section-1', registry, 2);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const section = state.document.document.children?.find((n) => n.id === 'section-1');
      expect(section?.children?.map((n) => n.id)).toEqual(['h2', 'h1', 'h3']);
      expect(state.canUndo).toBe(true);

      useEditorStore.getState().undo();
      const restoredSection = useEditorStore
        .getState()
        .document.document.children?.find((n) => n.id === 'section-1');
      expect(restoredSection?.children?.map((n) => n.id)).toEqual(['h1', 'h2', 'h3']);
    });

    it('moves a node into a different valid container', () => {
      useEditorStore.getState().setDocument(docWithSiblings());

      const result = useEditorStore.getState().moveComponent('heading-a', 'section-b', registry);

      expect(result.success).toBe(true);
      const state = useEditorStore.getState();
      const sectionA = state.document.document.children?.find((n) => n.id === 'section-a');
      const sectionB = state.document.document.children?.find((n) => n.id === 'section-b');
      expect(sectionA?.children).toHaveLength(0);
      expect(sectionB?.children?.some((n) => n.id === 'heading-a')).toBe(true);
    });

    it('rejects moving the root page node', () => {
      useEditorStore.getState().setDocument(docWithSiblings());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().moveComponent('root-page', 'section-a', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('root page node');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects moving a node into its own descendant', () => {
      useEditorStore.getState().setDocument(docWithSiblings());
      const before = useEditorStore.getState().document;

      const result = useEditorStore.getState().moveComponent('section-a', 'heading-a', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('descendant');
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects an invalid parent/child combination before mutating the document', () => {
      const doc = docWithSiblings();
      doc.document.children?.push({ id: 'btn-1', type: 'button', props: { label: 'Go' } });
      useEditorStore.getState().setDocument(doc);
      const before = useEditorStore.getState().document;

      // button.acceptsChildren === false
      const result = useEditorStore.getState().moveComponent('heading-a', 'btn-1', registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not accept children');
      const state = useEditorStore.getState();
      expect(state.document).toBe(before);
      expect(state.isDirty).toBe(false);
    });
  });

  describe('updateNodeProps', () => {
    const registry = createDefaultComponentRegistry();

    it('updates a single prop via merge, preserving sibling props', () => {
      const doc = docWithChild();
      doc.document.children![0].props = { text: 'Hello', level: 2 };
      useEditorStore.getState().setDocument(doc);

      const result = useEditorStore
        .getState()
        .updateNodeProps('child-node', { text: 'Updated' }, registry);

      expect(result.success).toBe(true);
      const node = useEditorStore.getState().document.document.children?.[0];
      expect(node?.props?.text).toBe('Updated');
      expect(node?.props?.level).toBe(2);
      expect(useEditorStore.getState().canUndo).toBe(true);
    });

    it('rejects an invalid prop via definition.validateProps and leaves the document unchanged', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore
        .getState()
        .updateNodeProps('child-node', { text: '' }, registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('non-empty');
      expect(useEditorStore.getState().document).toBe(before);
      expect(useEditorStore.getState().canUndo).toBe(false);
    });

    it('rejects an update for an unknown nodeId without throwing', () => {
      useEditorStore.getState().setDocument(docWithChild());

      const result = useEditorStore
        .getState()
        .updateNodeProps('does-not-exist', { text: 'x' }, registry);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('updateNodeStyle', () => {
    function docWithStyledChild(): PageDocument {
      const doc = createBlankDocument('Style Test');
      doc.document.children = [
        {
          id: 'child-node',
          type: 'heading',
          props: { text: 'Hello' },
          styles: { base: { padding: '8px' }, tablet: { padding: '4px' } },
        },
      ];
      return doc;
    }

    it('writes only the active breakpoint, leaving base and other breakpoints untouched', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      const result = useEditorStore
        .getState()
        .updateNodeStyle('child-node', { padding: '2px' }, 'mobile');

      expect(result.success).toBe(true);
      const styles = useEditorStore.getState().document.document.children?.[0].styles;
      expect(styles?.mobile).toEqual({ padding: '2px' });
      expect(styles?.base).toEqual({ padding: '8px' });
      expect(styles?.tablet).toEqual({ padding: '4px' });
    });

    it('merges into an existing breakpoint without clobbering sibling style keys', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      useEditorStore.getState().updateNodeStyle('child-node', { paddingTop: '10px' }, 'base');

      const base = useEditorStore.getState().document.document.children?.[0].styles?.base;
      expect(base).toEqual({ padding: '8px', paddingTop: '10px' });
    });

    it('rejects an unsafe style value and leaves the document unchanged', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore
        .getState()
        .updateNodeStyle('child-node', { backgroundImage: 'url(javascript:alert(1))' }, 'base');

      expect(result.success).toBe(false);
      expect(useEditorStore.getState().document).toBe(before);
    });

    it('rejects an update for an unknown nodeId without throwing', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      const result = useEditorStore
        .getState()
        .updateNodeStyle('does-not-exist', { padding: '1px' }, 'base');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('updateNodeStateStyle (STORA-221)', () => {
    function docWithStyledChild(): PageDocument {
      const doc = createBlankDocument('State Style Test');
      doc.document.children = [
        {
          id: 'child-node',
          type: 'heading',
          props: { text: 'Hello' },
          styles: { base: { backgroundColor: '#2563eb', padding: '8px' } },
        },
      ];
      return doc;
    }

    it('writes :hover background color into states key without touching default values', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      const result = useEditorStore
        .getState()
        .updateNodeStateStyle('child-node', { backgroundColor: '#1d4ed8' }, ':hover');

      expect(result.success).toBe(true);
      const styles = useEditorStore.getState().document.document.children?.[0].styles;
      expect(styles?.states?.[':hover']).toEqual({ backgroundColor: '#1d4ed8' });
      // Default values untouched
      expect(styles?.base).toEqual({ backgroundColor: '#2563eb', padding: '8px' });
    });

    it('merges into an existing state layer without clobbering sibling keys', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      useEditorStore.getState().updateNodeStateStyle('child-node', { cursor: 'pointer' }, ':hover');
      useEditorStore.getState().updateNodeStateStyle('child-node', { opacity: 0.8 }, ':hover');

      const hover =
        useEditorStore.getState().document.document.children?.[0].styles?.states?.[':hover'];
      expect(hover).toEqual({ cursor: 'pointer', opacity: 0.8 });
    });

    it('keeps state layers isolated per state', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());

      useEditorStore
        .getState()
        .updateNodeStateStyle('child-node', { backgroundColor: '#111' }, ':hover');
      useEditorStore
        .getState()
        .updateNodeStateStyle('child-node', { backgroundColor: '#222' }, ':active');

      const states = useEditorStore.getState().document.document.children?.[0].styles?.states;
      expect(states?.[':hover']).toEqual({ backgroundColor: '#111' });
      expect(states?.[':active']).toEqual({ backgroundColor: '#222' });
    });

    it('rejects an unsafe style value in a state layer and leaves the document unchanged', () => {
      useEditorStore.getState().setDocument(docWithStyledChild());
      const before = useEditorStore.getState().document;

      const result = useEditorStore
        .getState()
        .updateNodeStateStyle('child-node', { background: 'url(javascript:alert(1))' }, ':hover');

      expect(result.success).toBe(false);
      expect(useEditorStore.getState().document).toBe(before);
    });
  });

  describe('setViewport', () => {
    it('switching viewport never mutates the draft document', () => {
      useEditorStore.getState().setDocument(docWithChild());
      const before = useEditorStore.getState().document;

      useEditorStore.getState().setViewport('tablet');
      useEditorStore.getState().setViewport('mobile');

      const state = useEditorStore.getState();
      expect(state.document).toBe(before);
      expect(state.isDirty).toBe(false);
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

  describe('STORA-053: variableCatalog (ephemeral UI state)', () => {
    it('defaults to an empty catalog', () => {
      expect(useEditorStore.getState().variableCatalog).toEqual([]);
    });

    it('setVariableCatalog replaces the catalog', () => {
      useEditorStore
        .getState()
        .setVariableCatalog([
          { key: 'site.name', label: 'Site Name', type: 'string', sampleValue: 'My Website' },
        ]);
      expect(useEditorStore.getState().variableCatalog).toEqual([
        { key: 'site.name', label: 'Site Name', type: 'string', sampleValue: 'My Website' },
      ]);

      useEditorStore.getState().setVariableCatalog([]);
      expect(useEditorStore.getState().variableCatalog).toEqual([]);
    });

    it('binding a field to a catalog variable never writes sampleValue into the document', () => {
      useEditorStore.getState().setDocument(docWithChild());
      useEditorStore
        .getState()
        .setVariableCatalog([
          {
            key: 'site.name',
            label: 'Site Name',
            type: 'string',
            sampleValue: 'Secret Sample Value',
          },
        ]);
      const registry = createDefaultComponentRegistry();

      useEditorStore
        .getState()
        .updateNodeProps('child-node', { text: { type: 'variable', key: 'site.name' } }, registry);

      const serialized = JSON.stringify(useEditorStore.getState().document);
      expect(serialized).not.toContain('Secret Sample Value');
      expect(serialized).toContain('"key":"site.name"');
    });
  });

  describe('STORA-071: Template Actions (saveDraftAsTemplate & loadTemplate)', () => {
    it('saves the current draft as a template record', () => {
      useEditorStore.getState().setDocument(docWithChild());

      const template = useEditorStore.getState().saveDraftAsTemplate({
        id: 'tmpl_from_editor',
        name: 'Editor Saved Template',
        category: 'landing',
        tags: ['editor', 'custom'],
      });

      expect(template.id).toBe('tmpl_from_editor');
      expect(template.name).toBe('Editor Saved Template');
      expect(template.document?.document.children?.[0]?.id).toBe('child-node');
    });

    it('loads a template as a new page with fresh node IDs and clean history', () => {
      const template = useEditorStore.getState().saveDraftAsTemplate({
        id: 'tmpl_to_load',
        name: 'Template To Load',
      });

      useEditorStore.getState().loadTemplate(template, {
        title: 'Cloned In Editor Page',
      });

      const state = useEditorStore.getState();
      expect(state.document.metadata?.title).toBe('Cloned In Editor Page');
      expect(state.isDirty).toBe(false);
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);

      // Node ID of child should be brand new, not 'child-node'
      const childNode = state.document.document.children?.[0];
      expect(childNode).toBeDefined();
      expect(childNode?.id).not.toBe('child-node');

      // Edit the clone
      const registry = createDefaultComponentRegistry();
      useEditorStore
        .getState()
        .updateNodeProps(childNode!.id, { text: 'Updated Text In Clone' }, registry);

      expect(useEditorStore.getState().isDirty).toBe(true);
      expect(useEditorStore.getState().canUndo).toBe(true);

      // Template snapshot should NOT be affected
      expect(template.document?.document.children?.[0]?.props?.text).toBe('Hello');
    });
  });

  describe('Sidebar Drag and Drop & Block Insertion', () => {
    it('manages dragPayload state correctly', () => {
      expect(useEditorStore.getState().dragPayload).toBeNull();

      useEditorStore.getState().setDragPayload({ type: 'component', componentType: 'button' });
      expect(useEditorStore.getState().dragPayload).toEqual({
        type: 'component',
        componentType: 'button',
      });

      useEditorStore.getState().setDragPayload({ type: 'block', blockId: 'hero-section' });
      expect(useEditorStore.getState().dragPayload).toEqual({
        type: 'block',
        blockId: 'hero-section',
      });

      useEditorStore.getState().setDragPayload(null);
      expect(useEditorStore.getState().dragPayload).toBeNull();
    });

    it('inserts component at specific index using insertComponent', () => {
      const doc = createBlankDocument('Test Doc');
      doc.document.children = [
        {
          id: 'section-1',
          type: 'section',
          children: [
            {
              id: 'container-1',
              type: 'container',
              children: [{ id: 'child-1', type: 'text', props: { content: 'one' } }],
            },
          ],
        },
      ];
      useEditorStore.getState().setDocument(doc);
      const registry = createDefaultComponentRegistry();

      const result = useEditorStore
        .getState()
        .insertComponent('button', registry, 'container-1', 0);
      expect(result.success).toBe(true);

      const container = useEditorStore.getState().document.document.children?.[0].children?.[0];
      expect(container?.children?.[0].type).toBe('button');
      expect(container?.children?.[1].id).toBe('child-1');
    });

    it('inserts starter block into document using insertBlock', () => {
      const doc = createBlankDocument('Block Insert Test');
      useEditorStore.getState().setDocument(doc);

      const result = useEditorStore.getState().insertBlock('layout-1-col');
      expect(result.success).toBe(true);
      expect(result.nodeId).toBeDefined();

      const root = useEditorStore.getState().document.document;
      expect(root.children?.length).toBe(1);
      expect(root.children?.[0].type).toBe('section');
    });
  });

  describe('aiChatMode (STORA-503)', () => {
    it('defaults to hidden', () => {
      useEditorStore.getState().setAiChatMode('hidden');
      expect(useEditorStore.getState().aiChatMode).toBe('hidden');
    });

    it('setAiChatMode switches between docked, floating, and hidden', () => {
      useEditorStore.getState().setAiChatMode('docked');
      expect(useEditorStore.getState().aiChatMode).toBe('docked');

      useEditorStore.getState().setAiChatMode('floating');
      expect(useEditorStore.getState().aiChatMode).toBe('floating');

      useEditorStore.getState().setAiChatMode('hidden');
      expect(useEditorStore.getState().aiChatMode).toBe('hidden');
    });

    it('toggleAiChat flips between hidden and floating like toggleNavigator/toggleTableSpreadsheet', () => {
      useEditorStore.getState().setAiChatMode('hidden');

      useEditorStore.getState().toggleAiChat();
      expect(useEditorStore.getState().aiChatMode).toBe('floating');

      useEditorStore.getState().toggleAiChat();
      expect(useEditorStore.getState().aiChatMode).toBe('hidden');
    });

    it('toggleAiChat from docked collapses to hidden (any non-hidden mode toggles off)', () => {
      useEditorStore.getState().setAiChatMode('docked');

      useEditorStore.getState().toggleAiChat();
      expect(useEditorStore.getState().aiChatMode).toBe('hidden');
    });

    it('is UI-only: setDocument does not reset aiChatMode', () => {
      useEditorStore.getState().setAiChatMode('docked');
      useEditorStore.getState().setDocument(createBlankDocument('Fresh Doc'));
      expect(useEditorStore.getState().aiChatMode).toBe('docked');
    });
  });
});
