import type { VariableCatalog, VariableDefinition } from '../types/interfaces.js';

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

export interface VariableCatalogGroup {
  group: string;
  entries: VariableDefinition[];
}

/**
 * The group an entry is listed under in the editor: its explicit `group`, else the
 * first segment of its dotted `key` (so `store.name` lands in "store").
 */
export function getVariableGroup(entry: VariableDefinition): string {
  const explicit = entry.group?.trim();
  if (explicit) {
    return explicit;
  }
  return entry.key.split('.').find(Boolean) ?? entry.key;
}

/**
 * Buckets a flat catalog by `getVariableGroup`, keeping groups in the order they first
 * appear and entries in catalog order — the host controls ordering by how it builds the list.
 */
export function groupVariableCatalog(catalog?: VariableCatalog): VariableCatalogGroup[] {
  const groups = new Map<string, VariableDefinition[]>();
  for (const entry of catalog ?? []) {
    const group = getVariableGroup(entry);
    const bucket = groups.get(group);
    if (bucket) {
      bucket.push(entry);
    } else {
      groups.set(group, [entry]);
    }
  }
  return Array.from(groups, ([group, entries]) => ({ group, entries }));
}
