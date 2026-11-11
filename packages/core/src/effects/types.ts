/**
 * Effect plugin contract (STORA-650).
 *
 * An effect plugin owns one kind of runtime behavior (parallax, scroll-linked transforms,
 * ...). The document only stores `{ plugin, enabled, config }`; everything else — config
 * validation, defaults, editor controls, AI guidance and the DOM runtime — comes from the
 * plugin the host registers. That split is what keeps documents portable: a host without
 * a plugin keeps the effect data intact and simply doesn't run it.
 *
 * This module is type-only. `mount` mentions `HTMLElement`, but core never calls it — the
 * renderer does, in the browser. Everything else on a plugin is plain data plus a pure
 * `parse`, so the AI server can import the same plugin objects without a DOM.
 */

export type EffectFieldDescriptor =
  | {
      key: string;
      label: string;
      type: 'number';
      min: number;
      max: number;
      step?: number;
      unit?: string;
      description?: string;
    }
  | {
      key: string;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }>;
      description?: string;
    }
  | {
      key: string;
      label: string;
      type: 'boolean';
      description?: string;
    };

export type EffectParseResult<TConfig> =
  | { success: true; config: TConfig }
  | { success: false; error: string };

export interface EffectRuntimeContext {
  nodeId: string;
  mode: 'editor' | 'runtime';
  /** `prefers-reduced-motion: reduce` at mount time. */
  reducedMotion: boolean;
}

/** Called by the renderer to undo everything `mount` did to the element. */
export type EffectCleanup = () => void;

export interface EffectPlugin<TConfig extends Record<string, unknown> = Record<string, unknown>> {
  /** Stored in documents as `effects[].plugin`; lowercase letters, digits, single hyphens. */
  id: string;
  label: string;
  /** One sentence. Shown in the editor's effect picker and in the AI effect catalog. */
  description: string;
  category?: string;
  defaults: TConfig;
  /** JSON Schema of `config`, handed to the AI as the shape of `set_node_effect.config`. */
  configJsonSchema: Record<string, unknown>;
  /** Editor controls, rendered generically by the Effects panel. */
  fields: EffectFieldDescriptor[];
  /**
   * Validates untrusted config (document import, AI output) and fills defaults. Must be
   * pure and DOM-free — it also runs on the AI server.
   */
  parse(config: unknown): EffectParseResult<TConfig>;
  ai?: {
    /** When to reach for this effect and what values look good. */
    guidance?: string;
    examples?: Array<{ when: string; config: Partial<TConfig> }>;
  };
  /**
   * What the renderer does under `prefers-reduced-motion: reduce`. Default `'skip'`: the
   * effect is not mounted at all, which is right for anything that moves content.
   */
  reducedMotion?: 'skip' | 'mount';
  /** Browser-only runtime. Receives parsed config; returns a cleanup that restores the element. */
  mount?(element: HTMLElement, config: TConfig, context: EffectRuntimeContext): void | EffectCleanup;
}

/**
 * Identity helper that keeps `TConfig` inferred from `defaults` while checking the object
 * against the contract.
 */
export function defineEffectPlugin<TConfig extends Record<string, unknown>>(
  plugin: EffectPlugin<TConfig>,
): EffectPlugin<TConfig> {
  return plugin;
}
