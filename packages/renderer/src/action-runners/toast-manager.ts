import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'bottom-center';

/**
 * Configuration options for spawning a toast notification.
 */
export interface ToastOptions {
  message: string;
  type?: ToastType;
  variant?: ToastType; // Alias for type
  title?: string;
  duration?: number;
  position?: ToastPosition;
  dismissible?: boolean;
  id?: string;
}

/**
 * Internal active toast item structure.
 */
export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  position: ToastPosition;
  dismissible: boolean;
  createdAt: number;
  dismiss: () => void;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastCounter = 0;

/**
 * ToastManager manages reactive toast state, timers, and event subscriptions.
 */
export class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners = new Set<ToastListener>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Spawns a new toast notification.
   */
  public showToast(options: ToastOptions | string): ToastItem {
    const opts: ToastOptions =
      typeof options === 'string' ? { message: options } : options;

    const id = opts.id || `toast_${Date.now()}_${++toastCounter}`;
    const type: ToastType = opts.type || opts.variant || 'info';
    const duration = opts.duration !== undefined ? Math.max(0, opts.duration) : 4000;
    const position: ToastPosition = opts.position || 'top-right';
    const dismissible = opts.dismissible !== false;

    // Clear any existing timer with the same id
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }

    const toastItem: ToastItem = {
      id,
      type,
      message: opts.message,
      title: opts.title,
      duration,
      position,
      dismissible,
      createdAt: Date.now(),
      dismiss: () => this.dismissToast(id),
    };

    // Remove previous instance if re-spawning with same ID
    this.toasts = this.toasts.filter((t) => t.id !== id).concat(toastItem);

    // Setup auto-dismiss timer if duration > 0
    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismissToast(id);
      }, duration);
      this.timers.set(id, timer);
    }

    this.notify();
    return toastItem;
  }

  /**
   * Dismisses a single toast by ID.
   */
  public dismissToast(id: string): void {
    if (this.timers.has(id)) {
      clearTimeout(this.timers.get(id));
      this.timers.delete(id);
    }

    const prevLength = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);

    if (this.toasts.length !== prevLength) {
      this.notify();
    }
  }

  /**
   * Clears all active toasts.
   */
  public clearToasts(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }

  /**
   * Returns current active toasts.
   */
  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  /**
   * Subscribes a listener to toast state changes.
   */
  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getToasts();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (err) {
        console.error('Error in toast listener callback:', err);
      }
    }
  }
}

/**
 * Singleton ToastManager instance for global toast handling.
 */
export const toastManager = new ToastManager();

/**
 * React hook to observe and trigger toast notifications.
 */
export function useToasts(manager: ToastManager = toastManager): {
  toasts: ToastItem[];
  showToast: (options: ToastOptions | string) => ToastItem;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>(() => manager.getToasts());

  useEffect(() => {
    setToasts(manager.getToasts());
    return manager.subscribe((nextToasts) => {
      setToasts(nextToasts);
    });
  }, [manager]);

  return {
    toasts,
    showToast: (opts) => manager.showToast(opts),
    dismissToast: (id) => manager.dismissToast(id),
    clearToasts: () => manager.clearToasts(),
  };
}

