import type { AnyEffectRuntime } from '@kubuild/core';
// The subpath, not the root: the root entry would pull the whole engine (and zod) into the page bundle.
import {
  EFFECT_MANIFEST_ELEMENT_ID,
  EFFECT_NODE_ATTRIBUTE,
  parseEffectManifest,
  type EffectManifest,
} from '@kubuild/core/effect-manifest';
import { createRuntimeMap, mountNodeEffects } from './mount.js';

export interface BootEffectsOptions {
  runtimes: Iterable<AnyEffectRuntime>;
  /** Defaults to the global `document`. */
  document?: Document;
  /** Defaults to the manifest read from `<script id="kb-effects">`. */
  manifest?: EffectManifest | null;
  onError?: (error: unknown, plugin: string) => void;
}

/** Reads and validates the page's effect manifest; `null` if absent or malformed. */
export function readEffectManifest(doc: Document): EffectManifest | null {
  const text = doc.getElementById(EFFECT_MANIFEST_ELEMENT_ID)?.textContent;
  if (!text) return null;
  try {
    return parseEffectManifest(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Mounts every effect in the manifest on its `[data-kb-node]` element. Returns a cleanup
 * that unmounts all of them (for hosts that swap pages without a reload).
 */
export function bootEffects(options: BootEffectsOptions): () => void {
  const doc = options.document ?? globalThis.document;
  if (!doc) return () => {};
  const manifest = options.manifest === undefined ? readEffectManifest(doc) : options.manifest;
  if (!manifest) return () => {};

  const runtimes = createRuntimeMap(options.runtimes);
  const cleanups: Array<() => void> = [];
  // Look ids up by attribute value rather than building a selector: ids are document data.
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>(`[${EFFECT_NODE_ATTRIBUTE}]`))) {
    const nodeId = element.getAttribute(EFFECT_NODE_ATTRIBUTE);
    if (nodeId === null || !Object.prototype.hasOwnProperty.call(manifest.nodes, nodeId)) continue;
    cleanups.push(
      mountNodeEffects(element, manifest.nodes[nodeId], runtimes, { nodeId, mode: 'runtime', onError: options.onError }),
    );
  }

  return () => {
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}
