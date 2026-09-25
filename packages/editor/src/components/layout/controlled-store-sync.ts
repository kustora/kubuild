import type { StoreApi } from 'zustand';

export interface ControlledStoreSync<T> {
  /** Pushes a controlled prop value into the store without echoing it back to `onChange`. */
  apply: (value: T) => void;
  /** Stops listening to the store. */
  dispose: () => void;
}

/**
 * Two-way bridge between a controlled prop and one slice of the editor store.
 *
 * - `apply(value)` writes the prop value into the store (no-op if already equal).
 * - Every other change of the slice — canvas clicks, Layers, keyboard shortcuts, document
 *   reloads — is reported through `onChange`.
 *
 * Writes made by `apply` are never reported, so a host that feeds `onChange` straight back
 * into the prop cannot create a feedback loop.
 */
export function createControlledStoreSync<S, T>(
  store: Pick<StoreApi<S>, 'getState' | 'subscribe'>,
  options: {
    select: (state: S) => T;
    write: (state: S, value: T) => void;
    onChange: () => ((value: T) => void) | undefined;
  },
): ControlledStoreSync<T> {
  let applying = false;

  const unsubscribe = store.subscribe((state, prevState) => {
    if (applying) return;
    const next = options.select(state);
    if (Object.is(next, options.select(prevState))) return;
    options.onChange()?.(next);
  });

  return {
    apply: (value) => {
      const state = store.getState();
      if (Object.is(options.select(state), value)) return;
      applying = true;
      try {
        options.write(state, value);
      } finally {
        applying = false;
      }
    },
    dispose: unsubscribe,
  };
}
