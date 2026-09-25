import type { StoreApi } from 'zustand';
import type { PageDocument } from '@kubuild/schema';
import type { EditorState } from '../../store';

/** Host save callback (STORA-537). A rejected promise / thrown error marks the save failed. */
export type EditorSaveHandler = (doc: PageDocument) => Promise<void> | void;

export type EditorSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorSaveState {
  status: EditorSaveStatus;
  /** The error from the last failed save, cleared by the next successful one. */
  error: unknown;
  /** `Date.now()` of the last successful save. */
  lastSavedAt: number | null;
}

export interface EditorAutosaveOptions {
  /** Quiet period after the last edit before the document is saved. */
  debounceMs: number;
}

export interface EditorSaveController {
  /**
   * Saves the current document through the host handler. Resolves `true` on success,
   * `false` when it failed or no handler is set. A save requested while another is in
   * flight runs once that one settles, so the latest document is always what lands last.
   */
  save: () => Promise<boolean>;
  getState: () => EditorSaveState;
  subscribe: (listener: (state: EditorSaveState) => void) => () => void;
  dispose: () => void;
}

type SaveStore = Pick<StoreApi<EditorState>, 'getState' | 'subscribe'>;

/**
 * Save / dirty-state orchestration for `KubuildEditor` (STORA-537), kept free of React so
 * it can be driven directly in tests. Options are read lazily through getters so the
 * editor can pass the latest props without recreating the controller.
 *
 * - `isDirty` transitions are reported through `onDirtyChange`.
 * - A successful save calls `markSaved(savedDoc)`: edits made while the save was in flight
 *   keep the editor dirty.
 * - With `autosave`, every document change while dirty (re)starts a debounce timer.
 */
export function createEditorSaveController(
  store: SaveStore,
  options: {
    onSave: () => EditorSaveHandler | undefined;
    onDirtyChange?: () => ((isDirty: boolean) => void) | undefined;
    autosave?: () => EditorAutosaveOptions | undefined;
  },
): EditorSaveController {
  let state: EditorSaveState = { status: 'idle', error: null, lastSavedAt: null };
  const listeners = new Set<(state: EditorSaveState) => void>();
  let inflight: Promise<boolean> | null = null;
  let followUp: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const setState = (patch: Partial<EditorSaveState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };

  const cancelTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const run = async (): Promise<boolean> => {
    const handler = options.onSave();
    if (!handler || disposed) return false;
    const doc = store.getState().document;
    setState({ status: 'saving' });
    try {
      await handler(doc);
      if (disposed) return true;
      store.getState().markSaved(doc);
      setState({ status: 'saved', error: null, lastSavedAt: Date.now() });
      return true;
    } catch (error) {
      if (!disposed) setState({ status: 'error', error });
      return false;
    }
  };

  const save = (): Promise<boolean> => {
    cancelTimer();
    if (inflight) {
      if (!followUp) {
        followUp = inflight.then(() => {
          followUp = null;
          return save();
        });
      }
      return followUp;
    }
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  const scheduleAutosave = () => {
    const autosave = options.autosave?.();
    if (!autosave || !options.onSave()) return;
    cancelTimer();
    timer = setTimeout(
      () => {
        timer = null;
        if (!disposed && store.getState().isDirty) void save();
      },
      Math.max(0, autosave.debounceMs),
    );
  };

  const unsubscribe = store.subscribe((next, prev) => {
    if (next.isDirty !== prev.isDirty) options.onDirtyChange?.()?.(next.isDirty);
    if (next.document !== prev.document && next.isDirty) scheduleAutosave();
  });

  return {
    save,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      disposed = true;
      cancelTimer();
      unsubscribe();
      listeners.clear();
    },
  };
}
