import type { Node } from '@kubuild/schema';
import { resolveEffect, type EffectRegistry } from './registry.js';
import { EFFECT_MANIFEST_VERSION, type EffectManifest, type EffectManifestEntry } from './manifest-format.js';

export interface SkippedManifestEffect {
  nodeId: string;
  plugin: string;
  reason: 'unknown-plugin' | 'invalid-config' | 'no-runtime';
  error?: string;
}

export interface EffectManifestResult {
  manifest: EffectManifest;
  /** Effects left out of the page. Disabled effects are omitted silently, not listed here. */
  skipped: SkippedManifestEffect[];
}

export function buildEffectManifest(root: Node, registry: EffectRegistry): EffectManifestResult {
  // Null prototype: node ids are document data, and an id like "__proto__" must stay a key.
  const nodes = Object.create(null) as Record<string, EffectManifestEntry[]>;
  const skipped: SkippedManifestEffect[] = [];

  const walk = (node: Node): void => {
    const entries: EffectManifestEntry[] = [];
    for (const effect of node.effects ?? []) {
      const resolved = resolveEffect(effect, registry);
      switch (resolved.status) {
        case 'disabled':
          break;
        case 'unknown-plugin':
          skipped.push({ nodeId: node.id, plugin: effect.plugin, reason: 'unknown-plugin' });
          break;
        case 'invalid-config':
          skipped.push({ nodeId: node.id, plugin: effect.plugin, reason: 'invalid-config', error: resolved.error });
          break;
        case 'ok':
          if (resolved.plugin.mount) {
            entries.push({ plugin: effect.plugin, config: resolved.config });
          } else {
            skipped.push({ nodeId: node.id, plugin: effect.plugin, reason: 'no-runtime' });
          }
          break;
      }
    }
    if (entries.length > 0) nodes[node.id] = entries;
    node.children?.forEach(walk);
  };
  walk(root);

  return { manifest: { version: EFFECT_MANIFEST_VERSION, nodes }, skipped };
}
