import type { ActionStep, ShowToastStepPayload, OpenModalStepPayload, CloseModalStepPayload } from '@kubuild/schema';
import { type PipelineExecutionContext, type PipelineStepHandler } from '@kubuild/core';
import { toastManager, type ToastManager, type ToastType, type ToastPosition } from './toast-manager';
import { modalManager, type ModalManager } from './modal-manager';

/**
 * Result returned by show_toast runner.
 */
export interface ShowToastResult {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration: number;
  position: ToastPosition;
}

/**
 * Result returned by open_modal or close_modal runner.
 */
export interface ModalActionResult {
  modalId: string;
  open: boolean;
}

/**
 * Action Runner for `show_toast`.
 */
export const showToastRunner: PipelineStepHandler = (
  step: ActionStep,
  context: PipelineExecutionContext,
): ShowToastResult => {
  const payload = (step.payload || {}) as ShowToastStepPayload & {
    variant?: ToastType;
    position?: ToastPosition;
  };

  const message = String(payload.message || '').trim();
  if (!message) {
    throw new Error('Toast message cannot be empty');
  }

  const type: ToastType = payload.type || payload.variant || 'info';
  const duration = payload.duration !== undefined ? payload.duration : 4000;
  const position: ToastPosition = payload.position || 'top-right';
  const title = payload.title ? String(payload.title) : undefined;

  const targetManager: ToastManager = (context.toastManager as ToastManager) || toastManager;

  const toast = targetManager.showToast({
    message,
    type,
    duration,
    position,
    title,
  });

  return {
    id: toast.id,
    message: toast.message,
    type: toast.type,
    title: toast.title,
    duration: toast.duration,
    position: toast.position,
  };
};

/**
 * Action Runner for `open_modal`.
 */
export const openModalRunner: PipelineStepHandler = (
  step: ActionStep,
  context: PipelineExecutionContext,
): ModalActionResult => {
  const payload = (step.payload || {}) as OpenModalStepPayload & {
    modalNodeId?: string;
    targetNodeId?: string;
    nodeId?: string;
  };

  const rawModalId = payload.modalId || payload.modalNodeId || payload.targetNodeId || payload.nodeId;
  const modalId = rawModalId ? String(rawModalId).trim() : '';

  if (!modalId) {
    throw new Error('Modal ID or Modal Node ID is required for open_modal action');
  }

  const targetManager: ModalManager = (context.modalManager as ModalManager) || modalManager;
  targetManager.openModal(modalId);

  // Sync to runtime execution context state & variables
  if (context.state && typeof context.state === 'object') {
    const existingModals = (context.state.modals as Record<string, boolean>) || {};
    context.state.modals = { ...existingModals, [modalId]: true };
    context.state[modalId] = true;
  }
  if (context.variables && typeof context.variables === 'object') {
    context.variables[`modal_${modalId}_open`] = true;
  }

  return {
    modalId,
    open: true,
  };
};

/**
 * Action Runner for `close_modal`.
 */
export const closeModalRunner: PipelineStepHandler = (
  step: ActionStep,
  context: PipelineExecutionContext,
): ModalActionResult => {
  const payload = (step.payload || {}) as CloseModalStepPayload & {
    modalNodeId?: string;
    targetNodeId?: string;
    nodeId?: string;
  };

  const rawModalId = payload.modalId || payload.modalNodeId || payload.targetNodeId || payload.nodeId;
  const modalId = rawModalId ? String(rawModalId).trim() : undefined;

  const targetManager: ModalManager = (context.modalManager as ModalManager) || modalManager;
  targetManager.closeModal(modalId);

  // Sync to runtime execution context state & variables
  if (modalId) {
    if (context.state && typeof context.state === 'object') {
      const existingModals = (context.state.modals as Record<string, boolean>) || {};
      context.state.modals = { ...existingModals, [modalId]: false };
      context.state[modalId] = false;
    }
    if (context.variables && typeof context.variables === 'object') {
      context.variables[`modal_${modalId}_open`] = false;
    }
  } else {
    // If closed all / topmost
    if (context.state && typeof context.state === 'object') {
      context.state.modals = {};
    }
  }

  return {
    modalId: modalId || 'all',
    open: false,
  };
};

