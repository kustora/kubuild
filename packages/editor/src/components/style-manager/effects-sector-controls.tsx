import React, { useState, useEffect } from 'react';

// ============================================================================
// STORA-150: Independent 4-Corner Border Radius Control
// ============================================================================

export interface BorderRadiusControlProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const BorderRadiusControl: React.FC<BorderRadiusControlProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  const hasIndividualCorners = Boolean(
    styles.borderTopLeftRadius ||
    styles.borderTopRightRadius ||
    styles.borderBottomRightRadius ||
    styles.borderBottomLeftRadius
  );

  const [isExpanded, setIsExpanded] = useState<boolean>(hasIndividualCorners);

  const unifiedRadius = String(styles.borderRadius ?? '');

  const handleUnifiedChange = (val: string) => {
    onChange('borderRadius', val);
  };

  const handleCornerChange = (corner: string, val: string) => {
    onChange(corner, val);
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`} data-testid="border-radius-control">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-medium text-slate-600">Border Radius</label>
        <button
          type="button"
          data-testid="border-radius-expand"
          title={isExpanded ? 'Switch to unified radius' : 'Switch to independent 4 corners'}
          disabled={disabled}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition cursor-pointer ${
            isExpanded
              ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {isExpanded ? 'Unified' : '4 Corners'}
        </button>
      </div>

      {!isExpanded ? (
        // Unified radius input
        <div className="flex items-center rounded border border-slate-300 bg-white shadow-2xs">
          <input
            type="text"
            data-testid="border-radius-unified"
            placeholder="0px"
            value={unifiedRadius}
            disabled={disabled}
            onChange={(e) => handleUnifiedChange(e.target.value)}
            className="w-full text-xs bg-white text-slate-900 px-2 py-1 focus:outline-none font-mono"
          />
        </div>
      ) : (
        // 4 Individual Corner Inputs in a 2x2 grid
        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200" data-testid="border-radius-corners-grid">
          {/* Top-Left */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <span>◸</span>
              <span>Top Left</span>
            </div>
            <input
              type="text"
              data-testid="border-radius-top-left"
              placeholder="0px"
              value={String(styles.borderTopLeftRadius ?? '')}
              disabled={disabled}
              onChange={(e) => handleCornerChange('borderTopLeftRadius', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
            />
          </div>

          {/* Top-Right */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <span>◹</span>
              <span>Top Right</span>
            </div>
            <input
              type="text"
              data-testid="border-radius-top-right"
              placeholder="0px"
              value={String(styles.borderTopRightRadius ?? '')}
              disabled={disabled}
              onChange={(e) => handleCornerChange('borderTopRightRadius', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
            />
          </div>

          {/* Bottom-Left */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <span>◺</span>
              <span>Bottom Left</span>
            </div>
            <input
              type="text"
              data-testid="border-radius-bottom-left"
              placeholder="0px"
              value={String(styles.borderBottomLeftRadius ?? '')}
              disabled={disabled}
              onChange={(e) => handleCornerChange('borderBottomLeftRadius', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
            />
          </div>

          {/* Bottom-Right */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
              <span>◿</span>
              <span>Bottom Right</span>
            </div>
            <input
              type="text"
              data-testid="border-radius-bottom-right"
              placeholder="0px"
              value={String(styles.borderBottomRightRadius ?? '')}
              disabled={disabled}
              onChange={(e) => handleCornerChange('borderBottomRightRadius', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STORA-152: Box Shadow & Blur Effects Controls
// ============================================================================

export interface ParsedBoxShadow {
  inset: boolean;
  offsetX: string;
  offsetY: string;
  blur: string;
  spread: string;
  color: string;
}

export function parseBoxShadow(raw: unknown): ParsedBoxShadow {
  const fallback: ParsedBoxShadow = {
    inset: false,
    offsetX: '0px',
    offsetY: '4px',
    blur: '6px',
    spread: '0px',
    color: 'rgba(0, 0, 0, 0.1)',
  };

  if (!raw || typeof raw !== 'string' || raw.trim() === '' || raw.trim() === 'none') {
    return fallback;
  }

  const str = raw.trim();
  const isInset = str.toLowerCase().includes('inset');
  const cleanStr = str.replace(/inset/gi, '').trim();

  // Extract color part (rgba(...) / hsla(...) / #hex / named color)
  let color = fallback.color;
  let remaining = cleanStr;

  const colorMatch = cleanStr.match(/(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+$)/);
  if (colorMatch) {
    color = colorMatch[0];
    remaining = cleanStr.replace(color, '').trim();
  }

  // Extract dimensions
  const dims = remaining.split(/\s+/).filter(Boolean);
  return {
    inset: isInset,
    offsetX: dims[0] ?? fallback.offsetX,
    offsetY: dims[1] ?? fallback.offsetY,
    blur: dims[2] ?? fallback.blur,
    spread: dims[3] ?? fallback.spread,
    color: color || fallback.color,
  };
}

export function serializeBoxShadow(parsed: ParsedBoxShadow): string {
  const parts = [
    parsed.offsetX || '0px',
    parsed.offsetY || '0px',
    parsed.blur || '0px',
    parsed.spread || '0px',
    parsed.color || 'rgba(0, 0, 0, 0.1)',
  ];
  if (parsed.inset) {
    return `inset ${parts.join(' ')}`;
  }
  return parts.join(' ');
}

export function parseBackdropBlur(raw: unknown): number {
  if (!raw || typeof raw !== 'string') return 0;
  const match = raw.match(/blur\(\s*(\d*\.?\d+)\s*px\s*\)/i);
  return match ? parseFloat(match[1]) || 0 : 0;
}

export const SHADOW_PRESETS = [
  { id: 'none', label: 'None', value: 'none' },
  { id: 'sm', label: 'Small', value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' },
  { id: 'md', label: 'Medium', value: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
  { id: 'lg', label: 'Large', value: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' },
  { id: 'xl', label: 'XL', value: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' },
  { id: 'inner', label: 'Inner', value: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)' },
] as const;

export interface EffectsSectorControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const EffectsSectorControls: React.FC<EffectsSectorControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  const currentShadow = parseBoxShadow(styles.boxShadow);
  const currentBlur = parseBackdropBlur(styles.backdropFilter);

  const handleShadowParamChange = (key: keyof ParsedBoxShadow, val: unknown) => {
    const updated = { ...currentShadow, [key]: val };
    onChange('boxShadow', serializeBoxShadow(updated));
  };

  const handleShadowPreset = (presetValue: string) => {
    onChange('boxShadow', presetValue);
  };

  const handleBlurChange = (px: number) => {
    if (px <= 0) {
      onChange('backdropFilter', 'none');
    } else {
      onChange('backdropFilter', `blur(${px}px)`);
    }
  };

  return (
    <div className={`flex flex-col gap-3.5 ${className}`} data-testid="effects-sector-controls">
      {/* 4-Corner Independent Border Radius */}
      <BorderRadiusControl styles={styles} onChange={onChange} disabled={disabled} />

      {/* Box Shadow & Inner Shadow Controls */}
      <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-600">Shadow Effects</label>
          <button
            type="button"
            data-testid="shadow-inset-toggle"
            disabled={disabled}
            onClick={() => handleShadowParamChange('inset', !currentShadow.inset)}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition cursor-pointer ${
              currentShadow.inset
                ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {currentShadow.inset ? 'Inner Shadow' : 'Drop Shadow'}
          </button>
        </div>

        {/* Shadow Presets */}
        <div className="grid grid-cols-6 gap-1">
          {SHADOW_PRESETS.map((p) => {
            const isActive = String(styles.boxShadow ?? '').trim() === p.value;
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`shadow-preset-${p.id}`}
                disabled={disabled}
                onClick={() => handleShadowPreset(p.value)}
                className={`py-1 text-[10px] rounded border transition cursor-pointer text-center font-medium ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Detailed Shadow Inputs (X, Y, Blur, Spread) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">X Offset</label>
            <input
              type="text"
              data-testid="shadow-offset-x"
              placeholder="0px"
              value={currentShadow.offsetX}
              disabled={disabled}
              onChange={(e) => handleShadowParamChange('offsetX', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Y Offset</label>
            <input
              type="text"
              data-testid="shadow-offset-y"
              placeholder="4px"
              value={currentShadow.offsetY}
              disabled={disabled}
              onChange={(e) => handleShadowParamChange('offsetY', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Blur</label>
            <input
              type="text"
              data-testid="shadow-blur"
              placeholder="6px"
              value={currentShadow.blur}
              disabled={disabled}
              onChange={(e) => handleShadowParamChange('blur', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono shadow-2xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Spread</label>
            <input
              type="text"
              data-testid="shadow-spread"
              placeholder="0px"
              value={currentShadow.spread}
              disabled={disabled}
              onChange={(e) => handleShadowParamChange('spread', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono shadow-2xs"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Shadow Color</label>
            <input
              type="text"
              data-testid="shadow-color"
              placeholder="rgba(0, 0, 0, 0.1)"
              value={currentShadow.color}
              disabled={disabled}
              onChange={(e) => handleShadowParamChange('color', e.target.value)}
              className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 font-mono shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Backdrop Blur (Glassmorphism) */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-600">
            Backdrop Blur (Glassmorphism)
          </label>
          <span className="text-[10px] font-mono text-slate-500 font-bold">{currentBlur}px</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            data-testid="backdrop-blur-slider"
            min={0}
            max={40}
            step={1}
            value={currentBlur}
            disabled={disabled}
            onChange={(e) => handleBlurChange(parseInt(e.target.value, 10) || 0)}
            className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex items-center rounded border border-slate-300 bg-white overflow-hidden shadow-2xs w-18 shrink-0">
            <input
              type="number"
              data-testid="backdrop-blur-input"
              min={0}
              max={40}
              value={currentBlur}
              disabled={disabled}
              onChange={(e) => handleBlurChange(parseInt(e.target.value, 10) || 0)}
              className="w-full text-xs bg-white text-slate-900 px-1.5 py-1 text-right focus:outline-none font-mono"
            />
            <span className="text-[11px] font-medium text-slate-500 px-1 bg-slate-100 border-l border-slate-200">
              px
            </span>
          </div>
        </div>

        {/* Backdrop blur presets */}
        <div className="flex items-center gap-1 mt-0.5">
          {[
            { label: 'None', px: 0 },
            { label: 'Subtle', px: 4 },
            { label: 'Glass', px: 12 },
            { label: 'Frosted', px: 24 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              data-testid={`backdrop-blur-preset-${preset.label.toLowerCase()}`}
              disabled={disabled}
              onClick={() => handleBlurChange(preset.px)}
              className={`px-1.5 py-0.5 text-[10px] rounded border transition cursor-pointer ${
                currentBlur === preset.px
                  ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
