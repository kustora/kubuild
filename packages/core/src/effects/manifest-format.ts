// Dependency-free on purpose: also published as `@kubuild/core/effect-manifest` for page
// bundles, which must not pull in the schema package (and zod).

/**
 * Effect manifest: the contract between a static HTML export and the page runtime
 * (`@kubuild/runtime-dom`). The exporter resolves every effect against the host registry at
 * export time and writes only enabled, valid, mountable effects with their *parsed* config,
 * so the runtime never validates or fills defaults itself.
 *
 * On the page it travels as `<script type="application/json" id="kb-effects">`, and every
 * node it mentions carries `data-kb-node="<node id>"`.
 */

export const EFFECT_MANIFEST_VERSION = 1;
export const EFFECT_MANIFEST_ELEMENT_ID = 'kb-effects';
export const EFFECT_NODE_ATTRIBUTE = 'data-kb-node';

export interface EffectManifestEntry {
  plugin: string;
  config: Record<string, unknown>;
}

export interface EffectManifest {
  version: typeof EFFECT_MANIFEST_VERSION;
  /** Node id → effects, in the node's authored order. */
  nodes: Record<string, EffectManifestEntry[]>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads a manifest from untrusted JSON (it sits in a page anyone can edit). Malformed
 * entries are dropped individually; a wrong version or shape yields `null`.
 */
export function parseEffectManifest(value: unknown): EffectManifest | null {
  if (!isPlainObject(value) || value.version !== EFFECT_MANIFEST_VERSION || !isPlainObject(value.nodes)) {
    return null;
  }
  const nodes = Object.create(null) as Record<string, EffectManifestEntry[]>;
  for (const [nodeId, raw] of Object.entries(value.nodes)) {
    if (!Array.isArray(raw)) continue;
    const entries = raw.filter(
      (entry): entry is EffectManifestEntry =>
        isPlainObject(entry) && typeof entry.plugin === 'string' && isPlainObject(entry.config),
    );
    if (entries.length > 0) nodes[nodeId] = entries.map(({ plugin, config }) => ({ plugin, config }));
  }
  return { version: EFFECT_MANIFEST_VERSION, nodes };
}
