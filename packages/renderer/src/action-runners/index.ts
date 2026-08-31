import type { ActionPipelineExecutor, PipelineStepHandler } from '@kubuild/core';
import {
  apiRequestRunner,
  createApiRequestHandler,
  type ApiRequestRunnerOptions,
} from './api-request';
import { showToastRunner, openModalRunner, closeModalRunner } from './ui-feedback';
import { navigateRunner, copyClipboardRunner, resetFormRunner } from './navigation-utils';

export * from './api-request';
export * from './toast-manager';
export * from './toast-container';
export * from './modal-manager';
export * from './ui-feedback';
export * from './navigation-utils';

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
    navigate: navigateRunner,
    copy_clipboard: copyClipboardRunner,
    reset_form: resetFormRunner,
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
