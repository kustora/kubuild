import type { VariableCatalog } from '../types/interfaces';

/**
 * Segments never traversed/assigned while expanding a catalog key — mirrors the guard
 * in binding-resolver.ts so a host-declared key can't be used to reach the prototype chain.
 */
const FORBIDDEN_KEY_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Expands a host `VariableCatalog`'s dotted `sampleValue` keys (e.g. `'site.name'`,
 * `'products'`) into a nested object shaped the same way `resolveBinding` expects
 * `context.variables` to be shaped. Editor/preview-only: the result should be merged
 * into a `RuntimeContext.variables` for canvas preview, never written to a document.
 */
export function buildSampleVariablesFromCatalog(catalog?: VariableCatalog): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!catalog) {
    return result;
  }

  for (const entry of catalog) {
    const segments = entry.key.split('.').filter(Boolean);
    if (segments.length === 0 || segments.some((segment) => FORBIDDEN_KEY_SEGMENTS.has(segment))) {
      continue;
    }

    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const existing = cursor[segment];
      if (existing === null || typeof existing !== 'object' || Array.isArray(existing)) {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }
    cursor[segments[segments.length - 1]] = entry.sampleValue;
  }

  return result;
}
