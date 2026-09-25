import type { StoreApi } from 'zustand';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';
import type { BlockDefinition, ComponentRegistry } from '@kubuild/components';
import type {
  ApplyTemplateResult,
  EditorState,
  InsertComponentResult,
  ReplaceDocumentResult,
} from '../../store';

/**
 * Imperative API exposed by `KubuildEditor` through `ref` (STORA-538). Lets a host swap the
 * document (after applying a template server-side, reverting to the published version, …)
 * without remounting the editor and losing history / selection.
 */
export interface EditorHandle {
  /** The document currently being edited. */
  getDocument: () => PageDocument;
  /**
   * Replaces the document after `validateDocument`. Rejected (with the validation errors in
   * the result) when invalid. `keepHistory: true` makes the swap a single undo step.
   */
  replaceDocument: (
    doc: PageDocument,
    options?: { keepHistory?: boolean },
  ) => ReplaceDocumentResult;
  /**
   * Inserts a block — a `BlockDefinition` or the id of one in the block registry — into
   * `targetId` (default: the selected node, else the page root).
   */
  insertBlock: (
    block: BlockDefinition | string,
    targetId?: string,
    index?: number,
  ) => InsertComponentResult;
  /** Replaces the page with a clone of `template` (undoable). */
  applyTemplate: (template: TemplateRecord) => ApplyTemplateResult;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** Whether there are edits not yet persisted through `onSave`. */
  isDirty: () => boolean;
  /** Runs `onSave` now (same as Cmd/Ctrl+S). Resolves `false` without an `onSave` handler. */
  save: () => Promise<boolean>;
}

/** Builds an `EditorHandle` over the editor store; `KubuildEditor` wires it to its `ref`. */
export function createEditorHandle(
  store: Pick<StoreApi<EditorState>, 'getState'>,
  options: {
    registry: () => ComponentRegistry | undefined;
    save?: () => Promise<boolean>;
    onTemplateApplied?: (template: TemplateRecord, doc: PageDocument) => void;
  },
): EditorHandle {
  return {
    getDocument: () => store.getState().document,
    replaceDocument: (doc, replaceOptions = {}) =>
      store.getState().replaceDocument(doc, {
        keepHistory: replaceOptions.keepHistory,
        registry: options.registry(),
      }),
    insertBlock: (block, targetId, index) => store.getState().insertBlock(block, targetId, index),
    applyTemplate: (template) => {
      const result = store.getState().applyTemplate(template, { registry: options.registry() });
      if (result.success && result.document) options.onTemplateApplied?.(template, result.document);
      return result;
    },
    undo: () => store.getState().undo(),
    redo: () => store.getState().redo(),
    canUndo: () => store.getState().canUndo,
    canRedo: () => store.getState().canRedo,
    isDirty: () => store.getState().isDirty,
    save: () => options.save?.() ?? Promise.resolve(false),
  };
}
