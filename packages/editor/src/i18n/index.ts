import { createContext, useContext } from 'react';
import { useEditorStore, EditorLocale } from '../store';
import { DeepPartial, TranslationOverrides, TranslationSchema } from './types';
import { en } from './locales/en';
import { id } from './locales/id';

export * from './types';
export { en } from './locales/en';
export { id } from './locales/id';

const BUILT_IN_TRANSLATIONS: Readonly<Record<string, TranslationSchema>> = {
  en,
  id,
};

/** Custom locales registered via `registerEditorLocale`, already merged over their base. */
const registeredLocales = new Map<string, TranslationSchema>();

/** Bumped on every registration change so cached merges are invalidated. */
let registryVersion = 0;
const mergeCache = new WeakMap<
  object,
  Map<string, { version: number; value: TranslationSchema }>
>();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-merges `override` over `base`. Plain objects recurse; functions, strings and other
 * values replace the base value; `undefined` keeps it (per-key fallback).
 */
export function mergeTranslations<T>(base: T, override: NoInfer<DeepPartial<T>> | undefined): T {
  if (!override || !isPlainObject(base) || !isPlainObject(override)) {
    return base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseValue = (base as Record<string, unknown>)[key];
    result[key] =
      isPlainObject(baseValue) && isPlainObject(value)
        ? mergeTranslations<Record<string, unknown>>(baseValue, value)
        : value;
  }
  return result as T;
}

/**
 * Registers (or replaces) a custom editor locale. The dictionary may be partial — every
 * missing key falls back to English. Registering a built-in code (`en`/`id`) overrides
 * that locale's built-in strings globally.
 */
export function registerEditorLocale(
  code: string,
  dictionary: DeepPartial<TranslationSchema>,
): void {
  const base = BUILT_IN_TRANSLATIONS[code] ?? en;
  registeredLocales.set(code, mergeTranslations(base, dictionary));
  registryVersion += 1;
}

/** Removes a locale previously added with `registerEditorLocale`. */
export function unregisterEditorLocale(code: string): void {
  if (registeredLocales.delete(code)) registryVersion += 1;
}

/** Built-in plus registered locale codes. */
export function getAvailableEditorLocales(): EditorLocale[] {
  return Array.from(new Set([...Object.keys(BUILT_IN_TRANSLATIONS), ...registeredLocales.keys()]));
}

function getBaseTranslation(locale: EditorLocale): TranslationSchema {
  return registeredLocales.get(locale) ?? BUILT_IN_TRANSLATIONS[locale] ?? en;
}

/**
 * Returns the translation dictionary for a given locale (defaults to English).
 * Unknown locales fall back to English; `overrides[locale]` is deep-merged on top.
 */
export function getTranslation(
  locale: EditorLocale = 'en',
  overrides?: TranslationOverrides,
): TranslationSchema {
  const base = getBaseTranslation(locale);
  const localeOverride = overrides?.[locale];
  if (!overrides || !localeOverride) return base;

  let perLocale = mergeCache.get(overrides);
  if (!perLocale) {
    perLocale = new Map();
    mergeCache.set(overrides, perLocale);
  }
  const cached = perLocale.get(locale);
  if (cached && cached.version === registryVersion) return cached.value;

  const value = mergeTranslations(base, localeOverride);
  perLocale.set(locale, { version: registryVersion, value });
  return value;
}

/**
 * Carries host translation overrides to every `useTranslation` consumer below it.
 * `KubuildEditor` provides it from its `translations` prop; wrap standalone panels
 * (e.g. a bare `InspectorPanel`) in it yourself to apply overrides there.
 */
export const TranslationOverridesContext = createContext<TranslationOverrides | undefined>(
  undefined,
);

/**
 * React hook that connects to useEditorStore to return the active locale,
 * a setter function, and the reactive translation dictionary (including any
 * `translations` overrides supplied to `KubuildEditor`).
 */
export function useTranslation() {
  const storeLocale = useEditorStore((state) => state.locale);
  const setLocale = useEditorStore((state) => state.setLocale);
  const overrides = useContext(TranslationOverridesContext);
  // During SSR (renderToString in Vitest/Node), useSyncExternalStore delegates to
  // getServerSnapshot which returns Zustand's getInitialState().
  // Reading getState().locale ensures that active state mutations in tests and SSR are respected.
  const activeLocale =
    typeof useEditorStore.getState === 'function' ? useEditorStore.getState().locale : storeLocale;
  const t = getTranslation(activeLocale, overrides);

  return {
    locale: activeLocale,
    setLocale,
    t,
  };
}
