import { create } from 'zustand';
import { PageDocument, Node } from '@kubuild/schema';
import {
  createBlankDocument,
  findNodeById,
  insertNode,
  DocumentHistoryManager,
  CommandResult,
  deepClone,
  cloneTreeWithNewIds,
  collectNodeIdSet,
} from '@kubuild/core';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface EditorState {
  document: PageDocument;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  viewport: Viewport;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  clipboard: Node | null;
  onChangeHandler: ((doc: PageDocument) => void) | null;

  setDocument: (document: PageDocument) => void;
  setOnChangeHandler: (handler: ((doc: PageDocument) => void) | null) => void;
  dispatch: (executor: (doc: PageDocument) => CommandResult) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  copyNode: (nodeId: string) => void;
  pasteNode: (targetParentId: string, index?: number) => void;
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  getSelectedNode: () => Node | null;
}

// Held outside reactive Zustand state: a mutable class instance, not serializable.
// Recreated whenever a new document is loaded via setDocument.
let historyManager = new DocumentHistoryManager(createBlankDocument());

function selectionAfter(document: PageDocument, selectedNodeId: string | null): string | null {
  if (!selectedNodeId) return null;
  return findNodeById(document.document, selectedNodeId) ? selectedNodeId : null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: historyManager.document,
  selectedNodeId: null,
  hoveredNodeId: null,
  viewport: 'desktop',
  isDirty: false,
  canUndo: false,
  canRedo: false,
  clipboard: null,
  onChangeHandler: null,

  setDocument: (document) => {
    historyManager = new DocumentHistoryManager(document);
    set({
      document: historyManager.document,
      isDirty: false,
      selectedNodeId: null,
      hoveredNodeId: null,
      clipboard: null,
      canUndo: false,
      canRedo: false,
    });
  },

  setOnChangeHandler: (handler) => set({ onChangeHandler: handler }),

  dispatch: (executor) => {
    const result = historyManager.execute(executor);
    const { selectedNodeId, onChangeHandler } = get();
    set({
      document: result.document,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: selectionAfter(result.document, selectedNodeId),
    });
    onChangeHandler?.(result.document);
  },

  undo: () => {
    const restored = historyManager.undo();
    if (!restored) return;
    const { selectedNodeId, onChangeHandler } = get();
    set({
      document: restored,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: selectionAfter(restored, selectedNodeId),
    });
    onChangeHandler?.(restored);
  },

  redo: () => {
    const restored = historyManager.redo();
    if (!restored) return;
    const { selectedNodeId, onChangeHandler } = get();
    set({
      document: restored,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: selectionAfter(restored, selectedNodeId),
    });
    onChangeHandler?.(restored);
  },

  markSaved: () => set({ isDirty: false }),

  copyNode: (nodeId) => {
    const node = findNodeById(get().document.document, nodeId);
    if (!node) return;
    set({ clipboard: deepClone(node) });
  },

  pasteNode: (targetParentId, index) => {
    const { clipboard, document } = get();
    if (!clipboard) return;
    const existingIds = collectNodeIdSet(document.document);
    const { clonedNode } = cloneTreeWithNewIds(clipboard, undefined, existingIds);
    get().dispatch((doc) => insertNode(doc, { parentId: targetParentId, node: clonedNode, index }));
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  hoverNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setViewport: (viewport) => set({ viewport }),
  getSelectedNode: () => {
    const { document, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return findNodeById(document.document, selectedNodeId);
  },
}));
