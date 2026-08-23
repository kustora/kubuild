import { create } from 'zustand';
import { PageDocument, Node } from '@kubuild/schema';
import {
  createBlankDocument,
  findNodeById,
  findNodeLocation,
  isDescendantOf,
  insertNode,
  moveNode,
  DocumentHistoryManager,
  CommandResult,
  deepClone,
  cloneTreeWithNewIds,
  collectNodeIdSet,
} from '@kubuild/core';
import { ComponentRegistry } from '@kubuild/components';

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface InsertComponentResult {
  success: boolean;
  nodeId?: string;
  error?: string;
}

export interface MoveComponentResult {
  success: boolean;
  error?: string;
}

/** Generates a node id unique within `existingIds`, e.g. "heading-1", "heading-2". */
function generateComponentNodeId(type: string, existingIds: Set<string>): string {
  let counter = 1;
  let candidate = `${type}-${counter}`;
  while (existingIds.has(candidate)) {
    counter += 1;
    candidate = `${type}-${counter}`;
  }
  return candidate;
}

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
  insertComponent: (type: string, registry: ComponentRegistry, parentId?: string) => InsertComponentResult;
  moveComponent: (
    nodeId: string,
    targetParentId: string,
    registry: ComponentRegistry,
    index?: number,
  ) => MoveComponentResult;
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

  insertComponent: (type, registry, parentId) => {
    const state = get();
    const targetParentId = parentId ?? state.selectedNodeId ?? state.document.document.id;
    const parentNode = findNodeById(state.document.document, targetParentId);
    if (!parentNode) {
      return { success: false, error: `Insertion target "${targetParentId}" was not found in the document.` };
    }

    const definition = registry.get(type);
    if (!definition) {
      return { success: false, error: `Unknown component type "${type}".` };
    }

    const policy = registry.canInsertChild(parentNode.type, type);
    if (!policy.valid) {
      return { success: false, error: policy.errors.join(' ') };
    }

    const props = deepClone(definition.defaultProps ?? {});
    if (definition.validateProps) {
      const propResult = definition.validateProps(props);
      if (Array.isArray(propResult) && propResult.length > 0) {
        return { success: false, error: propResult.join(' ') };
      }
      if (propResult === false) {
        return { success: false, error: `Default props for "${definition.label}" failed validation.` };
      }
    }

    const existingIds = collectNodeIdSet(state.document.document);
    const nodeId = generateComponentNodeId(type, existingIds);
    const node: Node = {
      id: nodeId,
      type,
      props,
      ...(definition.defaultStyles ? { styles: deepClone(definition.defaultStyles) } : {}),
    };

    get().dispatch((doc) => insertNode(doc, { parentId: targetParentId, node }));
    get().selectNode(nodeId);

    return { success: true, nodeId };
  },

  moveComponent: (nodeId, targetParentId, registry, index) => {
    const state = get();

    if (nodeId === state.document.document.id) {
      return { success: false, error: 'Cannot move the root page node.' };
    }

    const sourceLocation = findNodeLocation(state.document.document, nodeId);
    if (!sourceLocation || !sourceLocation.parent) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    const targetParent = findNodeById(state.document.document, targetParentId);
    if (!targetParent) {
      return { success: false, error: `Move target "${targetParentId}" was not found in the document.` };
    }

    if (isDescendantOf(sourceLocation.node, targetParentId)) {
      return { success: false, error: 'Cannot move a node into itself or one of its own descendants.' };
    }

    const policy = registry.canInsertChild(targetParent.type, sourceLocation.node.type);
    if (!policy.valid) {
      return { success: false, error: policy.errors.join(' ') };
    }

    // Reordering within the same parent: the source slot is removed before the
    // target index is applied, so any target position after it shifts left by one.
    const adjustedIndex =
      sourceLocation.parent.id === targetParentId && typeof index === 'number' && index > sourceLocation.index
        ? index - 1
        : index;

    get().dispatch((doc) => moveNode(doc, { nodeId, targetParentId, index: adjustedIndex }));

    return { success: true };
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
