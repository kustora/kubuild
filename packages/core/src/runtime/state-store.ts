import { resolvePropertyPath } from './interpolator';

/**
 * Forbidden object keys to protect against prototype pollution.
 */
const FORBIDDEN_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Standard form state structure managed inside the store.
 */
export interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  dirty: boolean;
  initialValues?: Record<string, unknown>;
}

/**
 * Root state managed by the RuntimeStateStore.
 */
export interface RuntimeStoreState {
  variables: Record<string, unknown>;
  forms: Record<string, FormState>;
  state: Record<string, unknown>;
  [key: string]: unknown;
}

export type Unsubscribe = () => void;
export type StoreListener = (
  state: Readonly<RuntimeStoreState>,
  prevState: Readonly<RuntimeStoreState>,
) => void;
export type KeyChangeListener<T = unknown> = (newValue: T, prevValue: T) => void;
export type PathChangeListener<T = unknown> = (newValue: T, prevValue: T) => void;
export type FormChangeListener = (newForm: FormState, prevForm?: FormState) => void;

/**
 * Creates an initial clean FormState object.
 */
export function createDefaultFormState(initialValues?: Record<string, unknown>): FormState {
  const init = initialValues ? { ...initialValues } : {};
  return {
    values: { ...init },
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
    dirty: false,
    initialValues: { ...init },
  };
}

/**
 * Deep clones an object safely.
 */
function cloneState<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cloneState(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!FORBIDDEN_KEY_SEGMENTS.has(k)) {
      copy[k] = cloneState(v);
    }
  }
  return copy as T;
}

/**
 * Sets a value at a nested dotted path on a target object.
 */
function setNestedPath(target: Record<string, unknown>, path: string, value: unknown): boolean {
  if (!path || typeof path !== 'string' || !target || typeof target !== 'object') {
    return false;
  }

  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalized.split('.').map((s) => s.trim()).filter(Boolean);

  if (segments.length === 0) return false;

  let current: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (FORBIDDEN_KEY_SEGMENTS.has(seg)) return false;

    if (current[seg] === undefined || current[seg] === null || typeof current[seg] !== 'object') {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }

  const lastSeg = segments[segments.length - 1];
  if (FORBIDDEN_KEY_SEGMENTS.has(lastSeg)) return false;

  current[lastSeg] = value;
  return true;
}

/**
 * Deletes a value at a nested dotted path on a target object.
 */
function deleteNestedPath(target: Record<string, unknown>, path: string): boolean {
  if (!path || typeof path !== 'string' || !target || typeof target !== 'object') {
    return false;
  }

  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const segments = normalized.split('.').map((s) => s.trim()).filter(Boolean);

  if (segments.length === 0) return false;

  let current: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (FORBIDDEN_KEY_SEGMENTS.has(seg) || !(seg in current) || typeof current[seg] !== 'object') {
      return false;
    }
    current = current[seg] as Record<string, unknown>;
  }

  const lastSeg = segments[segments.length - 1];
  if (FORBIDDEN_KEY_SEGMENTS.has(lastSeg) || !(lastSeg in current)) {
    return false;
  }

  delete current[lastSeg];
  return true;
}

/**
 * Reactive State Store & Context Manager for form states and runtime variables.
 */
export class RuntimeStateStore {
  private state: RuntimeStoreState;
  private listeners = new Set<StoreListener>();
  private pathListeners = new Map<string, Set<PathChangeListener>>();
  private formListeners = new Map<string, Set<FormChangeListener>>();
  private isBatching = false;
  private batchOldState?: RuntimeStoreState;
  private isNotifying = false;

  constructor(initialState?: Partial<RuntimeStoreState>) {
    this.state = {
      variables: initialState?.variables ? { ...initialState.variables } : {},
      forms: initialState?.forms ? cloneState(initialState.forms) : {},
      state: initialState?.state ? { ...initialState.state } : {},
      ...initialState,
    };
  }

  /**
   * Retrieves a value at a specified path or the entire state snapshot.
   */
  public get<T = unknown>(path?: string, fallback?: T): T {
    if (!path || path.trim() === '') {
      return this.getSnapshot() as unknown as T;
    }
    const cleanPath = path.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
    const resolved = resolvePropertyPath(this.state, cleanPath, fallback);
    return resolved as T;
  }

  /**
   * Gets an immutable snapshot of the current state.
   */
  public getSnapshot(): RuntimeStoreState {
    return cloneState(this.state);
  }

