import React, { useEffect } from 'react';
import type { PageDocument, Node, ActionTriggerType, ActionPipeline } from '@kubuild/schema';
import { ActionPipelineExecutor, type Diagnostic } from '@kubuild/core';
import type { RenderContext } from './render-context';
import type { FormRuntimeContextValue } from './form-context';
import { registerDefaultActionRunners } from './action-runners';

/**
 * Options for executing node action pipelines.
 */
export interface ExecuteNodeActionsOptions {
  node: Node;
  trigger: ActionTriggerType | string;
  document?: PageDocument;
  context?: RenderContext;
  formContext?: FormRuntimeContextValue | null;
  extraContext?: Record<string, unknown>;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (
    actionType: string,
    payload: Record<string, unknown> | undefined,
    nodeId: string,
  ) => void;
  executor?: ActionPipelineExecutor;
}

/**
 * Execution outcome from executeNodeActions.
 */
export interface NodeActionExecutionOutcome {
  executed: boolean;
  success: boolean;
  error?: unknown;
}

/**
 * Executes all action pipelines defined on a node that match a specific trigger.
 */
export async function executeNodeActions(
  options: ExecuteNodeActionsOptions,
): Promise<NodeActionExecutionOutcome> {
  const {
    node,
    trigger,
    document,
    context,
    formContext,
    extraContext,
    onDiagnostic,
    onActionDispatch,
    executor: customExecutor,
  } = options;

  if (!node.actions || !Array.isArray(node.actions) || node.actions.length === 0) {
    return { executed: false, success: true };
  }

  const matchingPipelines = node.actions.filter(
    (p: ActionPipeline) => p.trigger === trigger && p.enabled !== false,
  );

  if (matchingPipelines.length === 0) {
    return { executed: false, success: true };
  }

  const executor = customExecutor || new ActionPipelineExecutor();
  registerDefaultActionRunners(executor);

  // Build merged execution context
  const executionContext: Record<string, unknown> = {
    form: formContext ? { ...formContext.values } : {},
    variables: context?.variables ? { ...context.variables } : {},
    nodeId: node.id,
    document,
    toastManager: (context as unknown as Record<string, unknown> | undefined)?.['toastManager'],
    modalManager: (context as unknown as Record<string, unknown> | undefined)?.['modalManager'],
    ...(extraContext || {}),
  };

  for (const pipeline of matchingPipelines) {
    const result = await executor.execute(pipeline, {
      context: executionContext,
    });

    if (onActionDispatch && pipeline.steps.length > 0) {
      onActionDispatch(pipeline.steps[0].type, pipeline.steps[0].payload, node.id);
    }

    if (!result.success) {
      const errorMsg =
        result.error instanceof Error
          ? result.error.message
          : String(result.error || `Action pipeline "${pipeline.id}" failed`);

      const diagnostic: Diagnostic = {
        code: 'ACTION_EXECUTION_ERROR',
        actionType: pipeline.steps[0]?.type || trigger,
        nodeId: node.id,
        message: errorMsg,
        error: result.error,
      };

      onDiagnostic?.(diagnostic);
      context?.onDiagnostic?.(diagnostic);

      return {
        executed: true,
        success: false,
        error: result.error,
      };
    }
  }

  return {
    executed: true,
    success: true,
  };
}

/**
 * Hook to execute `load` lifecycle action pipelines on component mount.
 */
export function useNodeLoadActions(
  node: Node,
  options: {
    document?: PageDocument;
    context?: RenderContext;
    formContext?: FormRuntimeContextValue | null;
    onDiagnostic?: (diagnostic: Diagnostic) => void;
    onActionDispatch?: (
      actionType: string,
      payload: Record<string, unknown> | undefined,
      nodeId: string,
    ) => void;
    mode?: 'editor' | 'runtime';
  },
): void {
  const hasLoadActions = node.actions?.some(
    (p) => p.trigger === 'load' && p.enabled !== false,
  );

  if (!hasLoadActions) {
    return;
  }

  // Check if currently inside a React component render execution
  const reactInternals =
    (React as any)?.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any)?.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const currentDispatcher =
    reactInternals?.H || reactInternals?.ReactCurrentDispatcher?.current;
  if (!currentDispatcher) {
    return;
  }

  try {
    useEffect(() => {
      if (options.mode === 'editor') return;
      executeNodeActions({
        node,
        trigger: 'load',
        document: options.document,
        context: options.context,
        formContext: options.formContext,
        onDiagnostic: options.onDiagnostic,
        onActionDispatch: options.onActionDispatch,
      });
    }, [
      node,
      options.document,
      options.context,
      options.formContext,
      options.onDiagnostic,
      options.onActionDispatch,
      options.mode,
    ]);
  } catch {
    // Gracefully handle when called outside React render cycle
  }
}
