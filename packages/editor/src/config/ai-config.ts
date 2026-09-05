import type { AiProviderAdapter } from '@kubuild/ai';

/**
 * AI provider configuration for `KubuildEditorProps.ai` (STORA-501).
 *
 * Consistent with the `registry` / `context` / `config` opt-in pattern already used by
 * `KubuildEditorProps`: AI is always opt-in — without this prop, `KubuildEditor` renders
 * with zero AI UI and zero behavioral difference from today. The host (consumer) always
 * supplies the provider/API key; the editor never hardcodes or defaults to any provider.
 */
export interface AiEditorConfig {
  /** Adapter provider AI, or an HTTP endpoint pointing at the host's own `createAiHandler`. */
  provider: AiProviderAdapter | { endpoint: string; headers?: Record<string, string> };
  /** Per-capability feature flags. All default to `false` when `ai` config is not provided. */
  features?: {
    chat?: boolean;
    generate?: boolean;
    enhance?: boolean;
  };
  /** Default panel mode when the editor first mounts. Default: `'hidden'`. */
  defaultPanelMode?: 'docked' | 'floating' | 'hidden';
  /** Extra host-specific system prompt prefix (branding, tone, etc). */
  systemPromptPrefix?: string;
}

export interface ResolvedAiEditorConfig {
  enabled: boolean;
  provider: AiProviderAdapter | { endpoint: string; headers?: Record<string, string> } | null;
  features: {
    chat: boolean;
    generate: boolean;
    enhance: boolean;
  };
  defaultPanelMode: 'docked' | 'floating' | 'hidden';
  systemPromptPrefix?: string;
}

/**
 * Resolves an optional `AiEditorConfig` into a fully-populated `ResolvedAiEditorConfig`.
 *
 * Without a config given, every feature resolves to disabled/false and `provider` is `null` —
 * `KubuildEditor` must render with zero AI UI, exactly as it does today.
 */
export function resolveAiEditorConfig(config?: AiEditorConfig): ResolvedAiEditorConfig {
  if (!config) {
    return {
      enabled: false,
      provider: null,
      features: {
        chat: false,
        generate: false,
        enhance: false,
      },
      defaultPanelMode: 'hidden',
      systemPromptPrefix: undefined,
    };
  }

  const featuresCfg = config.features ?? {};

  return {
    enabled: true,
    provider: config.provider,
    features: {
      chat: featuresCfg.chat ?? false,
      generate: featuresCfg.generate ?? false,
      enhance: featuresCfg.enhance ?? false,
    },
    defaultPanelMode: config.defaultPanelMode ?? 'hidden',
    systemPromptPrefix: config.systemPromptPrefix,
  };
}
