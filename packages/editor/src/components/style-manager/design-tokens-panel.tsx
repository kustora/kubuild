import React, { useState } from 'react';

export interface ColorToken {
  id: string;
  name: string;
  value: string;
  category?: 'brand' | 'neutral' | 'status' | 'custom';
}

export interface TypographyToken {
  id: string;
  name: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing?: string;
}

export const DEFAULT_COLOR_TOKENS: ColorToken[] = [
  { id: 'primary', name: 'Primary', value: '#3b82f6', category: 'brand' },
  { id: 'secondary', name: 'Secondary', value: '#64748b', category: 'brand' },
  { id: 'accent', name: 'Accent', value: '#8b5cf6', category: 'brand' },
  { id: 'success', name: 'Success', value: '#22c55e', category: 'status' },
  { id: 'warning', name: 'Warning', value: '#f59e0b', category: 'status' },
  { id: 'danger', name: 'Danger', value: '#ef4444', category: 'status' },
  { id: 'background', name: 'Background', value: '#ffffff', category: 'neutral' },
  { id: 'surface', name: 'Surface', value: '#f8fafc', category: 'neutral' },
  { id: 'text-primary', name: 'Text Primary', value: '#0f172a', category: 'neutral' },
  { id: 'text-muted', name: 'Text Muted', value: '#64748b', category: 'neutral' },
];

export const DEFAULT_TYPOGRAPHY_TOKENS: TypographyToken[] = [
  {
    id: 'display-h1',
    name: 'Display H1',
    fontFamily: '"Inter", sans-serif',
    fontSize: '36px',
    fontWeight: '800',
    lineHeight: '1.2',
  },
  {
    id: 'heading-h2',
    name: 'Heading H2',
    fontFamily: '"Inter", sans-serif',
    fontSize: '28px',
    fontWeight: '700',
    lineHeight: '1.3',
  },
  {
    id: 'heading-h3',
    name: 'Heading H3',
    fontFamily: '"Inter", sans-serif',
    fontSize: '22px',
    fontWeight: '600',
    lineHeight: '1.4',
  },
  {
    id: 'body-regular',
    name: 'Body Regular',
    fontFamily: '"Inter", sans-serif',
    fontSize: '16px',
    fontWeight: '400',
    lineHeight: '1.5',
  },
  {
    id: 'body-bold',
    name: 'Body Bold',
    fontFamily: '"Inter", sans-serif',
    fontSize: '16px',
    fontWeight: '600',
    lineHeight: '1.5',
  },
  {
    id: 'caption',
    name: 'Caption',
    fontFamily: '"Inter", sans-serif',
    fontSize: '13px',
    fontWeight: '400',
    lineHeight: '1.4',
  },
  {
    id: 'monospace',
    name: 'Monospace Code',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '14px',
    fontWeight: '400',
    lineHeight: '1.6',
  },
];

export interface DesignTokensPanelProps {
  colorTokens?: ColorToken[];
  typographyTokens?: TypographyToken[];
  onApplyColor?: (property: 'backgroundColor' | 'color' | 'borderColor', value: string) => void;
  onApplyTypography?: (styles: Record<string, string>) => void;
  onAddColorToken?: (token: ColorToken) => void;
  onAddTypographyToken?: (token: TypographyToken) => void;
  onDeleteColorToken?: (id: string) => void;
  className?: string;
}

