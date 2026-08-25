import { create } from 'zustand';
import { PageDocument, Node, StyleDefinition, TemplateRecord } from '@kubuild/schema';
import {
  createBlankDocument,
  findNodeById,
  findNodeLocation,
  isDescendantOf,
  insertNode,
  moveNode,
  duplicateNode,
  removeNode,
  updateProps,
  updateStyle,
  DocumentHistoryManager,
  CommandResult,
  deepClone,
  cloneTreeWithNewIds,
  collectNodeIdSet,
  VariableCatalog,
  saveDraftAsTemplate,
  cloneTemplateAsPage,
  SaveTemplateMetadata,
  CloneTemplateOptions,
} from '@kubuild/core';
import { ComponentRegistry, ComponentDefaultChildSpec } from '@kubuild/components';

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type NavigatorMode = 'docked' | 'floating' | 'hidden';

export interface InsertComponentResult {
  success: boolean;
  nodeId?: string;
  error?: string;
}

export interface MoveComponentResult {
  success: boolean;
  error?: string;
}

export interface DuplicateComponentResult {
  success: boolean;
  nodeId?: string;
  error?: string;
}

export interface DeleteComponentResult {
  success: boolean;
  error?: string;
}

export interface PasteComponentResult {
  success: boolean;
  nodeId?: string;
  error?: string;
}

export interface UpdatePropsResult {
  success: boolean;
  error?: string;
}

export interface UpdateStyleResult {
  success: boolean;
  error?: string;
}

// Duck-types Zod's issue-array shape (from updateStyle's schema.parse) vs plain
// Error (from updateProps/removeNode/etc) without adding a zod dependency here.
function formatCommandError(err: unknown): string {
  if (err && typeof err === 'object' && Array.isArray((err as { issues?: unknown }).issues)) {
    const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    return issues.map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message)).join('; ');
  }
  return err instanceof Error ? err.message : String(err);
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

