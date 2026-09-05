import { PageDocument } from '@kubuild/schema';
import { DocumentChangeEvent, CommandResult } from './commands';
import { deepClone } from './command-tree-utils';

export interface HistoryOptions {
  /**
   * Maximum number of historical states stored in the undo stack.
   * Defaults to 50.
   */
  maxHistory?: number;
}

export interface HistoryEntry<T> {
  state: T;
  event?: DocumentChangeEvent;
  timestamp: string;
}

export interface HistoryState<T> {
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  present: T;
}

export const DEFAULT_MAX_HISTORY = 50;

/**
 * Generic History Engine for immutable state transitions.
 * Maintains undo/redo stacks, enforces maximum history limit,
 * clears redo stack on new actions, and supports resetting state.
 */
export class HistoryEngine<T = PageDocument> {
  private past: HistoryEntry<T>[] = [];
  private current: HistoryEntry<T>;
  private future: HistoryEntry<T>[] = [];
  private readonly maxHistory: number;
  // STORA-510: grouped-history transaction bookkeeping. `transactionAnchor` is the
  // entry that was `current` immediately before the outermost `beginTransaction()`
  // call — the single state `endTransaction()` restores undo history to.
  private transactionDepth = 0;
  private transactionAnchor: HistoryEntry<T> | null = null;

