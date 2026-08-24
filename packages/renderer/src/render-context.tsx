import React, { createContext, useContext, useMemo } from 'react';
import { resolveBinding } from '@kubuild/core';
import type {
  AssetProvider,
  ActionRegistry,
  ActionHandler,
  ActionExecutionContext,
  ActionDiagnostic,
  Diagnostic,
  RenderContext,
  RuntimeContext,
} from '@kubuild/core';
import { isVariableBinding, isActionBinding, ActionBinding, PageDocument } from '@kubuild/schema';

export type { RenderContext, RuntimeContext, ActionDiagnostic, Diagnostic };

/**
 * Empty default frozen context
 */
export const DEFAULT_RENDER_CONTEXT: RenderContext = Object.freeze({});

/**
 * React Context for RenderContext flow
 */
const RenderContextReact = createContext<RenderContext>(DEFAULT_RENDER_CONTEXT);

/**
 * Creates an immutable (frozen) RenderContext.
 * Guarantees that components cannot mutate the runtime context during rendering.
 */
export function createRenderContext(options?: {
  variables?: Record<string, unknown>;
  assetProvider?: AssetProvider;
  actionRegistry?: ActionRegistry;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}): RenderContext {
  if (!options) {
    return DEFAULT_RENDER_CONTEXT;
  }

  const frozenVariables = options.variables ? Object.freeze({ ...options.variables }) : undefined;

  return Object.freeze({
    variables: frozenVariables,
    ...(options.assetProvider ? { assetProvider: options.assetProvider } : {}),
    ...(options.actionRegistry ? { actionRegistry: options.actionRegistry } : {}),
    ...(options.onDiagnostic ? { onDiagnostic: options.onDiagnostic } : {}),
  });
}

/**
 * Minimal offline in-memory context factory.
 * Can be safely injected into unit tests, local mock playgrounds, or SSR without any network calls.
 */
export function createMinimalRenderContext(options?: {
  variables?: Record<string, unknown>;
  assets?: Record<string, string>;
  actions?: Record<string, ActionHandler>;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
}): RenderContext {
  const assetsMap = new Map<string, string>(Object.entries(options?.assets ?? {}));
  const actionsMap = new Map<string, ActionHandler>(Object.entries(options?.actions ?? {}));

  const assetProvider: AssetProvider = {
    resolve: (assetIdOrUri: string) => {
      return assetsMap.get(assetIdOrUri) || assetIdOrUri;
    },
  };

  const actionRegistry: ActionRegistry = {
    get: (type: string) => actionsMap.get(type),
    register: (type: string, handler: ActionHandler) => {
      actionsMap.set(type, handler);
    },
    unregister: (type: string) => {
      actionsMap.delete(type);
    },
  };

  return createRenderContext({
    variables: options?.variables,
    assetProvider,
    actionRegistry,
    onDiagnostic: options?.onDiagnostic,
  });
}

/**
 * Provider component to make RenderContext available anywhere in the component tree
 */
export interface RenderContextProviderProps {
  value?: RenderContext;
  children: React.ReactNode;
}

export const RenderContextProvider: React.FC<RenderContextProviderProps> = ({ value, children }) => {
  const contextValue = useMemo(() => value || DEFAULT_RENDER_CONTEXT, [value]);

  return <RenderContextReact.Provider value={contextValue}>{children}</RenderContextReact.Provider>;
};

/**
 * Hook to access the current RenderContext
 */
export function useRenderContext(): RenderContext {
  return useContext(RenderContextReact);
}

/**
 * Asset resolution helper.
 * Computes asset URLs synchronously for React render cycles.
 */
export function resolveAssetSync(assetProvider?: AssetProvider, assetIdOrUri?: string): string | undefined {
  if (!assetProvider || !assetIdOrUri) {
    return undefined;
  }
  try {
    const result = assetProvider.resolve(assetIdOrUri);
    return typeof result === 'string' ? result : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Variable resolution helper.
 * Resolves VariableBinding objects and template strings like "{{ title }}" using context variables.
 */
export function resolveVariable(context?: RenderContext, value?: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Handle VariableBinding object: { type: 'variable', key: '...', fallback: '...' }
  if (isVariableBinding(value)) {
    return resolveBinding(value, context).value;
  }

  // Handle string interpolation: "Hello {{ site.name }}" — resolves nested paths
  // the same way VariableBinding does, so both binding styles stay consistent.
  if (typeof value === 'string' && value.includes('{{')) {
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
      const outcome = resolveBinding({ key }, context);
      if (outcome.status === 'resolved') {
        return String(outcome.value);
      }
      return match;
    });
  }

  return value;
}

