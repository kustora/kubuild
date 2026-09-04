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
   */
  push(nextState: T, event?: DocumentChangeEvent): void {
    if (nextState === undefined || nextState === null) {
      throw new Error('Cannot push undefined or null state into history.');
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
