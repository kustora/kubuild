import React from 'react';
import { useTranslation, EditorLocale } from '../../i18n';
import { Globe } from 'lucide-react';

export interface LanguageSwitcherOption {
  code: EditorLocale;
  /** Short button label, e.g. `EN`. */
  label: string;
  /** Tooltip / accessible title, e.g. `English`. */
  title?: string;
}

export const DEFAULT_LANGUAGE_SWITCHER_OPTIONS: readonly LanguageSwitcherOption[] = [
  { code: 'en', label: 'EN', title: 'English' },
  { code: 'id', label: 'ID', title: 'Bahasa Indonesia' },
];

export interface LanguageSwitcherProps {
  className?: string;
  /**
   * Locales to offer. Defaults to the built-in English / Indonesian pair; pass your own
   * list to include custom locales added with `registerEditorLocale` or `translations`.
   */
  locales?: readonly LanguageSwitcherOption[];
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  className = '',
  locales = DEFAULT_LANGUAGE_SWITCHER_OPTIONS,
}) => {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      data-testid="language-switcher"
      className={`inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px] font-semibold ${className}`}
    >
      <Globe className="w-3 h-3 text-slate-400 ml-1" aria-hidden="true" />
      {locales.map((option) => (
        <button
          key={option.code}
          type="button"
          data-testid={`lang-switch-${option.code}`}
          onClick={() => setLocale(option.code)}
          className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
            locale === option.code
              ? 'bg-white text-blue-600 shadow-2xs font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
          title={option.title ?? option.label}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
