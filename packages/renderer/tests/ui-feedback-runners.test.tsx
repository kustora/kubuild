import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { ActionPipeline } from '@kubuild/schema';
import { ActionPipelineExecutor } from '@kubuild/core';
import {
  ToastManager,
  toastManager,
  useToasts,
  ToastContainer,
  ModalManager,
  modalManager,
  useModal,
  useModals,
  showToastRunner,
  openModalRunner,
  closeModalRunner,
  registerDefaultActionRunners,
  createDefaultActionRunners,
} from '../src/index';

describe('STORA-322: Built-in Action Runners: UI Feedback (show_toast, open_modal, close_modal)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastManager.clearToasts();
    modalManager.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('ToastManager & useToasts', () => {
    it('spawns a toast notification with default properties', () => {
      const manager = new ToastManager();
      const toast = manager.showToast('Test Message');

      expect(toast.id).toBeDefined();
      expect(toast.message).toBe('Test Message');
      expect(toast.type).toBe('info');
      expect(toast.duration).toBe(4000);
      expect(toast.position).toBe('top-right');
      expect(manager.getToasts()).toHaveLength(1);
    });

    it('spawns toast with custom type, title, duration, and position', () => {
      const manager = new ToastManager();
      const toast = manager.showToast({
        message: 'Account updated successfully',
        title: 'Success!',
        type: 'success',
        duration: 5000,
        position: 'bottom-left',
      });

      expect(toast.type).toBe('success');
      expect(toast.title).toBe('Success!');
      expect(toast.duration).toBe(5000);
      expect(toast.position).toBe('bottom-left');
    });

    it('supports variant as alias for type', () => {
      const manager = new ToastManager();
      const toast = manager.showToast({
        message: 'Failed to save',
        variant: 'error',
      });

      expect(toast.type).toBe('error');
    });

    it('auto-dismisses toast after specified duration', () => {
      const manager = new ToastManager();
      manager.showToast({ message: 'Temporary alert', duration: 2000 });

      expect(manager.getToasts()).toHaveLength(1);

      vi.advanceTimersByTime(1999);
      expect(manager.getToasts()).toHaveLength(1);

      vi.advanceTimersByTime(2);
      expect(manager.getToasts()).toHaveLength(0);
    });

    it('does not auto-dismiss when duration is 0', () => {
      const manager = new ToastManager();
      manager.showToast({ message: 'Persistent alert', duration: 0 });

      vi.advanceTimersByTime(10000);
      expect(manager.getToasts()).toHaveLength(1);
    });

    it('dismisses toast manually by id and via toast.dismiss()', () => {
      const manager = new ToastManager();
      const toast1 = manager.showToast('Toast 1');
      const toast2 = manager.showToast('Toast 2');

      expect(manager.getToasts()).toHaveLength(2);

      toast1.dismiss();
      expect(manager.getToasts()).toHaveLength(1);
      expect(manager.getToasts()[0].id).toBe(toast2.id);

      manager.dismissToast(toast2.id);
      expect(manager.getToasts()).toHaveLength(0);
    });

    it('clears all active toasts and cancels pending timers', () => {
      const manager = new ToastManager();
      manager.showToast({ message: 'Toast 1', duration: 3000 });
      manager.showToast({ message: 'Toast 2', duration: 5000 });

      expect(manager.getToasts()).toHaveLength(2);

      manager.clearToasts();
      expect(manager.getToasts()).toHaveLength(0);

      vi.advanceTimersByTime(6000);
      expect(manager.getToasts()).toHaveLength(0);
    });

    it('notifies subscribers on toast updates', () => {
      const manager = new ToastManager();
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      const toast = manager.showToast('Alert 1');
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([expect.objectContaining({ id: toast.id })]);

      manager.dismissToast(toast.id);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith([]);

      unsubscribe();
      manager.showToast('Alert 2');
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('ToastContainer Component', () => {
    it('renders null when there are no active toasts', () => {
      const manager = new ToastManager();
      const html = renderToString(<ToastContainer manager={manager} />);
      expect(html).toBe('');
    });

    it('renders active toasts with correct styles, message, and title', () => {
      const manager = new ToastManager();
      manager.showToast({
        message: 'Order created',
        title: 'Notice',
        type: 'success',
      });

      const html = renderToString(<ToastContainer manager={manager} />);
      expect(html).toContain('Order created');
      expect(html).toContain('Notice');
      expect(html).toContain('data-toast-type="success"');
      expect(html).toContain('role="alert"');
    });

    it('groups toasts by position', () => {
      const manager = new ToastManager();
      manager.showToast({ message: 'Top Right Toast', position: 'top-right' });
      manager.showToast({ message: 'Bottom Left Toast', position: 'bottom-left' });

      const html = renderToString(<ToastContainer manager={manager} />);
      expect(html).toContain('data-testid="toast-container-top-right"');
      expect(html).toContain('data-testid="toast-container-bottom-left"');
      expect(html).toContain('Top Right Toast');
      expect(html).toContain('Bottom Left Toast');
    });
  });

  describe('ModalManager & useModal / useModals', () => {
    it('opens, closes, and checks modal state', () => {
      const manager = new ModalManager();

      expect(manager.isModalOpen('auth_modal')).toBe(false);

      manager.openModal('auth_modal');
      expect(manager.isModalOpen('auth_modal')).toBe(true);
      expect(manager.getActiveModals()).toEqual(['auth_modal']);

      manager.closeModal('auth_modal');
      expect(manager.isModalOpen('auth_modal')).toBe(false);
      expect(manager.getActiveModals()).toEqual([]);
    });

    it('toggles modal state accurately', () => {
      const manager = new ModalManager();

      const opened = manager.toggleModal('settings_modal');
      expect(opened).toBe(true);
      expect(manager.isModalOpen('settings_modal')).toBe(true);

      const closed = manager.toggleModal('settings_modal');
      expect(closed).toBe(false);
      expect(manager.isModalOpen('settings_modal')).toBe(false);
    });

    it('closes topmost modal when closeModal is called without arguments', () => {
      const manager = new ModalManager();
      manager.openModal('modal_1');
      manager.openModal('modal_2');

      expect(manager.getActiveModals()).toEqual(['modal_1', 'modal_2']);

      manager.closeModal();
      expect(manager.isModalOpen('modal_2')).toBe(false);
      expect(manager.isModalOpen('modal_1')).toBe(true);
      expect(manager.getActiveModals()).toEqual(['modal_1']);

      manager.closeModal();
      expect(manager.isModalOpen('modal_1')).toBe(false);
      expect(manager.getActiveModals()).toEqual([]);
    });

    it('notifies subscribers on modal state changes', () => {
      const manager = new ModalManager();
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.openModal('subscribe_modal');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ subscribe_modal: true }));

      manager.closeModal('subscribe_modal');
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ subscribe_modal: false }));

      unsubscribe();
      manager.openModal('other_modal');
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('UI Feedback Action Runners (show_toast, open_modal, close_modal)', () => {
    it('executes show_toast runner and returns toast details', () => {
      const result = showToastRunner(
        {
          id: 'step_toast',
          type: 'show_toast',
          payload: {
            message: 'Hello World',
            type: 'warning',
            title: 'Caution',
            duration: 6000,
            position: 'top-center',
          },
        },
        {},
      );

      expect(result).toMatchObject({
        message: 'Hello World',
        type: 'warning',
        title: 'Caution',
        duration: 6000,
        position: 'top-center',
      });
      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].message).toBe('Hello World');
    });

    it('throws error when show_toast message is empty', () => {
      expect(() =>
        showToastRunner(
          {
            id: 'step_toast_empty',
            type: 'show_toast',
            payload: { message: '' },
          },
          {},
        ),
      ).toThrow('Toast message cannot be empty');
    });

    it('executes open_modal runner and updates context state & variables', () => {
      const context: Record<string, any> = {
        state: {},
        variables: {},
      };

      const result = openModalRunner(
        {
          id: 'step_open_modal',
          type: 'open_modal',
          payload: {
            modalId: 'contact_dialog',
          },
        },
        context,
      );

      expect(result).toEqual({ modalId: 'contact_dialog', open: true });
      expect(modalManager.isModalOpen('contact_dialog')).toBe(true);
      expect(context.state.contact_dialog).toBe(true);
      expect(context.state.modals?.contact_dialog).toBe(true);
      expect(context.variables.modal_contact_dialog_open).toBe(true);
    });

    it('supports modalNodeId alias in open_modal runner', () => {
      const result = openModalRunner(
        {
          id: 'step_open_modal_node',
          type: 'open_modal',
          payload: {
            modalNodeId: 'node_modal_789',
          },
        },
        {},
      );

      expect(result).toEqual({ modalId: 'node_modal_789', open: true });
      expect(modalManager.isModalOpen('node_modal_789')).toBe(true);
    });

    it('throws error when open_modal has no modalId or modalNodeId', () => {
      expect(() =>
        openModalRunner(
          {
            id: 'step_open_empty',
            type: 'open_modal',
            payload: {},
          },
          {},
        ),
      ).toThrow('Modal ID or Modal Node ID is required');
    });

    it('executes close_modal runner and updates context state & variables', () => {
      modalManager.openModal('checkout_modal');
      const context: Record<string, any> = {
        state: { checkout_modal: true, modals: { checkout_modal: true } },
        variables: { modal_checkout_modal_open: true },
      };

      const result = closeModalRunner(
        {
          id: 'step_close_modal',
          type: 'close_modal',
          payload: {
            modalId: 'checkout_modal',
          },
        },
        context,
      );

      expect(result).toEqual({ modalId: 'checkout_modal', open: false });
      expect(modalManager.isModalOpen('checkout_modal')).toBe(false);
      expect(context.state.checkout_modal).toBe(false);
      expect(context.state.modals?.checkout_modal).toBe(false);
      expect(context.variables.modal_checkout_modal_open).toBe(false);
    });
  });

  describe('ActionPipelineExecutor Integration with UI Feedback Runners', () => {
    it('runs pipeline executing api_request -> show_toast -> open_modal seamlessly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ userId: 'usr_101', name: 'John Matrix' }),
      });

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockFetch as unknown as typeof fetch },
      });

      const pipeline: ActionPipeline = {
        id: 'complete_feedback_pipeline',
        trigger: 'click',
        steps: [
          {
            id: 'step_1_api',
            type: 'api_request',
            payload: {
              url: 'https://api.example.com/user/101',
              responseMapping: {
                userName: 'response.data.name',
              },
            },
          },
          {
            id: 'step_2_toast',
            type: 'show_toast',
            payload: {
              message: 'User {{variables.userName}} loaded successfully!',
              type: 'success',
              duration: 3000,
            },
          },
          {
            id: 'step_3_open_modal',
            type: 'open_modal',
            payload: {
              modalId: 'user_profile_modal',
            },
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(true);
      expect(result.stepResults).toHaveLength(3);
      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].message).toBe('User John Matrix loaded successfully!');
      expect(toastManager.getToasts()[0].type).toBe('success');
      expect(modalManager.isModalOpen('user_profile_modal')).toBe(true);
    });

    it('triggers error toast and closes modal in onError branch when API fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => JSON.stringify({ message: 'Access denied' }),
      });

      modalManager.openModal('edit_item_modal');

      const executor = new ActionPipelineExecutor();
      registerDefaultActionRunners(executor, {
        apiRequest: { fetchFn: mockFetch as unknown as typeof fetch },
      });

      const pipeline: ActionPipeline = {
        id: 'failing_feedback_pipeline',
        trigger: 'submit',
        steps: [
          {
            id: 'step_submit',
            type: 'api_request',
            payload: { url: 'https://api.example.com/sensitive-data' },
            onError: [
              {
                id: 'step_err_toast',
                type: 'show_toast',
                payload: {
                  message: 'Operation failed: {{error.message}}',
                  type: 'error',
                },
              },
              {
                id: 'step_close_edit_modal',
                type: 'close_modal',
                payload: {
                  modalId: 'edit_item_modal',
                },
              },
            ],
          },
        ],
      };

      const result = await executor.execute(pipeline);

      expect(result.success).toBe(false);
      expect(toastManager.getToasts()).toHaveLength(1);
      expect(toastManager.getToasts()[0].type).toBe('error');
      expect(toastManager.getToasts()[0].message).toContain('Access denied');
      expect(modalManager.isModalOpen('edit_item_modal')).toBe(false);
    });
  });
});

