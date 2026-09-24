import type { ActionRegistry, PipelineExecutionContext, PipelineStepHandler, RenderContext } from '@kubuild/core';
import type { ActionStep, PageDocument } from '@kubuild/schema';
import { navigateRunner } from './action-runners/navigation-utils';
import {
  closeModalRunner,
  openModalRunner,
  showToastRunner,
  toggleModalRunner,
} from './action-runners/ui-feedback';

/**
 * Built-in handlers for legacy single-action bindings (`props.action = { type, payload }`)
 * whose type has an equivalent pipeline step runner (STORA-533). They run only when the
 * host did not register its own handler for the type in `context.actionRegistry`, so a
 * host can still override any of them.
 *
 * The canonical format is `node.actions` (pipelines); these exist so older documents and
 * templates keep working without host wiring.
 */
const BUILTIN_LEGACY_ACTION_RUNNERS: Readonly<Record<string, PipelineStepHandler>> = Object.freeze({
  navigate: navigateRunner,
  open_modal: openModalRunner,
  close_modal: closeModalRunner,
  toggle_modal: toggleModalRunner,
  show_toast: showToastRunner,
});

export const BUILTIN_LEGACY_ACTION_TYPES: readonly string[] = Object.freeze(
  Object.keys(BUILTIN_LEGACY_ACTION_RUNNERS),
);

export function hasBuiltinLegacyAction(actionType?: string): boolean {
  return Boolean(actionType && Object.prototype.hasOwnProperty.call(BUILTIN_LEGACY_ACTION_RUNNERS, actionType));
}

/**
 * True when a legacy action type will do something: the host registered a handler for it
 * or a built-in handler exists.
 */
export function isLegacyActionResolvable(actionRegistry: ActionRegistry | undefined, actionType?: string): boolean {
  if (!actionType) return false;
  return Boolean(actionRegistry?.get(actionType)) || hasBuiltinLegacyAction(actionType);
}

/**
 * Runs the built-in handler for a legacy action type with an already-resolved payload.
 * Rejects when the type has no built-in handler or the runner fails.
 */
export async function runBuiltinLegacyAction(
  actionType: string,
  payload: Record<string, unknown> | undefined,
  options: { nodeId?: string; document?: PageDocument; context?: RenderContext },
): Promise<unknown> {
  const runner = hasBuiltinLegacyAction(actionType) ? BUILTIN_LEGACY_ACTION_RUNNERS[actionType] : undefined;
  if (!runner) {
    throw new Error(`No built-in handler for legacy action type "${actionType}".`);
  }
  const ctx = options.context as unknown as Record<string, unknown> | undefined;
  const step: ActionStep = {
    id: `legacy_${actionType}_${options.nodeId || 'node'}`,
    type: actionType as ActionStep['type'],
    payload: payload || {},
  };
  const executionContext: PipelineExecutionContext = {
    nodeId: options.nodeId,
    document: options.document,
    variables: options.context?.variables ? { ...options.context.variables } : {},
    state: {},
    toastManager: ctx?.['toastManager'],
    modalManager: ctx?.['modalManager'],
  };
  return runner(step, executionContext, new AbortController().signal);
}
