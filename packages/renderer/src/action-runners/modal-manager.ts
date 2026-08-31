import { useState, useEffect, useCallback } from 'react';

export type ModalState = Record<string, boolean>;
export type ModalListener = (modals: ModalState) => void;

/**
 * ModalManager manages visibility state of modals, stack ordering, and custom events.
 */
export class ModalManager {
  private modals = new Map<string, boolean>();
  private activeStack: string[] = [];
  private listeners = new Set<ModalListener>();

  /**
   * Opens a modal dialog by ID.
   */
  public openModal(modalId: string): void {
    if (!modalId || typeof modalId !== 'string') return;
    const cleanId = modalId.trim();
    if (!cleanId) return;

    this.modals.set(cleanId, true);
    this.activeStack = this.activeStack.filter((id) => id !== cleanId).concat(cleanId);

    // Dispatch DOM event for custom modal listeners in the browser
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        const event = new CustomEvent('kubuild:modal:open', {
          detail: { modalId: cleanId },
          bubbles: true,
        });
        window.dispatchEvent(event);
      } catch {
        // Ignore in non-standard environments
      }
    }

    this.notify();
  }

  /**
   * Closes a modal dialog by ID or closes the topmost modal if no ID is specified.
   */
  public closeModal(modalId?: string): void {
    if (modalId && typeof modalId === 'string') {
      const cleanId = modalId.trim();
      this.modals.set(cleanId, false);
      this.activeStack = this.activeStack.filter((id) => id !== cleanId);

      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        try {
          const event = new CustomEvent('kubuild:modal:close', {
            detail: { modalId: cleanId },
            bubbles: true,
          });
          window.dispatchEvent(event);
        } catch {
          // Ignore
        }
      }
    } else {
      // Close topmost active modal
      const topModal = this.activeStack.pop();
      if (topModal) {
        this.modals.set(topModal, false);
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          try {
            const event = new CustomEvent('kubuild:modal:close', {
              detail: { modalId: topModal },
              bubbles: true,
            });
            window.dispatchEvent(event);
          } catch {
            // Ignore
          }
        }
      } else {
        // Close all if stack was empty
        for (const key of this.modals.keys()) {
          this.modals.set(key, false);
        }
      }
    }

    this.notify();
  }

  /**
   * Toggles visibility state of a modal.
   */
  public toggleModal(modalId: string): boolean {
    const isCurrentlyOpen = this.isModalOpen(modalId);
    if (isCurrentlyOpen) {
      this.closeModal(modalId);
      return false;
    } else {
      this.openModal(modalId);
      return true;
    }
  }

  /**
   * Checks whether a modal is currently open.
   */
  public isModalOpen(modalId: string): boolean {
    if (!modalId) return false;
    return Boolean(this.modals.get(modalId.trim()));
  }

  /**
   * Returns a snapshot map of all modal states.
   */
  public getState(): ModalState {
    const state: ModalState = {};
    for (const [key, value] of this.modals.entries()) {
      state[key] = value;
    }
    return state;
  }

  /**
   * Returns list of currently open modal IDs in stack order.
   */
  public getActiveModals(): string[] {
    return [...this.activeStack];
  }

  /**
   * Resets all modal states to closed.
   */
  public reset(): void {
    this.modals.clear();
    this.activeStack = [];
    this.notify();
  }

  /**
   * Subscribes a listener to modal state changes.
   */
  public subscribe(listener: ModalListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in modal listener callback:', err);
      }
    }
  }
}

/**
 * Singleton ModalManager instance.
 */
export const modalManager = new ModalManager();

/**
 * React hook to observe and manipulate a single modal dialog state.
 */
export function useModal(
  modalId: string,
  manager: ModalManager = modalManager,
): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => boolean;
} {
  const [isOpen, setIsOpen] = useState<boolean>(() => manager.isModalOpen(modalId));

  useEffect(() => {
    setIsOpen(manager.isModalOpen(modalId));
    return manager.subscribe((state) => {
      setIsOpen(Boolean(state[modalId]));
    });
  }, [modalId, manager]);

  const open = useCallback(() => manager.openModal(modalId), [modalId, manager]);
  const close = useCallback(() => manager.closeModal(modalId), [modalId, manager]);
  const toggle = useCallback(() => manager.toggleModal(modalId), [modalId, manager]);

  return { isOpen, open, close, toggle };
}

/**
 * React hook to observe and manage all modal dialogs.
 */
export function useModals(manager: ModalManager = modalManager): {
  modals: ModalState;
  activeModals: string[];
  isOpen: (modalId: string) => boolean;
  openModal: (modalId: string) => void;
  closeModal: (modalId?: string) => void;
  toggleModal: (modalId: string) => boolean;
} {
  const [state, setState] = useState<ModalState>(() => manager.getState());

  useEffect(() => {
    setState(manager.getState());
    return manager.subscribe((nextState) => {
      setState(nextState);
    });
  }, [manager]);

  return {
    modals: state,
    activeModals: manager.getActiveModals(),
    isOpen: (id: string) => Boolean(state[id]),
    openModal: (id: string) => manager.openModal(id),
    closeModal: (id?: string) => manager.closeModal(id),
    toggleModal: (id: string) => manager.toggleModal(id),
  };
}