  /**
   * Sets a value at a dotted path and notifies subscribers.
   */
  public set(path: string, value: unknown): this {
    if (!path) return this;

    const oldState = this.isBatching ? undefined : cloneState(this.state);
    const cleanPath = path.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();

    const success = setNestedPath(this.state, cleanPath, value);
    if (!success) return this;

    if (!this.isBatching && oldState) {
      this.notifyChanges(oldState, this.state);
    }

    return this;
  }

  /**
   * Performs multiple updates atomically, triggering subscriber notifications once.
   */
  public setBatch(updates: Record<string, unknown>): this {
    if (!updates || typeof updates !== 'object') return this;

    const oldState = this.batchOldState || cloneState(this.state);
    this.isBatching = true;
    this.batchOldState = oldState;

    try {
      for (const [path, value] of Object.entries(updates)) {
        this.set(path, value);
      }
    } finally {
      this.isBatching = false;
      this.batchOldState = undefined;
      this.notifyChanges(oldState, this.state);
    }

    return this;
  }

  /**
   * Deletes a property at the specified path.
   */
  public delete(path: string): boolean {
    if (!path) return false;

    const oldState = this.isBatching ? undefined : cloneState(this.state);
    const cleanPath = path.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();

    const deleted = deleteNestedPath(this.state, cleanPath);
    if (deleted && !this.isBatching && oldState) {
      this.notifyChanges(oldState, this.state);
    }

    return deleted;
  }

  /**
   * Resets the store state to an initial or clean state.
   */
  public reset(initialState?: Partial<RuntimeStoreState>): this {
    const oldState = cloneState(this.state);
    this.state = {
      variables: initialState?.variables ? { ...initialState.variables } : {},
      forms: initialState?.forms ? cloneState(initialState.forms) : {},
      state: initialState?.state ? { ...initialState.state } : {},
      ...initialState,
    };
    this.notifyChanges(oldState, this.state);
    return this;
  }

