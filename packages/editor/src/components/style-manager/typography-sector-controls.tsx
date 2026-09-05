import React, { useState, useEffect } from 'react';
import { DimensionUnitInput } from './dimension-sector-controls';
import { InheritanceIndicator, Breakpoint } from './inheritance-indicator';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';

export interface FontOption {
  label: string;
  value: string;
  category: 'sans-serif' | 'serif' | 'display' | 'monospace' | 'system';
  googleFontName?: string;
}

export const GOOGLE_FONTS: FontOption[] = [
  // System / Default
  { label: 'Default (Inherit)', value: '', category: 'system' },
  {
    label: 'System UI',
    value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    category: 'system',
  },

  // Sans-Serif Google Fonts
  { label: 'Inter', value: '"Inter", sans-serif', category: 'sans-serif', googleFontName: 'Inter' },
  {
    label: 'Plus Jakarta Sans',
    value: '"Plus Jakarta Sans", sans-serif',
    category: 'sans-serif',
    googleFontName: 'Plus Jakarta Sans',
  },
  { label: 'Outfit', value: '"Outfit", sans-serif', category: 'sans-serif', googleFontName: 'Outfit' },
  { label: 'Poppins', value: '"Poppins", sans-serif', category: 'sans-serif', googleFontName: 'Poppins' },
  { label: 'Roboto', value: '"Roboto", sans-serif', category: 'sans-serif', googleFontName: 'Roboto' },
  { label: 'Montserrat', value: '"Montserrat", sans-serif', category: 'sans-serif', googleFontName: 'Montserrat' },
  { label: 'Open Sans', value: '"Open Sans", sans-serif', category: 'sans-serif', googleFontName: 'Open Sans' },
  { label: 'Lato', value: '"Lato", sans-serif', category: 'sans-serif', googleFontName: 'Lato' },
  { label: 'DM Sans', value: '"DM Sans", sans-serif', category: 'sans-serif', googleFontName: 'DM Sans' },
  { label: 'Nunito', value: '"Nunito", sans-serif', category: 'sans-serif', googleFontName: 'Nunito' },

  // Serif Google Fonts
  {
    label: 'Playfair Display',
    value: '"Playfair Display", serif',
    category: 'serif',
    googleFontName: 'Playfair Display',
  },
  {
    label: 'Merriweather',
    value: '"Merriweather", serif',
    category: 'serif',
    googleFontName: 'Merriweather',
  },
  { label: 'Lora', value: '"Lora", serif', category: 'serif', googleFontName: 'Lora' },
  { label: 'Cinzel', value: '"Cinzel", serif', category: 'serif', googleFontName: 'Cinzel' },
  { label: 'PT Serif', value: '"PT Serif", serif', category: 'serif', googleFontName: 'PT Serif' },

  // Display / Modern Google Fonts
  {
    label: 'Space Grotesk',
    value: '"Space Grotesk", sans-serif',
    category: 'display',
    googleFontName: 'Space Grotesk',
  },
  {
    label: 'Syne',
    value: '"Syne", sans-serif',
    category: 'display',
    googleFontName: 'Syne',
  },
  { label: 'Bebas Neue', value: '"Bebas Neue", sans-serif', category: 'display', googleFontName: 'Bebas Neue' },

  // Monospace Fonts
  {
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", monospace',
    category: 'monospace',
    googleFontName: 'JetBrains Mono',
  },
  { label: 'Fira Code', value: '"Fira Code", monospace', category: 'monospace', googleFontName: 'Fira Code' },
  {
    label: 'Source Code Pro',
    value: '"Source Code Pro", monospace',
    category: 'monospace',
    googleFontName: 'Source Code Pro',
  },
];

export function loadGoogleFont(fontName: string): void {
  if (typeof document === 'undefined' || !fontName) return;
  const safeId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(safeId)) return;

  const link = document.createElement('link');
  link.id = safeId;
  link.rel = 'stylesheet';
  const queryName = fontName.replace(/\s+/g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${queryName}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

export interface TypographySectorControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
  baseStyles?: Record<string, unknown>;
  breakpoint?: Breakpoint;
  onResetProperty?: (property: string) => void;
}

