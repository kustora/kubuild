import { useEditorStore, EditorLocale } from '../store';
import { TranslationSchema } from './types';
import { en } from './locales/en';
import { id } from './locales/id';

export * from './types';
export { en } from './locales/en';
export { id } from './locales/id';

const TRANSLATIONS: Record<EditorLocale, TranslationSchema> = {
  en,
  id,
};

/**
 * Returns the translation dictionary for a given locale (defaults to English).
 */
export function getTranslation(locale: EditorLocale = 'en'): TranslationSchema {
  return TRANSLATIONS[locale] ?? TRANSLATIONS.en;
}

/**
 * React hook that connects to useEditorStore to return the active locale,
 * a setter function, and the reactive translation dictionary.
 */
export function useTranslation() {
  const storeLocale = useEditorStore((state) => state.locale);
  const setLocale = useEditorStore((state) => state.setLocale);
  // During SSR (renderToString in Vitest/Node), useSyncExternalStore delegates to
  // getServerSnapshot which returns Zustand's getInitialState().
  // Reading getState().locale ensures that active state mutations in tests and SSR are respected.
  const activeLocale =
    typeof useEditorStore.getState === 'function'
      ? useEditorStore.getState().locale
      : storeLocale;
  const t = getTranslation(activeLocale);

  return {
    locale: activeLocale,
    setLocale,
    t,
  };
}
