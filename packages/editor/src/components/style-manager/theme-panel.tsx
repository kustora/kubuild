import React, { useState } from 'react';
import {
  THEME_TOKEN_GROUPS,
  isSafeThemeTokenKey,
  isSafeThemeTokenValue,
  themeTokenRef,
  type Theme,
  type ThemeTokenGroup,
} from '@kubuild/schema';
import type { UpdateThemeParams } from '@kubuild/core';

/** Token patch accepted by `updateTheme` (a `null` token value removes it). */
export type ThemePatch = NonNullable<UpdateThemeParams['theme']>;

const GROUP_LABELS: Record<ThemeTokenGroup, string> = {
  colors: 'Colors',
  fonts: 'Fonts',
  radii: 'Radii',
  spacing: 'Spacing',
};

const GROUP_PLACEHOLDERS: Record<ThemeTokenGroup, string> = {
  colors: '#2563eb',
  fonts: '"Inter", sans-serif',
  radii: '8px',
  spacing: '16px',
};

export interface ThemePanelProps {
  /** The document's current theme (`PageDocument.theme`). */
  theme?: Theme;
  /** Receives a token patch; the host applies it through the `updateTheme` command. */
  onChange: (patch: ThemePatch) => void;
  className?: string;
}

/**
 * Theme panel (STORA-551): edits the document-level design tokens. Changing a token here
 * restyles every node that references it (`var(--kb-color-primary)` etc.) at once.
 */
export const ThemePanel: React.FC<ThemePanelProps> = ({ theme, onChange, className = '' }) => {
  const [activeGroup, setActiveGroup] = useState<ThemeTokenGroup>('colors');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tokens = Object.entries(theme?.[activeGroup] ?? {});

  const commit = (key: string, value: string | number | null) => {
    if (value !== null && !isSafeThemeTokenValue(value)) {
      setError(`"${String(value)}" is not an allowed token value.`);
      return;
    }
    setError(null);
    onChange({ [activeGroup]: { [key]: value } });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKey.trim();
    if (!isSafeThemeTokenKey(key)) {
      setError('Token name may only contain letters, digits, "-" and "_".');
      return;
    }
    const raw = newValue.trim();
    if (!isSafeThemeTokenValue(raw)) {
      setError(`"${raw}" is not an allowed token value.`);
      return;
    }
    setError(null);
    onChange({ [activeGroup]: { [key]: raw } });
    setNewKey('');
    setNewValue('');
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="theme-panel">
      <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded border border-slate-200">
        {THEME_TOKEN_GROUPS.map((group) => (
          <button
            key={group}
            type="button"
            data-testid={`theme-tab-${group}`}
            onClick={() => setActiveGroup(group)}
            className={`flex-1 px-1.5 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
              activeGroup === group
                ? 'bg-white text-blue-600 font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {GROUP_LABELS[group]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1" data-testid={`theme-tokens-${activeGroup}`}>
        {tokens.length === 0 && (
          <span className="text-[11px] text-slate-400">
            No {GROUP_LABELS[activeGroup].toLowerCase()} tokens yet.
          </span>
        )}
        {tokens.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center gap-1.5"
            data-testid={`theme-token-${activeGroup}-${key}`}
          >
            {activeGroup === 'colors' &&
              typeof value === 'string' &&
              /^#[0-9a-f]{6}$/i.test(value) && (
                <input
                  type="color"
                  aria-label={`${key} color`}
                  value={value}
                  onChange={(e) => commit(key, e.target.value)}
                  className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0.5 shrink-0"
                />
              )}
            <span
              className="text-[11px] font-medium text-slate-700 w-20 truncate"
              title={themeTokenRef(activeGroup, key)}
            >
              {key}
            </span>
            <input
              type="text"
              aria-label={`${key} value`}
              defaultValue={String(value)}
              onBlur={(e) => {
                const next = e.target.value.trim();
                if (next !== String(value)) commit(key, next);
              }}
              className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 font-mono"
            />
            <button
              type="button"
              data-testid={`theme-token-remove-${activeGroup}-${key}`}
              onClick={() => commit(key, null)}
              className="text-[11px] text-slate-400 hover:text-red-600 cursor-pointer px-1"
              aria-label={`Remove ${key}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleAdd}
        className="flex items-center gap-1.5"
        data-testid="theme-add-token-form"
      >
        <input
          type="text"
          data-testid="theme-add-token-key"
          placeholder="name"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="w-20 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5"
        />
        <input
          type="text"
          data-testid="theme-add-token-value"
          placeholder={GROUP_PLACEHOLDERS[activeGroup]}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 font-mono"
        />
        <button
          type="submit"
          data-testid="theme-add-token-btn"
          className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
        >
          Add
        </button>
      </form>

      {error && (
        <span className="text-[11px] text-red-600" role="alert" data-testid="theme-panel-error">
          {error}
        </span>
      )}
    </div>
  );
};
