import type { VariableBinding } from '@kubuild/schema';
import type { RuntimeContext } from './interfaces';

/**
 * Segments a VariableBinding key must never traverse into, checked before any
 * property access so it can't be bypassed by proxies/getters on the traversed object.
 */
const FORBIDDEN_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export type ResolveOutcome =
  | { status: 'resolved'; value: unknown }
  | { status: 'fallback'; value: unknown }
  | { status: 'empty'; value: '' };

// `key`/`fallback` are never passed to eval/Function/any code-execution path in this
// module — resolution is pure data traversal, never expression evaluation.
export function resolveBinding(
  binding: Pick<VariableBinding, 'key' | 'fallback'>,
  context: RuntimeContext | undefined,
): ResolveOutcome {
  const segments = binding.key.split('.').filter(Boolean);
  let current: unknown = context?.variables;

  for (const segment of segments) {
    if (FORBIDDEN_KEY_SEGMENTS.has(segment)) {
      return applyMissingPolicy(binding);
    }
    if (current === null || typeof current !== 'object') {
      return applyMissingPolicy(binding);
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return applyMissingPolicy(binding);
    }
    current = (current as Record<string, unknown>)[segment];
  }

  if (current === undefined || typeof current === 'function') {
    return applyMissingPolicy(binding);
  }

  return { status: 'resolved', value: current };
}

function applyMissingPolicy(binding: Pick<VariableBinding, 'fallback'>): ResolveOutcome {
  if (binding.fallback !== undefined) {
    return { status: 'fallback', value: binding.fallback };
  }
  return { status: 'empty', value: '' };
}

/** Convenience wrapper returning just the resolved/fallback/empty value. */
export function resolveBindingValue(
  binding: Pick<VariableBinding, 'key' | 'fallback'>,
  context: RuntimeContext | undefined,
): unknown {
  return resolveBinding(binding, context).value;
}
