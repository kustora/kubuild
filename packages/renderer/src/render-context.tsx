import React, { createContext, useContext, useMemo } from 'react';
import type { AssetProvider, ActionRegistry, ActionHandler, RenderContext, RuntimeContext } from '@kubuild/core';
import { isVariableBinding } from '@kubuild/schema';

export type { RenderContext, RuntimeContext };

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
}): RenderContext {
  if (!options) {
    return DEFAULT_RENDER_CONTEXT;
  }

  const frozenVariables = options.variables ? Object.freeze({ ...options.variables }) : undefined;

  return Object.freeze({
    variables: frozenVariables,
    ...(options.assetProvider ? { assetProvider: options.assetProvider } : {}),
    ...(options.actionRegistry ? { actionRegistry: options.actionRegistry } : {}),
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
    const resolved = context?.variables?.[value.key];
    if (resolved !== undefined) {
      return resolved;
    }
    return value.fallback ?? '';
  }

  // Handle string interpolation: "Hello {{ user.name }}"
  if (typeof value === 'string' && value.includes('{{')) {
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
      const resolved = context?.variables?.[key];
      if (resolved !== undefined) {
        return String(resolved);
      }
      return match;
    });
  }

  return value;
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
