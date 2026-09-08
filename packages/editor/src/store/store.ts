import { create } from 'zustand';
import {
  PageDocument,
  Node,
  Artboard,
  ProjectDocument,
  StyleDefinition,
  TemplateRecord,
  AnimationConfig,
  ActionPipeline,
  FormConfig,
  PROJECT_SCHEMA_NAME,
  CURRENT_PROJECT_SCHEMA_VERSION,
} from '@kubuild/schema';
import {
  createBlankDocument,
  findNodeById,
  findNodeLocation,
  isDescendantOf,
  getParentNodeId,
  insertNode,
  moveNode,
  duplicateNode,
  removeNode,
  updateProps,
  updateStyle,
  updateAnimation,
  updateActions,
  updateFormConfig,
  replaceNode,
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
  wrapNodeIntoFrame,
  ungroupNodeFrame,
  extractNodeToArtboard,
  findArtboardById,
  collectArtboardReferenceNodes,
} from '@kubuild/core';
import {
  ComponentRegistry,
  ComponentDefaultChildSpec,
  STARTER_BLOCKS,
  BlockDefinition,
} from '@kubuild/components';
import type { AiGenerationPlaceholderStatus } from '../ai/generate-page';

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type NavigatorMode = 'docked' | 'floating' | 'hidden';
export type TableSpreadsheetMode = 'floating' | 'docked' | 'hidden';
/** Panel mode for the AI Chat Panel (STORA-503), following the `NavigatorMode` pattern. */
export type AiChatPanelMode = 'docked' | 'floating' | 'hidden';

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  trigger: string;
  actionType: string;
  nodeId?: string;
  status: 'pending' | 'success' | 'error';
  payload?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export interface LiveFormState {
  formId?: string;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  dirty: boolean;
}

export interface UpdateFormConfigResult {
  success: boolean;
  error?: string;
}

export type DragPayload =
  | { type: 'component'; componentType: string }
  | { type: 'block'; blockId: string }
  | { type: 'node'; nodeId: string };

export interface InsertComponentResult {
  success: boolean;
  nodeId?: string;
  error?: string;
}

export interface DetachArtboardResult {
  success: boolean;
  /** Id of the newly created component artboard. */
  artboardId?: string;
  /** Id of the `artboard-reference` stub left behind in the page. */
  stubNodeId?: string;
  /** Trigger id `open_modal` / `close_modal` actions should target. */
  triggerId?: string;
  error?: string;
}

export interface RemoveArtboardResult {
  success: boolean;
  /** How many `artboard-reference` stubs were removed along with the artboard. */
  removedReferenceCount?: number;
  error?: string;
}

/**
 * Node types that are overlay surfaces by nature: inserting one inline would cover the page
 * being edited, so they get their own component artboard plus a pre-wired trigger instead.
 */
export const OVERLAY_COMPONENT_TYPES = ['modal', 'drawer'] as const;

/**
 * Synthetic artboard id standing for "the page document currently loaded in the store",
 * used when assembling a transient project for project-level commands.
 */
export const ACTIVE_PAGE_ARTBOARD_ID = 'active-page-artboard';

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

export interface UpdateAnimationResult {
  success: boolean;
  error?: string;
}

export interface UpdateActionsResult {
  success: boolean;
  error?: string;
}