  constructor(initialState: T, options: HistoryOptions = {}) {
    if (initialState === undefined || initialState === null) {
      throw new Error('Initial state must be defined.');
    }

    const limit = options.maxHistory ?? DEFAULT_MAX_HISTORY;
    if (typeof limit !== 'number' || limit <= 0 || !Number.isFinite(limit)) {
      throw new Error('maxHistory option must be a positive integer.');
    }

    this.maxHistory = Math.floor(limit);
    this.current = {
      state: deepClone(initialState),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the current active state (returns an immutable clone).
   */
  get present(): T {
    return deepClone(this.current.state);
  }

  /**
   * Check if undo is available.
   */
  canUndo(): boolean {
    return this.past.length > 0;
  }

  /**
   * Check if redo is available.
   */
  canRedo(): boolean {
    return this.future.length > 0;
  }

  /**
   * Get total number of states in undo stack.
   */
  get undoCount(): number {
    return this.past.length;
  }

  /**
   * Get total number of states in redo stack.
   */
  get redoCount(): number {
    return this.future.length;
  }

  /**
   * Get max history limit.
   */
  get limit(): number {
    return this.maxHistory;
  }

  /**
   * Push a new state.
   * Clears the redo stack and shifts oldest past entries if maxHistory is exceeded.
   *
   * STORA-510: while a transaction is active (see `beginTransaction`), pushes update
   * `current` in place without creating an individual undo entry — the whole group
   * collapses into one entry when `endTransaction()` is called.
   */
  push(nextState: T, event?: DocumentChangeEvent): void {
    if (nextState === undefined || nextState === null) {
      throw new Error('Cannot push undefined or null state into history.');
    }

    if (this.transactionDepth > 0) {
      this.current = {
        state: deepClone(nextState),
        event,
        timestamp: new Date().toISOString(),
      };
      return;
    }

    // Save current to past
    this.past.push(this.current);

    // Enforce maxHistory limit on undo stack
    while (this.past.length > this.maxHistory) {
      this.past.shift();
    }

    // Set new current
    this.current = {
      state: deepClone(nextState),
      event,
      timestamp: new Date().toISOString(),
    };

    // Any new action clears redo future stack
    this.future = [];
  }

  /**
   * Begin a grouped-history transaction (STORA-510).
   *
   * Every `push()` made between `beginTransaction()` and the matching outermost
   * `endTransaction()` updates the live state immediately (so `present`/`getState()`
   * always reflect the latest change), but no individual undo entry is recorded until
   * the transaction ends. This is how a multi-step action (e.g. one `streamPage`
   * generation session inserting several sections) collapses into a single undo step.
   *
   * Transactions may be nested; only the outermost `beginTransaction`/`endTransaction`
   * pair has any effect, so a batching caller can safely wrap calls that themselves
   * might also start their own (nested) transaction.
   */
  beginTransaction(): void {
    if (this.transactionDepth === 0) {
      this.transactionAnchor = this.current;
    }
    this.transactionDepth += 1;
  }

  /**
   * Ends the current transaction (see `beginTransaction`). Once the outermost
   * transaction ends, the state as it was immediately before `beginTransaction()` is
   * pushed as a single past entry (exactly as one `push()` would) and the redo stack
   * is cleared — unless nothing actually changed during the transaction, in which case
   * this is a no-op and no empty undo entry is created.
   *
   * Calling `endTransaction()` without a matching `beginTransaction()` is a no-op.
   */
  endTransaction(): void {
    if (this.transactionDepth === 0) return;
    this.transactionDepth -= 1;
    if (this.transactionDepth > 0) return;

    const anchor = this.transactionAnchor;
    this.transactionAnchor = null;
    if (!anchor || anchor === this.current) return;

    this.past.push(anchor);
    while (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.future = [];
  }

  /**
   * Whether a grouped-history transaction is currently active.
   */
  get inTransaction(): boolean {
    return this.transactionDepth > 0;
  }

  /**
   * Undo to the previous state.
   * Returns the restored state, or undefined if undo is not possible.
   */
  undo(): T | undefined {
    if (!this.canUndo()) {
      return undefined;
    }

    const previousEntry = this.past.pop()!;
    this.future.unshift(this.current);
    this.current = previousEntry;

    return this.present;
  }

  /**
   * Redo to the next state in future stack.
   * Returns the restored state, or undefined if redo is not possible.
   */
  redo(): T | undefined {
    if (!this.canRedo()) {
      return undefined;
    }

    const nextEntry = this.future.shift()!;
    this.past.push(this.current);
    this.current = nextEntry;

    return this.present;
  }

  /**
   * Reset the history engine with a new initial state.
   * Clears both undo and redo stacks (e.g. when loading a new document).
   */
  reset(newState: T): void {
    if (newState === undefined || newState === null) {
      throw new Error('New state must be defined when resetting history.');
    }

    this.past = [];
    this.future = [];
    this.current = {
      state: deepClone(newState),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear both past and future stacks without changing the current state.
   */
  clear(): void {
    this.past = [];
    this.future = [];
  }

  /**
   * Get a snapshot of current history status.
   */
  getState(): HistoryState<T> {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoCount,
      redoCount: this.redoCount,
      present: this.present,
    };
  }
}

/**
 * Document History Manager for PageDocument.
 * Connects HistoryEngine with core command execution.
 */
export class DocumentHistoryManager {
  private history: HistoryEngine<PageDocument>;

  constructor(initialDocument: PageDocument, options?: HistoryOptions) {
    this.history = new HistoryEngine<PageDocument>(initialDocument, options);
  }

  get document(): PageDocument {
    return this.history.present;
  }

  get canUndo(): boolean {
    return this.history.canUndo();
  }

  get canRedo(): boolean {
    return this.history.canRedo();
  }

  /**
   * Execute a mutation command immutably and record the resulting state and change event in history.
   */
  execute(executor: (currentDoc: PageDocument) => CommandResult): CommandResult {
    const currentDoc = this.history.present;
    const result = executor(currentDoc);
    this.history.push(result.document, result.event);
    return result;
  }

  undo(): PageDocument | undefined {
    return this.history.undo();
  }

  redo(): PageDocument | undefined {
    return this.history.redo();
  }

  /**
   * Begin a grouped-history transaction (STORA-510) — see `HistoryEngine.beginTransaction`.
   * Every `execute()` call made until the matching `endTransaction()` updates
   * `document` immediately but is collapsed into a single undo entry.
   */
  beginTransaction(): void {
    this.history.beginTransaction();
  }

  /**
   * Ends a grouped-history transaction started with `beginTransaction()` — see
   * `HistoryEngine.endTransaction`.
   */
  endTransaction(): void {
    this.history.endTransaction();
  }

  get inTransaction(): boolean {
    return this.history.inTransaction;
  }

  reset(newDocument: PageDocument): void {
    this.history.reset(newDocument);
  }

  clear(): void {
    this.history.clear();
  }

  getState(): HistoryState<PageDocument> {
    return this.history.getState();
  }
}
