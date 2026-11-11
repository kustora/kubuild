import { EFFECT_PLUGIN_ID_PATTERN, type Node, type NodeEffect } from '@kubuild/schema';
import type { EffectPlugin } from './types.js';

// The registry stores heterogeneous plugins; their config types are only meaningful to
// the plugin itself, so they are erased here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEffectPlugin = EffectPlugin<any>;

/**
 * Host-side catalog of effect plugins (STORA-651). Mirrors `ComponentRegistry`: effects are
 * registered, never hardcoded into the renderer, editor or AI.
 */
export class EffectRegistry {
  private plugins = new Map<string, AnyEffectPlugin>();

  constructor(plugins: AnyEffectPlugin[] = []) {
    this.registerAll(plugins);
  }

  register(plugin: AnyEffectPlugin): this {
    if (!EFFECT_PLUGIN_ID_PATTERN.test(plugin.id)) {
      throw new Error(
        `Invalid effect plugin id "${plugin.id}": use lowercase letters, digits and single hyphens`,
      );
    }
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Effect plugin "${plugin.id}" is already registered`);
    }
    this.plugins.set(plugin.id, plugin);
    return this;
  }

  registerAll(plugins: AnyEffectPlugin[]): this {
    for (const plugin of plugins) this.register(plugin);
    return this;
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): AnyEffectPlugin | undefined {
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  list(): AnyEffectPlugin[] {
    return [...this.plugins.values()];
  }

  get size(): number {
    return this.plugins.size;
  }
}

export function createEffectRegistry(plugins: AnyEffectPlugin[] = []): EffectRegistry {
  return new EffectRegistry(plugins);
}

export type ResolvedNodeEffect =
  | { status: 'ok'; effect: NodeEffect; plugin: AnyEffectPlugin; config: Record<string, unknown> }
  | { status: 'disabled'; effect: NodeEffect }
  | { status: 'unknown-plugin'; effect: NodeEffect }
  | { status: 'invalid-config'; effect: NodeEffect; plugin: AnyEffectPlugin; error: string };

/** Resolves one stored effect against the registry, parsing its config with the plugin. */
export function resolveEffect(effect: NodeEffect, registry: EffectRegistry): ResolvedNodeEffect {
  if (effect.enabled === false) return { status: 'disabled', effect };
  const plugin = registry.get(effect.plugin);
  if (!plugin) return { status: 'unknown-plugin', effect };
  const parsed = plugin.parse(effect.config ?? {});
  if (!parsed.success) return { status: 'invalid-config', effect, plugin, error: parsed.error };
  return { status: 'ok', effect, plugin, config: parsed.config };
}

export function resolveNodeEffects(node: Node, registry: EffectRegistry): ResolvedNodeEffect[] {
  return (node.effects ?? []).map((effect) => resolveEffect(effect, registry));
}

/** Every node in the tree that carries at least one effect, in document order. */
export function collectEffectNodes(root: Node): Node[] {
  const result: Node[] = [];
  const walk = (node: Node): void => {
    if (node.effects && node.effects.length > 0) result.push(node);
    node.children?.forEach(walk);
  };
  walk(root);
  return result;
}