export const DesignTokensPanel: React.FC<DesignTokensPanelProps> = ({
  colorTokens: initialColors = DEFAULT_COLOR_TOKENS,
  typographyTokens: initialTypography = DEFAULT_TYPOGRAPHY_TOKENS,
  onApplyColor,
  onApplyTypography,
  onAddColorToken,
  onAddTypographyToken,
  onDeleteColorToken,
  className = '',
}) => {
  const [colors, setColors] = useState<ColorToken[]>(initialColors);
  const [typography, setTypography] = useState<TypographyToken[]>(initialTypography);

  const [activeTab, setActiveTab] = useState<'colors' | 'typography'>('colors');
  const [selectedColorToken, setSelectedColorToken] = useState<ColorToken | null>(null);

  // New color token form
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorVal, setNewColorVal] = useState('#3b82f6');

  // New typography token form
  const [isAddingTypo, setIsAddingTypo] = useState(false);
  const [newTypoName, setNewTypoName] = useState('');
  const [newTypoFont, setNewTypoFont] = useState('"Inter", sans-serif');
  const [newTypoSize, setNewTypoSize] = useState('16px');
  const [newTypoWeight, setNewTypoWeight] = useState('400');
  const [newTypoLineHeight, setNewTypoLineHeight] = useState('1.5');

  const handleCreateColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorName.trim()) return;
    const token: ColorToken = {
      id: `custom-color-${Date.now()}`,
      name: newColorName.trim(),
      value: newColorVal,
      category: 'custom',
    };
    setColors((prev) => [...prev, token]);
    if (onAddColorToken) onAddColorToken(token);
    setNewColorName('');
    setIsAddingColor(false);
  };

  const handleCreateTypography = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypoName.trim()) return;
    const token: TypographyToken = {
      id: `custom-typo-${Date.now()}`,
      name: newTypoName.trim(),
      fontFamily: newTypoFont,
      fontSize: newTypoSize,
      fontWeight: newTypoWeight,
      lineHeight: newTypoLineHeight,
    };
    setTypography((prev) => [...prev, token]);
    if (onAddTypographyToken) onAddTypographyToken(token);
    setNewTypoName('');
    setIsAddingTypo(false);
  };

  const handleApplyColor = (property: 'backgroundColor' | 'color' | 'borderColor', val: string) => {
    if (onApplyColor) {
      onApplyColor(property, val);
    }
  };

  const handleApplyTypographyPreset = (token: TypographyToken) => {
    if (onApplyTypography) {
      const stylesToApply: Record<string, string> = {
        fontFamily: token.fontFamily,
        fontSize: token.fontSize,
        fontWeight: token.fontWeight,
        lineHeight: token.lineHeight,
      };
      if (token.letterSpacing) {
        stylesToApply.letterSpacing = token.letterSpacing;
      }
      onApplyTypography(stylesToApply);
    }
  };

  return (
    <div className={`flex flex-col gap-3 p-3 bg-white rounded-lg border border-slate-200 shadow-2xs ${className}`} data-testid="design-tokens-panel">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
          Global Design Tokens
        </span>
        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 shadow-2xs">
          <button
            type="button"
            data-testid="token-tab-colors"
            onClick={() => setActiveTab('colors')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
              activeTab === 'colors' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Colors
          </button>
          <button
            type="button"
            data-testid="token-tab-typography"
            onClick={() => setActiveTab('typography')}
            className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
              activeTab === 'typography' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Typography
          </button>
        </div>
      </div>

      {/* Colors Tab */}
      {activeTab === 'colors' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">Color Swatches</span>
            <button
              type="button"
              data-testid="toggle-add-color-token"
              onClick={() => setIsAddingColor(!isAddingColor)}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              {isAddingColor ? 'Cancel' : '+ Add Swatch'}
            </button>
          </div>

          {/* New color token form */}
          {isAddingColor && (
            <form onSubmit={handleCreateColor} className="flex flex-col gap-2 p-2 bg-slate-50 rounded border border-slate-200 shadow-2xs">
              <input
                type="text"
                data-testid="add-color-token-name"
                placeholder="Token name (e.g. Brand Muted)"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  data-testid="add-color-token-picker"
                  value={newColorVal}
                  onChange={(e) => setNewColorVal(e.target.value)}
                  className="w-7 h-7 rounded border border-slate-300 cursor-pointer p-0.5 shrink-0"
                />
                <input
                  type="text"
                  data-testid="add-color-token-value"
                  value={newColorVal}
                  onChange={(e) => setNewColorVal(e.target.value)}
                  className="flex-1 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 font-mono"
                />
                <button
                  type="submit"
                  data-testid="add-color-token-btn"
                  className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer shadow-xs"
                >
                  Save
                </button>
              </div>
            </form>
          )}

          {/* Color Swatches Grid */}
          <div className="grid grid-cols-2 gap-1.5" data-testid="color-swatches-grid">
            {colors.map((token) => {
              const isSelected = selectedColorToken?.id === token.id;
              return (
                <div
                  key={token.id}
                  data-testid={`color-swatch-${token.id}`}
                  onClick={() => setSelectedColorToken(isSelected ? null : token)}
                  className={`flex items-center gap-2 p-1.5 rounded border transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                    style={{ backgroundColor: token.value }}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[11px] font-medium text-slate-700 truncate">{token.name}</span>
                    <span className="text-[9px] font-mono text-slate-400 truncate">{token.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Apply Actions for Selected Color */}
          {selectedColorToken && (
            <div className="flex flex-col gap-1.5 p-2 bg-blue-50/60 rounded border border-blue-200 animate-fadeIn" data-testid="color-apply-actions">
              <span className="text-[10px] font-semibold text-blue-800 uppercase tracking-wide">
                Apply "{selectedColorToken.name}" to:
              </span>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  data-testid={`token-apply-bg-${selectedColorToken.id}`}
                  onClick={() => handleApplyColor('backgroundColor', selectedColorToken.value)}
                  className="py-1 text-[10px] font-medium bg-white text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  Background
                </button>
                <button
                  type="button"
                  data-testid={`token-apply-color-${selectedColorToken.id}`}
                  onClick={() => handleApplyColor('color', selectedColorToken.value)}
                  className="py-1 text-[10px] font-medium bg-white text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  Text Color
                </button>
                <button
                  type="button"
                  data-testid={`token-apply-border-${selectedColorToken.id}`}
                  onClick={() => handleApplyColor('borderColor', selectedColorToken.value)}
                  className="py-1 text-[10px] font-medium bg-white text-slate-700 hover:bg-slate-100 hover:text-blue-600 rounded border border-slate-200 shadow-2xs transition cursor-pointer"
                >
                  Border
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Typography Tab */}
      {activeTab === 'typography' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">Typography Presets</span>
            <button
              type="button"
              data-testid="toggle-add-typography-token"
              onClick={() => setIsAddingTypo(!isAddingTypo)}
              className="text-[10px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              {isAddingTypo ? 'Cancel' : '+ Add Preset'}
            </button>
          </div>

          {/* New typography preset form */}
          {isAddingTypo && (
            <form onSubmit={handleCreateTypography} className="flex flex-col gap-2 p-2 bg-slate-50 rounded border border-slate-200 shadow-2xs">
              <input
                type="text"
                data-testid="add-typography-token-name"
                placeholder="Preset name (e.g. Hero Title)"
                value={newTypoName}
                onChange={(e) => setNewTypoName(e.target.value)}
                className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder="Font Family"
                  value={newTypoFont}
                  onChange={(e) => setNewTypoFont(e.target.value)}
                  className="text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono"
                />
                <input
                  type="text"
                  placeholder="Font Size (e.g. 18px)"
                  value={newTypoSize}
                  onChange={(e) => setNewTypoSize(e.target.value)}
                  className="text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono"
                />
                <input
                  type="text"
                  placeholder="Weight (e.g. 700)"
                  value={newTypoWeight}
                  onChange={(e) => setNewTypoWeight(e.target.value)}
                  className="text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono"
                />
                <input
                  type="text"
                  placeholder="Line Height (e.g. 1.4)"
                  value={newTypoLineHeight}
                  onChange={(e) => setNewTypoLineHeight(e.target.value)}
                  className="text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono"
                />
              </div>
              <button
                type="submit"
                data-testid="add-typography-token-btn"
                className="w-full py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer shadow-xs"
              >
                Save Preset
              </button>
            </form>
          )}

          {/* Typography Presets List */}
          <div className="flex flex-col gap-1.5" data-testid="typography-presets-list">
            {typography.map((token) => (
              <button
                key={token.id}
                type="button"
                data-testid={`typography-preset-${token.id}`}
                onClick={() => handleApplyTypographyPreset(token)}
                className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-400 transition cursor-pointer text-left shadow-2xs"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-800 truncate">{token.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {token.fontSize} / {token.fontWeight} / {token.lineHeight}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                  Apply
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
