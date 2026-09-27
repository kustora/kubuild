import type { ActionPipelineExecutor, PipelineStepHandler } from '@kubuild/core';
import {
  apiRequestRunner,
  createApiRequestHandler,
  type ApiRequestRunnerOptions,
} from './api-request.js';
import { showToastRunner, openModalRunner, closeModalRunner, toggleModalRunner } from './ui-feedback.js';
import {
  navigateRunner,
  copyClipboardRunner,
  resetFormRunner,
  customEventRunner,
} from './navigation-utils.js';
import { trackEventRunner } from './tracking.js';

export * from './api-request.js';
export * from './toast-manager.js';
export * from './toast-container.js';
export * from './modal-manager.js';
export * from './ui-feedback.js';
export * from './navigation-utils.js';
export * from './tracking.js';

/**
 * Options for configuring built-in action runners.
 */
export interface ActionRunnerFactoryOptions {
  apiRequest?: ApiRequestRunnerOptions;
  handlers?: Record<string, PipelineStepHandler>;
}

/**
 * Creates a map of all default built-in action runners for `@kubuild/renderer`.
 */
export function createDefaultActionRunners(
  options?: ActionRunnerFactoryOptions,
): Record<string, PipelineStepHandler> {
  const apiHandler = options?.apiRequest
    ? createApiRequestHandler(options.apiRequest)
    : apiRequestRunner;

  return {
    api_request: apiHandler,
    show_toast: showToastRunner,
    open_modal: openModalRunner,
    close_modal: closeModalRunner,
    toggle_modal: toggleModalRunner,
    navigate: navigateRunner,
    copy_clipboard: copyClipboardRunner,
    reset_form: resetFormRunner,
    custom_event: customEventRunner,
    track_event: trackEventRunner,
    ...(options?.handlers || {}),
  };
}

/**
 * Registers default built-in action runners onto an ActionPipelineExecutor instance.
 */
export function registerDefaultActionRunners(
  executor: ActionPipelineExecutor,
  options?: ActionRunnerFactoryOptions,
): ActionPipelineExecutor {
  const runners = createDefaultActionRunners(options);
  for (const [type, handler] of Object.entries(runners)) {
    if (!executor.hasHandler(type) || options?.handlers?.[type] || options?.apiRequest) {
      executor.registerHandler(type, handler);
    }
  }
  return executor;
}