// Duck-types Zod's issue-array shape (from updateStyle's schema.parse) vs plain
// Error (from updateProps/removeNode/etc) without adding a zod dependency here.
function formatCommandError(err: unknown): string {
  if (err && typeof err === 'object' && Array.isArray((err as { issues?: unknown }).issues)) {
    const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> })
      .issues;
    return issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
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
    const childNodes = buildDefaultChildren(
      spec.children ?? def?.defaultChildren,
      existingIds,
      registry,
    );
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
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  dragPayload: DragPayload | null;
  viewport: Viewport;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  clipboard: Node | null;
  onChangeHandler: ((doc: PageDocument) => void) | null;
  /** Host-declared bindable variables + editor/preview-only sample values (STORA-053). Never serialized to the document. */
  variableCatalog: VariableCatalog;
  navigatorMode: NavigatorMode;
  tableSpreadsheetMode: TableSpreadsheetMode;
  /** UI-only panel mode for the AI Chat Panel (STORA-503/504). Never serialized into `PageDocument`. */
  aiChatMode: AiChatPanelMode;
  /**
   * Monotonically-increasing signal (STORA-511) the AI Chat Panel watches to focus its
   * chat input and re-attach the current selection as context — e.g. "Ask AI about this
   * component" from the Inspector. UI-only, never serialized into `PageDocument`.
   */
  aiChatFocusRequestId: number;
  previewMode: boolean;
  multiDeviceMode: boolean;
  actionDebuggerOpen: boolean;
  actionLogs: ActionLogEntry[];
  liveFormState: LiveFormState | null;
  /**
   * Progressive-preview status for an in-flight `streamPage` AI generation session
   * (STORA-508). UI-only, like every other panel-mode field here — never serialized
   * into the document. `null` when no generation is in flight.
   */
  aiGenerationStatus: AiGenerationPlaceholderStatus | null;
  /**
   * Component artboards (detached modals/drawers/collapsibles, or any block the author
   * detached) belonging to the project currently open. Page artboards stay owned by the
   * host app's `pages` prop; only these live in the store for now.
   */
  componentArtboards: Artboard[];
  /**
   * Id of the component artboard `document` currently represents, or null while a page
   * artboard is being edited. The store still holds exactly one PageDocument at a time.
   */
  activeArtboardId: string | null;
  /** Page document stashed while editing a component artboard, restored on return. */
  artboardReturnDocument: PageDocument | null;

  setDocument: (document: PageDocument) => void;
  setDragPayload: (payload: DragPayload | null) => void;
  setVariableCatalog: (catalog: VariableCatalog) => void;
  setNavigatorMode: (mode: NavigatorMode) => void;
  toggleNavigator: () => void;
  setTableSpreadsheetMode: (mode: TableSpreadsheetMode) => void;
  toggleTableSpreadsheet: () => void;
  setAiChatMode: (mode: AiChatPanelMode) => void;
  toggleAiChat: () => void;
  /** Bumps `aiChatFocusRequestId` (STORA-511) — does not itself open the panel. */
  requestAiChatFocus: () => void;
  setPreviewMode: (enabled: boolean) => void;
  togglePreviewMode: () => void;
  setMultiDeviceMode: (enabled: boolean) => void;
  toggleMultiDeviceMode: () => void;
  setActionDebuggerOpen: (open: boolean) => void;
  toggleActionDebugger: () => void;
  addActionLog: (entry: Omit<ActionLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  clearActionLogs: () => void;
  setLiveFormState: (state: LiveFormState | null) => void;
  setOnChangeHandler: (handler: ((doc: PageDocument) => void) | null) => void;
  dispatch: (executor: (doc: PageDocument) => CommandResult) => void;
  /**
   * Groups every `dispatch()` call made until the matching `endHistoryTransaction()`
   * into a single undo entry (STORA-510) — e.g. every section an AI `streamPage`
   * session inserts. Delegates to `DocumentHistoryManager.beginTransaction()`, the same
   * history engine manual edits already use, so `undo()`/`redo()` need no special-casing.
   */
  beginHistoryTransaction: () => void;
  endHistoryTransaction: () => void;
  setAiGenerationStatus: (status: AiGenerationPlaceholderStatus | null) => void;
  setComponentArtboards: (artboards: Artboard[]) => void;
  /**
   * Detach a node's subtree into its own component artboard, leaving an
   * `artboard-reference` stub in the page. Works for any node type — this is the generic
   * "give this block its own surface" action, not a modal-only path.
   */
  detachNodeToArtboard: (nodeId: string, options?: { name?: string; activate?: boolean }) => DetachArtboardResult;
  /**
   * Switch which artboard the single in-store `document` represents. Pass null to return
   * to the page artboard. Commits the current document back into its artboard first.
   */
  activateArtboard: (artboardId: string | null) => void;
  /**
   * Delete a component artboard and the reference stubs pointing at it. Destructive: the
   * artboard's content goes with it (the stub removal is undoable, the artboard itself is not).
   */
  removeComponentArtboard: (artboardId: string) => RemoveArtboardResult;
  /** Persist a component artboard's free position on the builder canvas (unscaled px). */
  setComponentArtboardPosition: (artboardId: string, position: { x: number; y: number }) => void;
  /** Persist a component artboard's surface width in px. */
  setComponentArtboardWidth: (artboardId: string, width: number) => void;
  insertComponent: (
    type: string,
    registry: ComponentRegistry,
    parentId?: string,
    index?: number,
  ) => InsertComponentResult;
  insertBlock: (
    blockOrId: BlockDefinition | string,
    parentId?: string,
    index?: number,
  ) => InsertComponentResult;
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
  /**
   * Replaces a node's entire subtree in place via `@kubuild/core`'s `replaceNode` command
   * (STORA-514) — used by the AI enhance Apply flow when a validated candidate's nested
   * `children` differ structurally from the original, a change `updateNodeProps`/
   * `updateNodeStyle` alone can't express. Same command-engine/history path as every
   * other mutation here: it lands in `DocumentHistoryManager` and `undo()` reverts it.
   */
  replaceNodeSubtree: (
    nodeId: string,
    node: Node,
    registry: ComponentRegistry,
  ) => UpdatePropsResult;
  /**
   * Reset a specific overridden style property on a breakpoint layer, falling back to inherited base (STORA-141).
   */
  resetNodeStyleProperty: (
    nodeId: string,
    property: string,
    breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
  ) => UpdateStyleResult;
  /**
   * Reset all overridden style properties on a breakpoint layer, falling back entirely to base.
   */
  resetNodeViewportStyles: (
    nodeId: string,
    breakpoint: 'base' | 'desktop' | 'tablet' | 'mobile',
  ) => UpdateStyleResult;
  /**
   * Update a pseudo-state style layer (e.g. ':hover') on a node — STORA-221.
   * Writes to node.styles.states[state] without touching default values.
   */
  updateNodeStateStyle: (
    nodeId: string,
    styles: StyleDefinition,
    state: string,
    merge?: boolean,
  ) => UpdateStyleResult;
  updateNodeAnimation: (
    nodeId: string,
    animation: Partial<AnimationConfig> | null,
    merge?: boolean,
  ) => UpdateAnimationResult;
  updateNodeActions: (
    nodeId: string,
    actions: ActionPipeline[] | null,
  ) => UpdateActionsResult;
  updateNodeFormConfig: (
    nodeId: string,
    formConfig: Partial<FormConfig> | null,
    merge?: boolean,
  ) => UpdateFormConfigResult;
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
  selectMultipleNodes: (ids: string[]) => void;
  toggleNodeSelection: (id: string, multi: boolean) => void;
  wrapSelectedIntoFrame: () => { success: boolean; nodeId?: string; error?: string };
  ungroupSelectedFrame: () => { success: boolean; unwrappedIds?: string[]; error?: string };
  selectParent: () => void;
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

function selectionAfterMultiple(document: PageDocument, selectedNodeIds: string[]): string[] {
  if (!selectedNodeIds || selectedNodeIds.length === 0) return [];
  return selectedNodeIds.filter((id) => !!findNodeById(document.document, id));
}

/**
 * Route a committed document to whichever surface actually owns it.
 *
 * The store holds exactly one PageDocument, which may belong either to the host's active
 * page or to a component artboard. Handing a component artboard's document to
 * `onChangeHandler` would make the host save it over the page it was detached from, so
 * artboard edits are written back into `componentArtboards` instead.
 */
function commitDocumentToOwner(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
  document: PageDocument,
): void {
  const { activeArtboardId, componentArtboards, onChangeHandler } = get();
  if (activeArtboardId) {
    set({
      componentArtboards: componentArtboards.map((artboard) =>
        artboard.id === activeArtboardId ? { ...artboard, document } : artboard,
      ),
    });
    return;
  }
  onChangeHandler?.(document);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  document: historyManager.document,
  selectedNodeId: null,
  selectedNodeIds: [],
  hoveredNodeId: null,
  dragPayload: null,
  viewport: 'desktop',
  isDirty: false,
  canUndo: false,
  canRedo: false,
  clipboard: null,
  onChangeHandler: null,
  variableCatalog: [],
  navigatorMode: 'floating',
  tableSpreadsheetMode: 'floating',
  aiChatMode: 'hidden',
  aiChatFocusRequestId: 0,
  previewMode: false,
  multiDeviceMode: false,
  actionDebuggerOpen: false,
  actionLogs: [],
  liveFormState: null,
  aiGenerationStatus: null,
  componentArtboards: [],
  activeArtboardId: null,
  artboardReturnDocument: null,

  setDragPayload: (payload) => set({ dragPayload: payload }),
  setVariableCatalog: (catalog) => set({ variableCatalog: catalog }),
  setNavigatorMode: (mode) => set({ navigatorMode: mode }),
  toggleNavigator: () =>
    set((state) => ({
      navigatorMode: state.navigatorMode === 'hidden' ? 'floating' : 'hidden',
    })),
  setTableSpreadsheetMode: (mode) => set({ tableSpreadsheetMode: mode }),
  toggleTableSpreadsheet: () =>
    set((state) => ({
      tableSpreadsheetMode: state.tableSpreadsheetMode === 'hidden' ? 'floating' : 'hidden',
    })),
  setAiChatMode: (mode) => set({ aiChatMode: mode }),
  toggleAiChat: () =>
    set((state) => ({
      aiChatMode: state.aiChatMode === 'hidden' ? 'floating' : 'hidden',
    })),
  requestAiChatFocus: () =>
    set((state) => ({ aiChatFocusRequestId: state.aiChatFocusRequestId + 1 })),
  setPreviewMode: (enabled) =>
    set((state) => ({
      previewMode: enabled,
      actionDebuggerOpen: enabled ? state.actionDebuggerOpen : false,
      selectedNodeId: enabled ? null : state.selectedNodeId,
      selectedNodeIds: enabled ? [] : state.selectedNodeIds,
      hoveredNodeId: null,
    })),
  togglePreviewMode: () =>
    set((state) => {
      const next = !state.previewMode;
      return {
        previewMode: next,
        actionDebuggerOpen: next ? state.actionDebuggerOpen : false,
        selectedNodeId: next ? null : state.selectedNodeId,
        selectedNodeIds: next ? [] : state.selectedNodeIds,
        hoveredNodeId: null,
      };
    }),
  setMultiDeviceMode: (enabled) => set({ multiDeviceMode: enabled }),
  toggleMultiDeviceMode: () => set((state) => ({ multiDeviceMode: !state.multiDeviceMode })),
  setActionDebuggerOpen: (open) => set({ actionDebuggerOpen: open }),
  toggleActionDebugger: () => set((state) => ({ actionDebuggerOpen: !state.actionDebuggerOpen })),
  addActionLog: (entry) =>
    set((state) => ({
      actionLogs: [
        {
          id: entry.id || `act-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: entry.timestamp || new Date().toISOString(),
          ...entry,
        },
        ...state.actionLogs,
      ].slice(0, 100),
    })),
  clearActionLogs: () => set({ actionLogs: [] }),
  setLiveFormState: (formState) => set({ liveFormState: formState }),

  setDocument: (document) => {
    historyManager = new DocumentHistoryManager(document);
    set({
      document: historyManager.document,
      isDirty: false,
      selectedNodeId: null,
      selectedNodeIds: [],
      hoveredNodeId: null,
      dragPayload: null,
      clipboard: null,
      canUndo: false,
      canRedo: false,
      aiGenerationStatus: null,
      // A wholesale document swap (e.g. the host switching pages) means we are editing a
      // page again, so any component-artboard editing session is no longer in effect.
      activeArtboardId: null,
      artboardReturnDocument: null,
    });
  },

  setComponentArtboards: (artboards) => set({ componentArtboards: artboards }),

  detachNodeToArtboard: (nodeId, options = {}) => {
    const state = get();
    if (state.activeArtboardId) {
      return {
        success: false,
        error: 'Detaching is only available while editing a page artboard.',
      };
    }
    if (!findNodeById(state.document.document, nodeId)) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    // The store holds a single PageDocument, so assemble a transient project around it:
    // the active page plus the component artboards already known. extractNodeToArtboard
    // then enforces project-wide id uniqueness for us.
    const pageArtboardId = ACTIVE_PAGE_ARTBOARD_ID;
    const project: ProjectDocument = {
      schema: PROJECT_SCHEMA_NAME,
      version: CURRENT_PROJECT_SCHEMA_VERSION,
      artboards: [
        {
          id: pageArtboardId,
          name: state.document.metadata?.title ?? 'Page',
          artboardType: 'page',
          document: state.document,
        },
        ...state.componentArtboards,
      ],
      activeArtboardId: pageArtboardId,
    };

    let result;
    try {
      result = extractNodeToArtboard(project, {
        artboardId: pageArtboardId,
        nodeId,
        ...(options.name ? { name: options.name } : {}),
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const updatedPage = findArtboardById(result.project, pageArtboardId)?.document;
    const newArtboard = findArtboardById(result.project, result.event.artboardId);
    if (!updatedPage || !newArtboard) {
      return { success: false, error: 'Detaching produced an unexpected project shape.' };
    }

    const stubNodeId = result.event.payload?.stubNodeId as string | undefined;

    // Commit the page-side change through dispatch so it lands in the normal undo stack.
    // Undo caveat (Phase 1): history is per-document, so undoing this restores the page tree
    // but leaves the new artboard in place — it can be removed explicitly.
    get().dispatch(() => ({
      document: updatedPage,
      event: {
        type: 'NODE_REMOVED',
        timestamp: new Date().toISOString(),
        nodeId,
        payload: {
          reason: 'detached-to-artboard',
          artboardId: newArtboard.id,
          stubNodeId,
        },
      },
    }));

    set((current) => ({ componentArtboards: [...current.componentArtboards, newArtboard] }));

    if (options.activate) {
      get().activateArtboard(newArtboard.id);
    } else if (stubNodeId) {
      get().selectNode(stubNodeId);
    }

    return {
      success: true,
      artboardId: newArtboard.id,
      stubNodeId,
      triggerId: newArtboard.triggerId,
    };
  },

  activateArtboard: (artboardId) => {
    const state = get();
    if (artboardId === state.activeArtboardId) return;

    // Commit whatever is currently loaded back into its owning artboard first.
    let artboards = state.componentArtboards;
    if (state.activeArtboardId) {
      artboards = artboards.map((artboard) =>
        artboard.id === state.activeArtboardId
          ? { ...artboard, document: state.document }
          : artboard,
      );
    }

    if (artboardId === null) {
      const pageDocument = state.artboardReturnDocument ?? state.document;
      historyManager = new DocumentHistoryManager(pageDocument);
      set({
        componentArtboards: artboards,
        activeArtboardId: null,
        artboardReturnDocument: null,
        document: historyManager.document,
        selectedNodeId: null,
        selectedNodeIds: [],
        hoveredNodeId: null,
        dragPayload: null,
        canUndo: false,
        canRedo: false,
      });
      return;
    }

    const target = artboards.find((artboard) => artboard.id === artboardId);
    if (!target) return;

    historyManager = new DocumentHistoryManager(target.document);
    set({
      componentArtboards: artboards,
      activeArtboardId: artboardId,
      // Only stash the page document when leaving a page, never when hopping
      // between two component artboards.
      artboardReturnDocument: state.activeArtboardId ? state.artboardReturnDocument : state.document,
      document: historyManager.document,
      selectedNodeId: null,
      selectedNodeIds: [],
      hoveredNodeId: null,
      dragPayload: null,
      canUndo: false,
      canRedo: false,
    });
  },

  removeComponentArtboard: (artboardId) => {
    const state = get();
    const target = state.componentArtboards.find((artboard) => artboard.id === artboardId);
    if (!target) {
      return { success: false, error: `Artboard "${artboardId}" was not found.` };
    }

    // Return to the page before deleting. Needed even when a *different* artboard is
    // active: the store holds one document at a time, so the page has to be the loaded one
    // for its reference stubs to be reachable — otherwise deleting would strand a stub
    // pointing at an artboard that no longer exists. Pending edits in the artboard being
    // left are committed by activateArtboard, so nothing is lost.
    if (state.activeArtboardId) {
      get().activateArtboard(null);
    }

    // Remove the reference stubs that pointed at it, otherwise the page keeps a chip
    // opening an artboard that no longer exists (and validateProject flags it as dangling).
    // Grouped into one undo entry so removing an artboard is a single step.
    const stubs = collectArtboardReferenceNodes(get().document.document).filter(
      (ref) => ref.artboardId === artboardId,
    );
    if (stubs.length > 0) {
      get().beginHistoryTransaction();
      try {
        for (const stub of stubs) {
          get().dispatch((doc) => removeNode(doc, { nodeId: stub.nodeId }));
        }
      } finally {
        get().endHistoryTransaction();
      }
    }

    set((current) => ({
      componentArtboards: current.componentArtboards.filter((artboard) => artboard.id !== artboardId),
    }));

    return { success: true, removedReferenceCount: stubs.length };
  },

  setComponentArtboardPosition: (artboardId, position) =>
    set((current) => ({
      componentArtboards: current.componentArtboards.map((artboard) =>
        artboard.id === artboardId ? { ...artboard, position } : artboard,
      ),
    })),

  setComponentArtboardWidth: (artboardId, width) =>
    set((current) => ({
      componentArtboards: current.componentArtboards.map((artboard) =>
        artboard.id === artboardId ? { ...artboard, width: Math.max(1, Math.round(width)) } : artboard,
      ),
    })),

  setOnChangeHandler: (handler) => set({ onChangeHandler: handler }),

  dispatch: (executor) => {
    const result = historyManager.execute(executor);
    const { selectedNodeId, selectedNodeIds } = get();
    const updatedIds = selectionAfterMultiple(result.document, selectedNodeIds);
    const updatedPrimary =
      selectionAfter(result.document, selectedNodeId) ?? (updatedIds.length > 0 ? updatedIds[0] : null);
    set({
      document: result.document,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: updatedPrimary,
      selectedNodeIds: updatedIds,
    });
    commitDocumentToOwner(get, set, result.document);
  },

  beginHistoryTransaction: () => {
    historyManager.beginTransaction();
  },

  endHistoryTransaction: () => {
    historyManager.endTransaction();
    // A transaction may have started with no prior document changes; refresh
    // canUndo/canRedo now in case the grouped entry was just committed.
    set({
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
    });
  },

  setAiGenerationStatus: (status) => set({ aiGenerationStatus: status }),

  insertComponent: (type, registry, parentId, index) => {
    const state = get();
    const targetParentId = parentId ?? state.selectedNodeId ?? state.document.document.id;
    const parentNode = findNodeById(state.document.document, targetParentId);
    if (!parentNode) {
      return {
        success: false,
        error: `Insertion target "${targetParentId}" was not found in the document.`,
      };
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
        return {
          success: false,
          error: `Default props for "${definition.label}" failed validation.`,
        };
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

    get().dispatch((doc) => insertNode(doc, { parentId: targetParentId, node, index }));

    // Overlay surfaces (modal, drawer) would blanket the page while it's being edited, so
    // they immediately move onto their own artboard, leaving a reference stub plus a
    // pre-wired trigger button in the page. Everything else stays inline as before.
    if (!state.activeArtboardId && (OVERLAY_COMPONENT_TYPES as readonly string[]).includes(type)) {
      const detached = get().detachNodeToArtboard(nodeId, { name: definition.label });
      if (detached.success && detached.triggerId && detached.stubNodeId) {
        const triggerId = detached.triggerId;
        const stubNodeId = detached.stubNodeId;
        const triggerNodeId = generateComponentNodeId('button', collectNodeIdSet(get().document.document));
        const triggerNode: Node = {
          id: triggerNodeId,
          type: 'button',
          props: {
            label: `Open ${definition.label}`,
            modalId: triggerId,
            variant: 'primary',
          },
          actions: [
            {
              id: `${triggerNodeId}-pipeline`,
              trigger: 'click',
              label: `Open ${definition.label}`,
              enabled: true,
              steps: [
                {
                  id: `${triggerNodeId}-step`,
                  type: 'open_modal',
                  label: `Open ${definition.label}`,
                  payload: { modalId: triggerId, modalNodeId: triggerId, toggle: true },
                },
              ],
            },
          ] as ActionPipeline[],
        };

        const stubParentId =
          getParentNodeId(get().document.document, stubNodeId) ?? get().document.document.id;
        get().dispatch((doc) => insertNode(doc, { parentId: stubParentId, node: triggerNode }));
        get().selectNode(triggerNodeId);
        return { success: true, nodeId: triggerNodeId };
      }
    }

    get().selectNode(nodeId);

    return { success: true, nodeId };
  },

  insertBlock: (blockOrId, parentId, index) => {
    const state = get();
    const targetParentId = parentId ?? state.selectedNodeId ?? state.document.document.id;

    let blockDef: BlockDefinition | undefined;
    if (typeof blockOrId === 'string') {
      blockDef = STARTER_BLOCKS.find((b) => b.id === blockOrId);
    } else {
      blockDef = blockOrId;
    }

    if (!blockDef) {
      return { success: false, error: 'Block definition not found.' };
    }

    const existingIds = collectNodeIdSet(state.document.document);
    let counter = 1;
    const generateId = (prefix = 'node') => {
      let id = `${prefix}-${Date.now().toString(36)}-${counter++}`;
      while (existingIds.has(id)) {
        id = `${prefix}-${Date.now().toString(36)}-${counter++}`;
      }
      existingIds.add(id);
      return id;
    };

    const nodeTree = blockDef.createNodeTree(generateId);

    try {
      get().dispatch((doc) => insertNode(doc, { parentId: targetParentId, node: nodeTree, index }));
      get().selectNode(nodeTree.id);
      return { success: true, nodeId: nodeTree.id };
    } catch {
      // Fallback: try inserting at root
      try {
        get().dispatch((doc) =>
          insertNode(doc, { parentId: state.document.document.id, node: nodeTree }),
        );
        get().selectNode(nodeTree.id);
        return { success: true, nodeId: nodeTree.id };
      } catch (err) {
        return { success: false, error: formatCommandError(err) };
      }
    }
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
      return {
        success: false,
        error: `Move target "${targetParentId}" was not found in the document.`,
      };
    }

    if (isDescendantOf(sourceLocation.node, targetParentId)) {
      return {
        success: false,
        error: 'Cannot move a node into itself or one of its own descendants.',
      };
    }

    const policy = registry.canInsertChild(targetParent.type, sourceLocation.node.type);
    if (!policy.valid) {
      return { success: false, error: policy.errors.join(' ') };
    }

    // Reordering within the same parent: the source slot is removed before the
    // target index is applied, so any target position after it shifts left by one.
    const adjustedIndex =
      sourceLocation.parent.id === targetParentId &&
      typeof index === 'number' &&
      index > sourceLocation.index
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
      const candidate = merge
        ? { ...deepClone(node.props ?? {}), ...deepClone(props) }
        : deepClone(props);
      if (merge) {
        for (const key of Object.keys(props)) {
          if (props[key] === undefined) {
            delete candidate[key];
          }
        }
      }
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

  replaceNodeSubtree: (nodeId, node, registry) => {
    const state = get();
    if (!findNodeById(state.document.document, nodeId)) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }

    const definition = registry.get(node.type);
    if (definition?.validateProps) {
      const propResult = definition.validateProps(node.props ?? {});
      if (Array.isArray(propResult) && propResult.length > 0) {
        return { success: false, error: propResult.join(' ') };
      }
      if (propResult === false) {
        return { success: false, error: `Props failed validation for "${definition.label}".` };
      }
    }

    try {
      get().dispatch((doc) => replaceNode(doc, { nodeId, node }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  resetNodeStyleProperty: (nodeId, property, breakpoint) => {
    const state = get();
    const node = findNodeById(state.document.document, nodeId);
    if (!node) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }
    const currentBp = { ...((node.styles?.[breakpoint] as StyleDefinition) || {}) };
    delete currentBp[property];
    return get().updateNodeStyle(nodeId, currentBp, breakpoint, false);
  },

  resetNodeViewportStyles: (nodeId, breakpoint) => {
    const state = get();
    const node = findNodeById(state.document.document, nodeId);
    if (!node) {
      return { success: false, error: `Node "${nodeId}" was not found in the document.` };
    }
    return get().updateNodeStyle(nodeId, {}, breakpoint, false);
  },

  updateNodeStateStyle: (nodeId, styles, state, merge = true) => {
    try {
      get().dispatch((doc) => updateStyle(doc, { nodeId, styles, state, merge }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  updateNodeAnimation: (nodeId, animation, merge = true) => {
    try {
      get().dispatch((doc) => updateAnimation(doc, { nodeId, animation, merge }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  updateNodeActions: (nodeId, actions) => {
    try {
      get().dispatch((doc) => updateActions(doc, { nodeId, actions }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  updateNodeFormConfig: (nodeId, formConfig, merge = true) => {
    try {
      get().dispatch((doc) => updateFormConfig(doc, { nodeId, formConfig, merge }));
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    return { success: true };
  },

  undo: () => {
    const restored = historyManager.undo();
    if (!restored) return;
    const { selectedNodeId, selectedNodeIds } = get();
    const updatedIds = selectionAfterMultiple(restored, selectedNodeIds);
    const updatedPrimary =
      selectionAfter(restored, selectedNodeId) ?? (updatedIds.length > 0 ? updatedIds[0] : null);
    set({
      document: restored,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: updatedPrimary,
      selectedNodeIds: updatedIds,
    });
    commitDocumentToOwner(get, set, restored);
  },

  redo: () => {
    const restored = historyManager.redo();
    if (!restored) return;
    const { selectedNodeId, selectedNodeIds } = get();
    const updatedIds = selectionAfterMultiple(restored, selectedNodeIds);
    const updatedPrimary =
      selectionAfter(restored, selectedNodeId) ?? (updatedIds.length > 0 ? updatedIds[0] : null);
    set({
      document: restored,
      isDirty: true,
      canUndo: historyManager.canUndo,
      canRedo: historyManager.canRedo,
      selectedNodeId: updatedPrimary,
      selectedNodeIds: updatedIds,
    });
    commitDocumentToOwner(get, set, restored);
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
      return {
        success: false,
        error: `Paste target "${targetParentId}" was not found in the document.`,
      };
    }

    if (isDescendantOf(clipboard, targetParentId)) {
      return {
        success: false,
        error: 'Cannot paste a node into itself or one of its own descendants.',
      };
    }

    const policy = registry.canInsertChild(targetParent.type, clipboard.type);
    if (!policy.valid) {
      return { success: false, error: policy.errors.join(' ') };
    }

    const existingIds = collectNodeIdSet(document.document);
    const { clonedNode } = cloneTreeWithNewIds(clipboard, undefined, existingIds);

    try {
      get().dispatch((doc) =>
        insertNode(doc, { parentId: targetParentId, node: clonedNode, index }),
      );
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }

    get().selectNode(clonedNode.id);
    return { success: true, nodeId: clonedNode.id };
  },

  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      selectedNodeIds: nodeId ? [nodeId] : [],
    }),

  selectMultipleNodes: (ids) => {
    const validIds = Array.from(
      new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    );
    set({
      selectedNodeIds: validIds,
      selectedNodeId: validIds.length > 0 ? validIds[0] : null,
    });
  },

  toggleNodeSelection: (id, multi) => {
    if (!id) return;
    if (!multi) {
      set({
        selectedNodeId: id,
        selectedNodeIds: [id],
      });
      return;
    }
    const { selectedNodeIds } = get();
    if (selectedNodeIds.includes(id)) {
      const next = selectedNodeIds.filter((nodeId) => nodeId !== id);
      set({
        selectedNodeIds: next,
        selectedNodeId: next.length > 0 ? next[0] : null,
      });
    } else {
      const next = [...selectedNodeIds, id];
      set({
        selectedNodeIds: next,
        selectedNodeId: next[0],
      });
    }
  },

  wrapSelectedIntoFrame: () => {
    const { selectedNodeIds, selectedNodeId, document } = get();
    const rawIds =
      selectedNodeIds.length > 0
        ? selectedNodeIds
        : selectedNodeId
          ? [selectedNodeId]
          : [];
    const targetIds = Array.from(
      new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
    );
    if (targetIds.length === 0) {
      return { success: false, error: 'Cannot wrap nodes: At least one node ID must be provided.' };
    }
    if (targetIds.includes(document.document.id)) {
      return { success: false, error: 'Cannot wrap the root page node.' };
    }

    try {
      let frameId: string | undefined;
      get().dispatch((doc) => {
        const result = wrapNodeIntoFrame(doc, { nodeIds: targetIds });
        frameId = result.event.nodeId;
        return result;
      });
      if (frameId) {
        get().selectNode(frameId);
      }
      return { success: true, nodeId: frameId };
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }
  },

  ungroupSelectedFrame: () => {
    const { selectedNodeId, document } = get();
    if (!selectedNodeId) {
      return { success: false, error: 'Invalid nodeId: Node ID must be a non-empty string.' };
    }
    if (selectedNodeId === document.document.id) {
      return { success: false, error: 'Cannot ungroup the root page node.' };
    }

    const node = findNodeById(document.document, selectedNodeId);
    if (!node || node.type !== 'flex') {
      return {
        success: false,
        error: `Cannot ungroup node: Node "${selectedNodeId}" is not a flex container (type is "${node?.type}").`,
      };
    }

    try {
      let unwrappedIds: string[] = [];
      get().dispatch((doc) => {
        const result = ungroupNodeFrame(doc, { nodeId: selectedNodeId });
        unwrappedIds =
          (result.event.payload as { unwrappedChildIds?: string[] })?.unwrappedChildIds ?? [];
        return result;
      });
      if (unwrappedIds.length > 0) {
        get().selectMultipleNodes(unwrappedIds);
      } else {
        get().selectNode(null);
      }
      return { success: true, unwrappedIds };
    } catch (err) {
      return { success: false, error: formatCommandError(err) };
    }
  },

  selectParent: () => {
    const { document, selectedNodeId } = get();
    if (!selectedNodeId) return;
    const parentId = getParentNodeId(document.document, selectedNodeId);
    if (parentId) {
      set({ selectedNodeId: parentId, selectedNodeIds: [parentId] });
    }
  },
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