/**
 * Recursively resolves variables within an action payload without mutating the input object.
 */
export function resolveActionPayload(
  context?: RenderContext,
  payload?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const resolveValueRecursively = (val: unknown): unknown => {
    if (val === null || val === undefined) {
      return val;
    }
    if (isVariableBinding(val)) {
      return resolveVariable(context, val);
    }
    if (typeof val === 'string') {
      return resolveVariable(context, val);
    }
    if (Array.isArray(val)) {
      return val.map(resolveValueRecursively);
    }
    if (typeof val === 'object') {
      const copy: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        copy[k] = resolveValueRecursively(v);
      }
      return copy;
    }
    return val;
  };

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    resolved[key] = resolveValueRecursively(value);
  }

  return resolved;
}

/**
 * Action resolution helper.
 * Checks whether an action type is registered with the current action registry.
 */
export function isActionRegistered(actionRegistry?: ActionRegistry, actionType?: string): boolean {
  if (!actionRegistry || !actionType) {
    return false;
  }
  return Boolean(actionRegistry.get(actionType));
}

/**
 * Safe action dispatch options
 */
export interface DispatchActionOptions {
  action: ActionBinding | unknown;
  nodeId?: string;
  document: PageDocument;
  context?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  [key: string]: unknown;
}

/**
 * Dispatches an action safely from the renderer to registered host handlers.
 * Guarantees that:
 * 1. Payload variables are resolved safely.
 * 2. Unregistered / unknown actions are not executed and trigger diagnostics.
 * 3. No arbitrary JS code (eval, Function, script injection) from document/props is ever executed.
 */
export function dispatchAction(options: DispatchActionOptions): boolean {
  const { action, nodeId, document, context, onDiagnostic } = options;

  if (!isActionBinding(action)) {
    const diagnostic: ActionDiagnostic = {
      code: 'INVALID_ACTION_PAYLOAD',
      actionType:
        typeof (action as { type?: unknown })?.type === 'string'
          ? (action as { type: string }).type
          : 'unknown',
      nodeId,
      message: `Invalid action binding on node ${nodeId || 'unknown'}.`,
    };
    onDiagnostic?.(diagnostic);
    context?.onDiagnostic?.(diagnostic);
    return false;
  }

  const handler = context?.actionRegistry?.get(action.type);

  if (!handler) {
    const diagnostic: ActionDiagnostic = {
      code: 'UNKNOWN_ACTION',
      actionType: action.type,
      nodeId,
      message: `No action handler registered for action type "${action.type}".`,
    };
    onDiagnostic?.(diagnostic);
    context?.onDiagnostic?.(diagnostic);
    return false;
  }

  const resolvedPayload = resolveActionPayload(context, action.payload);

  const executionContext: ActionExecutionContext = {
    nodeId,
    document,
    variables: context?.variables,
  };

  try {
    const result = handler(resolvedPayload, executionContext);
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((error) => {
        const diagnostic: ActionDiagnostic = {
          code: 'ACTION_EXECUTION_ERROR',
          actionType: action.type,
          nodeId,
          message: `Action "${action.type}" handler threw an asynchronous error: ${
            error instanceof Error ? error.message : String(error)
          }`,
          error,
        };
        onDiagnostic?.(diagnostic);
        context?.onDiagnostic?.(diagnostic);
      });
    }
    return true;
  } catch (error) {
    const diagnostic: ActionDiagnostic = {
      code: 'ACTION_EXECUTION_ERROR',
      actionType: action.type,
      nodeId,
      message: `Action "${action.type}" handler threw a synchronous error: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error,
    };
    onDiagnostic?.(diagnostic);
    context?.onDiagnostic?.(diagnostic);
    return false;
  }
}
