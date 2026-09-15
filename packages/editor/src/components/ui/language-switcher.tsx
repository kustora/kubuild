import React from 'react';
import { useTranslation, EditorLocale } from '../../i18n';
import { Globe } from 'lucide-react';

export interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { locale, setLocale } = useTranslation();

  return (
    <div
      data-testid="language-switcher"
      className={`inline-flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-[10px] font-semibold ${className}`}
    >
      <Globe className="w-3 h-3 text-slate-400 ml-1" aria-hidden="true" />
      <button
        type="button"
        data-testid="lang-switch-en"
        onClick={() => setLocale('en')}
        className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
          locale === 'en'
            ? 'bg-white text-blue-600 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        title="English"
      >
        EN
      </button>
      <button
        type="button"
        data-testid="lang-switch-id"
        onClick={() => setLocale('id')}
        className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
          locale === 'id'
            ? 'bg-white text-blue-600 shadow-2xs font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
        title="Bahasa Indonesia"
      >
        ID
      </button>
    </div>
  );
};