  /**
   * Subscribes a listener to any state changes.
   */
  public subscribe(listener: StoreListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribes a listener to changes on a top-level key.
   */
  public subscribeKey<T = unknown>(key: string, listener: KeyChangeListener<T>): Unsubscribe {
    return this.subscribePath(key, listener as PathChangeListener);
  }

  /**
   * Subscribes a listener to changes at a specific dotted path.
   */
  public subscribePath<T = unknown>(path: string, listener: PathChangeListener<T>): Unsubscribe {
    const cleanPath = path.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
    if (!this.pathListeners.has(cleanPath)) {
      this.pathListeners.set(cleanPath, new Set());
    }
    const set = this.pathListeners.get(cleanPath)!;
    set.add(listener as PathChangeListener);

    return () => {
      set.delete(listener as PathChangeListener);
      if (set.size === 0) {
        this.pathListeners.delete(cleanPath);
      }
    };
  }

  /**
   * Subscribes a listener to changes of a specific form state.
   */
  public subscribeForm(formId: string, listener: FormChangeListener): Unsubscribe {
    if (!this.formListeners.has(formId)) {
      this.formListeners.set(formId, new Set());
    }
    const set = this.formListeners.get(formId)!;
    set.add(listener);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.formListeners.delete(formId);
      }
    };
  }

  /**
   * Notifies all relevant listeners when state changes.
   */
  private notifyChanges(oldState: RuntimeStoreState, newState: RuntimeStoreState): void {
    if (this.isNotifying) return;
    this.isNotifying = true;

    try {
      const readOnlyNew = Object.freeze(cloneState(newState));
      const readOnlyOld = Object.freeze(cloneState(oldState));

      // 1. Notify global listeners
      for (const listener of this.listeners) {
        try {
          listener(readOnlyNew, readOnlyOld);
        } catch {
          // Prevent listener errors from breaking other subscriptions
        }
      }

      // 2. Notify path listeners
      for (const [path, listeners] of this.pathListeners.entries()) {
        const oldVal = resolvePropertyPath(oldState, path, undefined);
        const newVal = resolvePropertyPath(newState, path, undefined);

        if (oldVal !== newVal) {
          for (const listener of listeners) {
            try {
              listener(newVal, oldVal);
            } catch {
              // Ignore subscriber errors
            }
          }
        }
      }

      // 3. Notify form listeners
      for (const [formId, listeners] of this.formListeners.entries()) {
        const oldForm = oldState.forms?.[formId];
        const newForm = newState.forms?.[formId];

        if (oldForm !== newForm) {
          for (const listener of listeners) {
            try {
              listener(newForm || createDefaultFormState(), oldForm);
            } catch {
              // Ignore subscriber errors
            }
          }
        }
      }
    } finally {
      this.isNotifying = false;
    }
  }

  // ==========================================
  // Form State Management Helpers
  // ==========================================

  /**
   * Retrieves the FormState for a formId, initializing default form state if not present.
   */
  public getForm(formId: string): FormState {
    if (!this.state.forms[formId]) {
      this.state.forms[formId] = createDefaultFormState();
    }
    return this.state.forms[formId];
  }

  /**
   * Updates a single field value in a form and marks dirty if changed from initial.
   */
  public setFormFieldValue(formId: string, fieldName: string, value: unknown): this {
    const form = this.getForm(formId);
    const oldValues = { ...form.values };
    form.values[fieldName] = value;

    // Check dirty state
    const initialVal = form.initialValues?.[fieldName];
    form.dirty = Object.keys(form.values).some((k) => form.values[k] !== form.initialValues?.[k]);

    this.set(`forms.${formId}.values.${fieldName}`, value);
    return this;
  }

  /**
   * Sets or clears an error for a form field.
   */
  public setFormFieldError(formId: string, fieldName: string, error: string | null): this {
    const form = this.getForm(formId);
    if (error) {
      form.errors[fieldName] = error;
    } else {
      delete form.errors[fieldName];
    }
    form.isValid = Object.keys(form.errors).length === 0;

    this.set(`forms.${formId}.errors`, { ...form.errors });
    this.set(`forms.${formId}.isValid`, form.isValid);
    return this;
  }

  /**
   * Marks a form field as touched (or untouched).
   */
  public setFormFieldTouched(formId: string, fieldName: string, touched: boolean = true): this {
    const form = this.getForm(formId);
    form.touched[fieldName] = touched;

    this.set(`forms.${formId}.touched.${fieldName}`, touched);
    return this;
  }

  /**
   * Updates multiple form errors simultaneously.
   */
  public setFormErrors(formId: string, errors: Record<string, string>): this {
    const form = this.getForm(formId);
    form.errors = { ...errors };
    form.isValid = Object.keys(errors).length === 0;

    this.set(`forms.${formId}.errors`, form.errors);
    this.set(`forms.${formId}.isValid`, form.isValid);
    return this;
  }

  /**
   * Sets multiple form field values simultaneously.
   */
  public setFormValues(
    formId: string,
    values: Record<string, unknown>,
    replace: boolean = false,
  ): this {
    const form = this.getForm(formId);
    form.values = replace ? { ...values } : { ...form.values, ...values };
    form.dirty = Object.keys(form.values).some((k) => form.values[k] !== form.initialValues?.[k]);

    this.set(`forms.${formId}.values`, { ...form.values });
    this.set(`forms.${formId}.dirty`, form.dirty);
    return this;
  }

  /**
   * Sets the submitting status of a form.
   */
  public setFormSubmitting(formId: string, isSubmitting: boolean): this {
    const form = this.getForm(formId);
    form.isSubmitting = isSubmitting;

    this.set(`forms.${formId}.isSubmitting`, isSubmitting);
    return this;
  }

  /**
   * Resets a form's values, errors, touched, and submitting state to defaults or specified values.
   */
  public resetForm(formId: string, initialValues?: Record<string, unknown>): this {
    const newFormState = createDefaultFormState(
      initialValues || this.state.forms[formId]?.initialValues,
    );
    this.set(`forms.${formId}`, newFormState);
    return this;
  }

  // ==========================================
  // Scoping & Isolation
  // ==========================================

  /**
   * Creates an isolated child scope store for a page or component container.
   */
  public createScope(scopeId: string, initialValues?: Record<string, unknown>): RuntimeStateStore {
    const scopedState: Partial<RuntimeStoreState> = {
      variables: { ...(initialValues || {}) },
      forms: {},
      state: {},
    };
    return new RuntimeStateStore(scopedState);
  }
}

/**
 * Factory function to create a new RuntimeStateStore instance.
 */
export function createRuntimeStore(initialState?: Partial<RuntimeStoreState>): RuntimeStateStore {
  return new RuntimeStateStore(initialState);
}