export const TypographySectorControls: React.FC<TypographySectorControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
  baseStyles,
  breakpoint,
  onResetProperty,
}) => {
  const currentFont = typeof styles.fontFamily === 'string' ? styles.fontFamily : '';
  const [isCustomFont, setIsCustomFont] = useState(false);
  const [customFontText, setCustomFontText] = useState(currentFont);

  // Check if currentFont matches one of the preset Google Fonts
  const matchedFont = GOOGLE_FONTS.find(
    (f) => f.value === currentFont || (f.googleFontName && currentFont.includes(f.googleFontName)),
  );

  useEffect(() => {
    if (matchedFont?.googleFontName) {
      loadGoogleFont(matchedFont.googleFontName);
    }
  }, [matchedFont]);

  const handleFontSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__custom__') {
      setIsCustomFont(true);
      return;
    }
    setIsCustomFont(false);
    const selected = GOOGLE_FONTS.find((f) => f.value === val);
    if (selected?.googleFontName) {
      loadGoogleFont(selected.googleFontName);
    }
    onChange('fontFamily', val);
  };

  const handleCustomFontBlur = () => {
    if (customFontText.trim() !== '') {
      loadGoogleFont(customFontText.trim());
      onChange('fontFamily', customFontText.trim());
    } else {
      onChange('fontFamily', '');
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="typography-sector-controls">
      {/* Font Family (Google Fonts) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <label className="block text-[11px] font-medium text-slate-600">Font Family (Google Fonts)</label>
            {breakpoint && (
              <InheritanceIndicator
                property="fontFamily"
                activeBreakpoint={breakpoint}
                activeStyles={styles}
                baseStyles={baseStyles}
                onResetToInherited={onResetProperty}
                compact
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCustomFont(!isCustomFont)}
            className="text-[10px] text-blue-600 hover:text-blue-800 underline cursor-pointer"
          >
            {isCustomFont ? 'Choose from list' : 'Custom font'}
          </button>
        </div>

        {!isCustomFont ? (
          <select
            data-testid="typography-select-font-family"
            aria-label="Font Family"
            value={matchedFont ? matchedFont.value : currentFont ? '__custom__' : ''}
            disabled={disabled}
            onChange={handleFontSelect}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <optgroup label="System">
              {GOOGLE_FONTS.filter((f) => f.category === 'system').map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Google Sans-Serif">
              {GOOGLE_FONTS.filter((f) => f.category === 'sans-serif').map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Google Serif">
              {GOOGLE_FONTS.filter((f) => f.category === 'serif').map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Google Display">
              {GOOGLE_FONTS.filter((f) => f.category === 'display').map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Google Monospace">
              {GOOGLE_FONTS.filter((f) => f.category === 'monospace').map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            <option value="__custom__">Custom font name...</option>
          </select>
        ) : (
          <input
            type="text"
            data-testid="typography-input-custom-font"
            placeholder="e.g. Poppins, Outfit, serif"
            value={customFontText}
            disabled={disabled}
            onChange={(e) => setCustomFontText(e.target.value)}
            onBlur={handleCustomFontBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomFontBlur();
            }}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs font-mono"
          />
        )}
      </div>

      {/* Font Size & Font Weight */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="fontSize"
          label="Font Size"
          value={styles.fontSize}
          onChange={onChange}
          allowedUnits={['px', 'rem', 'em', 'vw', 'vh']}
          placeholder="16px"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-medium text-slate-600">Font Weight</label>
            {breakpoint && (
              <InheritanceIndicator
                property="fontWeight"
                activeBreakpoint={breakpoint}
                activeStyles={styles}
                baseStyles={baseStyles}
                onResetToInherited={onResetProperty}
                compact
              />
            )}
          </div>
          <select
            data-testid="typography-select-font-weight"
            aria-label="Font Weight"
            value={String(styles.fontWeight ?? 'normal')}
            disabled={disabled}
            onChange={(e) => onChange('fontWeight', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="100">100 - Thin</option>
            <option value="200">200 - Extra Light</option>
            <option value="300">300 - Light</option>
            <option value="400">400 - Regular</option>
            <option value="500">500 - Medium</option>
            <option value="600">600 - Semi Bold</option>
            <option value="700">700 - Bold</option>
            <option value="800">800 - Extra Bold</option>
            <option value="900">900 - Black</option>
          </select>
        </div>
      </div>

      {/* Line Height & Letter Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="lineHeight"
          label="Line Height"
          value={styles.lineHeight}
          onChange={onChange}
          allowedUnits={['px', 'rem', 'em', '%', 'auto']}
          placeholder="1.5"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
        <DimensionUnitInput
          property="letterSpacing"
          label="Letter Spacing"
          value={styles.letterSpacing}
          onChange={onChange}
          allowedUnits={['px', 'rem', 'em', 'auto']}
          placeholder="0px"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
      </div>

      {/* Color & Text Align */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-medium text-slate-600">Text Color</label>
            {breakpoint && (
              <InheritanceIndicator
                property="color"
                activeBreakpoint={breakpoint}
                activeStyles={styles}
                baseStyles={baseStyles}
                onResetToInherited={onResetProperty}
                compact
              />
            )}
          </div>
          <div className="flex items-center rounded border border-slate-300 bg-white p-0.5 focus-within:ring-1 focus-within:ring-blue-500 shadow-2xs">
            <input
              type="color"
              data-testid="typography-color-picker"
              aria-label="Color Picker"
              value={typeof styles.color === 'string' && styles.color.startsWith('#') ? styles.color : '#000000'}
              disabled={disabled}
              onChange={(e) => onChange('color', e.target.value)}
              className="w-6 h-6 rounded border border-slate-200 cursor-pointer p-0 shrink-0"
            />
            <input
              type="text"
              data-testid="typography-input-color"
              placeholder="#000000"
              value={String(styles.color ?? '')}
              disabled={disabled}
              onChange={(e) => onChange('color', e.target.value)}
              className="w-full min-w-0 text-xs bg-white text-slate-900 px-1.5 py-0.5 focus:outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Text Align</label>
          <div className="grid grid-cols-4 rounded border border-slate-300 bg-slate-100 p-0.5 gap-0.5 shadow-2xs">
            {[
              { id: 'left', label: 'Left', icon: <AlignLeft className="w-3.5 h-3.5 mx-auto" /> },
              { id: 'center', label: 'Center', icon: <AlignCenter className="w-3.5 h-3.5 mx-auto" /> },
              { id: 'right', label: 'Right', icon: <AlignRight className="w-3.5 h-3.5 mx-auto" /> },
              { id: 'justify', label: 'Justify', icon: <AlignJustify className="w-3.5 h-3.5 mx-auto" /> },
            ].map((btn) => {
              const isActive = (styles.textAlign ?? 'left') === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`typography-align-${btn.id}`}
                  title={`Align ${btn.label}`}
                  disabled={disabled}
                  onClick={() => onChange('textAlign', btn.id)}
                  className={`py-1 text-xs font-bold rounded transition cursor-pointer flex items-center justify-center ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {btn.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Text Decoration & Text Transform */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Decoration</label>
          <div className="grid grid-cols-4 rounded border border-slate-300 bg-slate-100 p-0.5 gap-0.5 shadow-2xs">
            {[
              { id: 'none', label: 'None', text: '—' },
              { id: 'underline', label: 'Underline', text: 'U', style: { textDecoration: 'underline' } },
              { id: 'line-through', label: 'Line-Through', text: 'S', style: { textDecoration: 'line-through' } },
              { id: 'overline', label: 'Overline', text: 'O', style: { textDecoration: 'overline' } },
            ].map((btn) => {
              const isActive = (styles.textDecoration ?? 'none') === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`typography-decor-${btn.id}`}
                  title={`Decoration: ${btn.label}`}
                  disabled={disabled}
                  style={btn.style}
                  onClick={() => onChange('textDecoration', btn.id)}
                  className={`py-1 text-xs font-bold rounded transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {btn.text}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Transform</label>
          <div className="grid grid-cols-4 rounded border border-slate-300 bg-slate-100 p-0.5 gap-0.5 shadow-2xs">
            {[
              { id: 'none', label: 'None', text: '—' },
              { id: 'uppercase', label: 'UPPERCASE', text: 'TT' },
              { id: 'lowercase', label: 'lowercase', text: 'tt' },
              { id: 'capitalize', label: 'Capitalize', text: 'Tt' },
            ].map((btn) => {
              const isActive = (styles.textTransform ?? 'none') === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  data-testid={`typography-transform-${btn.id}`}
                  title={`Transform: ${btn.label}`}
                  disabled={disabled}
                  onClick={() => onChange('textTransform', btn.id)}
                  className={`py-1 text-xs font-bold rounded transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {btn.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