/** Recursively constructs default child nodes from ComponentDefinition.defaultChildren specs. */
function buildDefaultChildren(
  specs: ComponentDefaultChildSpec[] | undefined,
  existingIds: Set<string>,
  registry: ComponentRegistry,
): Node[] | undefined {
  if (!specs || specs.length === 0) return undefined;
  return specs.map((spec) => {
    const id = generateComponentNodeId(spec.type, existingIds);
    existingIds.add(id);
    const def = registry.get(spec.type);
    const nodeProps = deepClone(spec.props ?? def?.defaultProps ?? {});
    const nodeStyles = spec.styles ?? def?.defaultStyles;
    const childNodes = buildDefaultChildren(spec.children ?? def?.defaultChildren, existingIds, registry);
    const node: Node = {
      id,
      type: spec.type,
      props: nodeProps,
      ...(nodeStyles ? { styles: deepClone(nodeStyles) } : {}),
      ...(childNodes ? { children: childNodes } : {}),
    };
    return node;
  });
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
  /** Host-declared bindable variables + editor/preview-only sample values (STORA-053). Never serialized to the document. */
  variableCatalog: VariableCatalog;
  navigatorMode: NavigatorMode;

  setDocument: (document: PageDocument) => void;
  setVariableCatalog: (catalog: VariableCatalog) => void;
  setNavigatorMode: (mode: NavigatorMode) => void;
  toggleNavigator: () => void;
  setOnChangeHandler: (handler: ((doc: PageDocument) => void) | null) => void;
  dispatch: (executor: (doc: PageDocument) => CommandResult) => void;
  insertComponent: (type: string, registry: ComponentRegistry, parentId?: string) => InsertComponentResult;
  moveComponent: (
    nodeId: string,
    targetParentId: string,
    registry: ComponentRegistry,
    index?: number,
  ) => MoveComponentResult;
  duplicateComponent: (nodeId: string, registry: ComponentRegistry) => DuplicateComponentResult;
  deleteComponent: (nodeId: string) => DeleteComponentResult;
  updateNodeProps: (
    nodeId: string,
    props: Record<string, unknown>,
    registry: ComponentRegistry,
    merge?: boolean,
  ) => UpdatePropsResult;
  updateNodeStyle: (
    nodeId: string,
    styles: StyleDefinition,
    breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
    merge?: boolean,
  ) => UpdateStyleResult;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  copyNode: (nodeId: string) => void;
  pasteNode: (
    targetParentId: string,
    registry: ComponentRegistry,
    index?: number,
  ) => PasteComponentResult;
  selectNode: (nodeId: string | null) => void;
  hoverNode: (nodeId: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  getSelectedNode: () => Node | null;
  saveDraftAsTemplate: (metadata: SaveTemplateMetadata) => TemplateRecord;
  loadTemplate: (template: TemplateRecord | PageDocument, options?: CloneTemplateOptions) => void;
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
  variableCatalog: [],
  navigatorMode: 'floating',

  setVariableCatalog: (catalog) => set({ variableCatalog: catalog }),
  setNavigatorMode: (mode) => set({ navigatorMode: mode }),
  toggleNavigator: () =>
    set((state) => ({
      navigatorMode: state.navigatorMode === 'hidden' ? 'floating' : 'hidden',
    })),

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
    existingIds.add(nodeId);
    const children = buildDefaultChildren(definition.defaultChildren, existingIds, registry);
    const node: Node = {
      id: nodeId,
      type,
      props,
      ...(definition.defaultStyles ? { styles: deepClone(definition.defaultStyles) } : {}),
      ...(children ? { children } : {}),
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

  duplicateComponent: (nodeId, _registry) => {
    const state = get();

    if (nodeId === state.document.document.id) {
      return { success: false, error: 'Cannot duplicate the root page node.' };
    }

    const location = findNodeLocation(state.document.document, nodeId);
    if (!location || !location.parent) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    let newNodeId: string | undefined;
    try {
      get().dispatch((doc) => {
        const result = duplicateNode(doc, { nodeId });
        newNodeId = result.event.nodeId;
        return result;
      });
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    if (newNodeId) get().selectNode(newNodeId);
    return { success: true, nodeId: newNodeId };
  },

  deleteComponent: (nodeId) => {
    const state = get();

    if (nodeId === state.document.document.id) {
      return { success: false, error: 'Cannot delete the root page node.' };
    }

    if (!findNodeById(state.document.document, nodeId)) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    try {
      get().dispatch((doc) => removeNode(doc, { nodeId }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  updateNodeProps: (nodeId, props, registry, merge = true) => {
    const state = get();
    const node = findNodeById(state.document.document, nodeId);
    if (!node) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    const definition = registry.get(node.type);
    if (!definition) {
      return { success: false, error: `Unknown component type "${node.type}".` };
    }

    if (definition.validateProps) {
      const candidate = merge ? { ...deepClone(node.props ?? {}), ...deepClone(props) } : deepClone(props);
      const propResult = definition.validateProps(candidate);
      if (Array.isArray(propResult) && propResult.length > 0) {
        return { success: false, error: propResult.join(' ') };
      }
      if (propResult === false) {
        return { success: false, error: `Props failed validation for "${definition.label}".` };
      }
    }

    try {
      get().dispatch((doc) => updateProps(doc, { nodeId, props, merge }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  updateNodeStyle: (nodeId, styles, breakpoint, merge = true) => {
    try {
      get().dispatch((doc) => updateStyle(doc, { nodeId, styles, breakpoint, merge }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

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

  pasteNode: (targetParentId, registry, index) => {
    const { clipboard, document } = get();
    if (!clipboard) {
      return { success: false, error: 'Clipboard is empty.' };
    }

    const targetParent = findNodeById(document.document, targetParentId);
    if (!targetParent) {
      return { success: false, error: `Paste target "${targetParentId}" was not found in the document.` };
    }

    if (isDescendantOf(clipboard, targetParentId)) {
      return { success: false, error: 'Cannot paste a node into itself or one of its own descendants.' };
    }

    const policy = registry.canInsertChild(targetParent.type, clipboard.type);
    if (!policy.valid) {
      return { success: false, error: policy.errors.join(' ') };
    }

    const existingIds = collectNodeIdSet(document.document);
    const { clonedNode } = cloneTreeWithNewIds(clipboard, undefined, existingIds);

    try {
      get().dispatch((doc) => insertNode(doc, { parentId: targetParentId, node: clonedNode, index }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    get().selectNode(clonedNode.id);
    return { success: true, nodeId: clonedNode.id };
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  hoverNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  setViewport: (viewport) => set({ viewport }),
  getSelectedNode: () => {
    const { document, selectedNodeId } = get();
    if (!selectedNodeId) return null;
    return findNodeById(document.document, selectedNodeId);
  },

  saveDraftAsTemplate: (metadata) => {
    const currentDoc = get().document;
    return saveDraftAsTemplate(currentDoc, metadata);
  },

  loadTemplate: (template, options) => {
    const clonedDoc = cloneTemplateAsPage(template, options);
    get().setDocument(clonedDoc);
  },
}));

