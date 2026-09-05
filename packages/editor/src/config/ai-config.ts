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

/**
 * Whether any AI capability is actually turned on (STORA-504's "atau fitur AI nonaktif di
 * AiEditorConfig" check). `resolved.enabled` alone only means an `ai` config object was
 * given — a host can supply `provider` with every `features.*` flag left `false`/omitted,
 * which must still be treated as "AI disabled" for UI gating (toolbar toggle, chat panel).
 */
export function isAnyAiFeatureEnabled(resolved: ResolvedAiEditorConfig): boolean {
  return (
    resolved.enabled &&
    (resolved.features.chat || resolved.features.generate || resolved.features.enhance)
  );
}

/**
 * Pure gating logic (STORA-503) for whether `KubuildEditor` should mount the AI Chat Panel
 * in a given layout slot (`'docked'` or `'floating'`). Factored out of the JSX conditional
 * in `editor.tsx` so it has a single, directly-unit-testable source of truth — the panel
 * mode itself lives in Zustand store state, which `react-dom/server`'s SSR snapshot
 * (`getServerSnapshot` → `store.getInitialState()`) can't reflect post-mutation in tests,
 * so this function is exercised with plain boolean/string inputs instead.
 */
export function shouldRenderAiChatPanel(
  aiFeatureEnabled: boolean,
  aiChatMode: 'docked' | 'floating' | 'hidden',
  targetMode: 'docked' | 'floating',
): boolean {
  return aiFeatureEnabled && aiChatMode === targetMode;
}

/**
 * Whether the AI Chat toolbar toggle (STORA-504) should render in its "active/highlighted"
 * visual state — i.e. the panel is open in some form (docked or floating), not hidden.
 */
export function isAiChatPanelActive(aiChatMode: 'docked' | 'floating' | 'hidden'): boolean {
  return aiChatMode !== 'hidden';
}
