import React, { useState, useEffect, useRef } from 'react';
import { InheritanceIndicator, Breakpoint } from './inheritance-indicator';
import { useTranslation } from '../../i18n';

export const DIMENSION_UNITS = ['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none', 'fit-content'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

export type SizingMode = 'hug' | 'fill' | 'fixed';

export function getWidthSizingMode(width: unknown, flex?: unknown): SizingMode {
  const flexStr = String(flex ?? '').trim().toLowerCase();
  if (flexStr.includes('1 1') || flexStr === '1') {
    return 'fill';
  }
  const str = String(width ?? '').trim().toLowerCase();
  if (str === '100%') {
    return 'fill';
  }
  if (str === 'fit-content' || str === 'auto' || str === 'max-content') {
    return 'hug';
  }
  return 'fixed';
}

export function getHeightSizingMode(height: unknown): SizingMode {
  const str = String(height ?? '').trim().toLowerCase();
  if (str === 'fit-content' || str === 'auto' || str === 'max-content') {
    return 'hug';
  }
  if (str === '100%') {
    return 'fill';
  }
  return 'fixed';
}

export interface ParsedDimension {
  num: string;
  unit: DimensionUnit;
  raw: string;
}

export function parseDimensionValue(
  val: unknown,
  defaultUnit: DimensionUnit = 'px',
): ParsedDimension {
  if (val === undefined || val === null || val === '') {
    return { num: '', unit: defaultUnit, raw: '' };
  }
  if (typeof val === 'number') {
    return { num: String(val), unit: 'px', raw: `${val}px` };
  }
  const str = String(val).trim();
  if (str.toLowerCase() === 'auto') {
    return { num: 'auto', unit: 'auto', raw: 'auto' };
  }
  if (str.toLowerCase() === 'none') {
    return { num: 'none', unit: 'none', raw: 'none' };
  }
  if (str.toLowerCase() === 'fit-content') {
    return { num: 'fit-content', unit: 'fit-content', raw: 'fit-content' };
  }
  const match = str.match(/^(-?\d*\.?\d+)\s*(px|%|rem|em|vw|vh)?$/i);
  if (match) {
    const unitMatch = (match[2]?.toLowerCase() || defaultUnit) as DimensionUnit;
    return {
      num: match[1],
      unit: (DIMENSION_UNITS as readonly string[]).includes(unitMatch) ? unitMatch : defaultUnit,
      raw: str,
    };
  }
  return { num: str, unit: defaultUnit, raw: str };
}

export interface DimensionUnitInputProps {
  property: string;
  label: string;
  value: unknown;
  onChange: (property: string, value: string) => void;
  allowedUnits?: DimensionUnit[];
  placeholder?: string;
  disabled?: boolean;
  baseStyles?: Record<string, unknown>;
  activeStyles?: Record<string, unknown>;
  breakpoint?: Breakpoint;
  onResetToInherited?: (property: string) => void;
}

export const DimensionUnitInput: React.FC<DimensionUnitInputProps> = ({
  property,
  label,
  value,
  onChange,
  allowedUnits = ['px', '%', 'rem', 'em', 'vw', 'vh', 'auto'],
  placeholder = 'auto',
  disabled = false,
  baseStyles,
  activeStyles,
  breakpoint,
  onResetToInherited,
}) => {
  const parsed = parseDimensionValue(value);
  const [num, setNum] = useState(parsed.num);
  const [unit, setUnit] = useState<DimensionUnit>(parsed.unit);
  const isSpecialValue =
    unit === 'auto' || unit === 'none' || unit === 'fit-content' || num === 'auto' || num === 'none' || num === 'fit-content';

  useEffect(() => {
    const next = parseDimensionValue(value);
    setNum(next.num);
    setUnit(next.unit);
  }, [value]);

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setNum(rawVal);

    const trimmed = rawVal.trim();
    if (trimmed === '') {
      onChange(property, '');
      return;
    }
    if (trimmed.toLowerCase() === 'auto' && allowedUnits.includes('auto')) {
      setUnit('auto');
      onChange(property, 'auto');
      return;
    }
    if (trimmed.toLowerCase() === 'none' && allowedUnits.includes('none')) {
      setUnit('none');
      onChange(property, 'none');
      return;
    }
    if (trimmed.toLowerCase() === 'fit-content') {
      setUnit('fit-content');
      onChange(property, 'fit-content');
      return;
    }

    // Check if user typed dimension like 100% or 2.5rem
    const match = trimmed.match(/^(-?\d*\.?\d+)\s*(px|%|rem|em|vw|vh)$/i);
    if (match) {
      const typedUnit = match[2].toLowerCase() as DimensionUnit;
      if (allowedUnits.includes(typedUnit)) {
        setUnit(typedUnit);
        onChange(property, `${match[1]}${typedUnit}`);
        return;
      }
    }

    const currentUnit = unit === 'auto' || unit === 'none' || unit === 'fit-content' ? 'px' : unit;
    if (unit === 'auto' || unit === 'none' || unit === 'fit-content') {
      setUnit('px');
    }
    onChange(property, `${trimmed}${currentUnit}`);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextUnit = e.target.value as DimensionUnit;
    setUnit(nextUnit);

    if (nextUnit === 'auto') {
      setNum('auto');
      onChange(property, 'auto');
      return;
    }
    if (nextUnit === 'none') {
      setNum('none');
      onChange(property, 'none');
      return;
    }
    if (nextUnit === 'fit-content') {
      setNum('fit-content');
      onChange(property, 'fit-content');
      return;
    }

    if (num === 'auto' || num === 'none' || num === 'fit-content' || num.trim() === '') {
      setNum('');
      onChange(property, '');
      return;
    }

    onChange(property, `${num.trim()}${nextUnit}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (isSpecialValue) return;
      const currentNum = Number(num) || 0;
      const step = e.shiftKey ? 10 : 1;
      const nextNum = e.key === 'ArrowUp' ? currentNum + step : Math.max(0, currentNum - step);
      const strVal = String(nextNum);
      setNum(strVal);
      onChange(property, `${strVal}${unit}`);
    }
  };

  const isInherited =
    breakpoint &&
    breakpoint !== 'base' &&
    breakpoint !== 'desktop' &&
    (value === undefined || value === null || value === '') &&
    baseStyles?.[property] !== undefined &&
    baseStyles?.[property] !== '';

  const effectivePlaceholder =
    placeholder !== undefined && placeholder !== 'auto'
      ? placeholder
      : isInherited
        ? `${String(baseStyles?.[property])}`
        : placeholder;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-1 mb-1">
        <label className="block text-[11px] font-medium text-slate-600">{label}</label>
        {breakpoint && (
          <InheritanceIndicator
            property={property}
            activeBreakpoint={breakpoint}
            activeStyles={activeStyles ?? (value !== undefined && value !== null && value !== '' ? { [property]: value } : {})}
            baseStyles={baseStyles}
            onResetToInherited={onResetToInherited}
            compact
          />
        )}
      </div>
      <div className="flex items-center rounded border border-slate-300 bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden shadow-2xs">
        <input
          type={isSpecialValue ? 'text' : 'number'}
          data-testid={`dimension-input-${property}`}
          aria-label={label}
          value={num}
          placeholder={effectivePlaceholder}
          disabled={disabled}
          onChange={handleNumChange}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 text-xs bg-white text-slate-900 px-2 py-1 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono"
        />
        <select
          data-testid={`dimension-unit-${property}`}
          aria-label={`${label} Unit`}
          value={unit}
          disabled={disabled}
          onChange={handleUnitChange}
          className="shrink-0 text-[11px] bg-slate-100 text-slate-700 font-medium px-1.5 py-1 border-l border-slate-200 focus:outline-none cursor-pointer hover:bg-slate-200 transition"
        >
          {allowedUnits.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export interface DimensionSectorControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
  baseStyles?: Record<string, unknown>;
  breakpoint?: Breakpoint;
  onResetProperty?: (property: string) => void;
}

export const DimensionSectorControls: React.FC<DimensionSectorControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
  baseStyles,
  breakpoint,
  onResetProperty,
}) => {
  const { t } = useTranslation();

  const widthMode = getWidthSizingMode(styles.width, styles.flex);
  const heightMode = getHeightSizingMode(styles.height);

  const handleWidthModeSelect = (mode: SizingMode) => {
    if (mode === 'hug') {
      onChange('width', 'fit-content');
      onChange('flex', '0 0 auto');
    } else if (mode === 'fill') {
      onChange('width', '100%');
      onChange('flex', '1 1 0%');
    } else {
      // Fixed
      const currentVal = String(styles.width ?? '');
      if (currentVal === 'fit-content' || currentVal === '100%' || currentVal === 'auto' || !currentVal) {
        onChange('width', '200px');
      }
      onChange('flex', '');
    }
  };

  const handleHeightModeSelect = (mode: SizingMode) => {
    if (mode === 'hug') {
      onChange('height', 'fit-content');
    } else if (mode === 'fill') {
      onChange('height', '100%');
    } else {
      // Fixed
      const currentVal = String(styles.height ?? '');
      if (currentVal === 'fit-content' || currentVal === '100%' || currentVal === 'auto' || !currentVal) {
        onChange('height', '100px');
      }
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="dimension-sector-controls">
      {/* Display & Overflow */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="dimension-select-display"
            title={t.displayTooltip}
            className="block text-[11px] font-medium text-slate-600 mb-1 cursor-help"
          >
            {t.display}
          </label>
          <select
            id="dimension-select-display"
            data-testid="dimension-select-display"
            aria-label="Display"
            value={String(styles.display ?? 'block')}
            disabled={disabled}
            onChange={(e) => onChange('display', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="block">{t.displayBlock}</option>
            <option value="flex">{t.displayFlex}</option>
            <option value="inline-flex">{t.displayInlineFlex}</option>
            <option value="inline-block">{t.displayInlineBlock}</option>
            <option value="inline">{t.displayInline}</option>
            <option value="grid">{t.displayGrid}</option>
            <option value="inline-grid">{t.displayInlineGrid}</option>
            <option value="none">{t.displayNone}</option>
          </select>
        </div>
        <div>
          <label
            htmlFor="dimension-select-overflow"
            title={t.overflowTooltip}
            className="block text-[11px] font-medium text-slate-600 mb-1 cursor-help"
          >
            {t.overflow}
          </label>
          <select
            id="dimension-select-overflow"
            data-testid="dimension-select-overflow"
            aria-label="Overflow"
            value={String(styles.overflow ?? 'visible')}
            disabled={disabled}
            onChange={(e) => onChange('overflow', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="visible">{t.overflowVisible}</option>
            <option value="hidden">{t.overflowHidden}</option>
            <option value="scroll">{t.overflowScroll}</option>
            <option value="auto">{t.overflowAuto}</option>
          </select>
        </div>
      </div>

      {/* Object Fit & Position — how a replaced element (image/video) fills its own box.
          Only meaningful once the element has a size, so it sits next to the sizing controls. */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Object Fit</label>
          <select
            data-testid="dimension-select-object-fit"
            aria-label="Object Fit"
            value={String(styles.objectFit ?? '')}
            disabled={disabled}
            onChange={(e) => onChange('objectFit', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="">Default (fill)</option>
            <option value="contain">Contain</option>
            <option value="cover">Cover</option>
            <option value="fill">Fill</option>
            <option value="none">None</option>
            <option value="scale-down">Scale Down</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Object Position</label>
          <select
            data-testid="dimension-select-object-position"
            aria-label="Object Position"
            value={String(styles.objectPosition ?? '')}
            disabled={disabled}
            onChange={(e) => onChange('objectPosition', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="">Default (center)</option>
            <option value="top left">Top Left</option>
            <option value="top">Top</option>
            <option value="top right">Top Right</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="bottom left">Bottom Left</option>
            <option value="bottom">Bottom</option>
            <option value="bottom right">Bottom Right</option>
          </select>
        </div>
      </div>

      {/* Sizing Mode Controls (Hug / Fill / Fixed) - STORA-104 */}
      <div className="flex flex-col gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          {t.sizingModes}
        </div>

        {/* Width Sizing Mode */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">{t.widthMode}</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">{widthMode}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-0.5 rounded border border-slate-200 shadow-2xs">
            <button
              type="button"
              data-testid="sizing-mode-width-hug"
              disabled={disabled}
              onClick={() => handleWidthModeSelect('hug')}
              title={t.hugTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                widthMode === 'hug'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.hug}</span>
              {t.hugSub ? <span className="block text-[9px] opacity-75 font-normal">{t.hugSub}</span> : null}
            </button>
            <button
              type="button"
              data-testid="sizing-mode-width-fill"
              disabled={disabled}
              onClick={() => handleWidthModeSelect('fill')}
              title={t.fillTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                widthMode === 'fill'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.fill}</span>
              {t.fillSub ? <span className="block text-[9px] opacity-75 font-normal">{t.fillSub}</span> : null}
            </button>
            <button
              type="button"
              data-testid="sizing-mode-width-fixed"
              disabled={disabled}
              onClick={() => handleWidthModeSelect('fixed')}
              title={t.fixedTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                widthMode === 'fixed'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.fixed}</span>
              {t.fixedSub ? <span className="block text-[9px] opacity-75 font-normal">{t.fixedSub}</span> : null}
            </button>
          </div>
        </div>

        {/* Height Sizing Mode */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-600">{t.heightMode}</span>
            <span className="text-[10px] font-mono text-slate-400 uppercase">{heightMode}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-0.5 rounded border border-slate-200 shadow-2xs">
            <button
              type="button"
              data-testid="sizing-mode-height-hug"
              disabled={disabled}
              onClick={() => handleHeightModeSelect('hug')}
              title={t.hugTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                heightMode === 'hug'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.hug}</span>
              {t.hugSub ? <span className="block text-[9px] opacity-75 font-normal">{t.hugSub}</span> : null}
            </button>
            <button
              type="button"
              data-testid="sizing-mode-height-fill"
              disabled={disabled}
              onClick={() => handleHeightModeSelect('fill')}
              title={t.fillTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                heightMode === 'fill'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.fill}</span>
              {t.fillSub ? <span className="block text-[9px] opacity-75 font-normal">{t.fillSub}</span> : null}
            </button>
            <button
              type="button"
              data-testid="sizing-mode-height-fixed"
              disabled={disabled}
              onClick={() => handleHeightModeSelect('fixed')}
              title={t.fixedTooltip}
              className={`py-1.5 px-1 text-xs rounded font-medium transition cursor-pointer text-center leading-tight ${
                heightMode === 'fixed'
                  ? 'bg-white text-blue-600 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="block font-semibold">{t.fixed}</span>
              {t.fixedSub ? <span className="block text-[9px] opacity-75 font-normal">{t.fixedSub}</span> : null}
            </button>
          </div>
        </div>
      </div>

      {/* Width & Height Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="width"
          label="Width"
          value={styles.width}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto']}
          placeholder="auto"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
        <DimensionUnitInput
          property="height"
          label="Height"
          value={styles.height}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto']}
          placeholder="auto"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
      </div>

      {/* Min Width & Max Width */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="minWidth"
          label="Min Width"
          value={styles.minWidth}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="auto"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
        <DimensionUnitInput
          property="maxWidth"
          label="Max Width"
          value={styles.maxWidth}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="none"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
      </div>

      {/* Min Height & Max Height */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="minHeight"
          label="Min Height"
          value={styles.minHeight}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="auto"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
        <DimensionUnitInput
          property="maxHeight"
          label="Max Height"
          value={styles.maxHeight}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="none"
          disabled={disabled}
          baseStyles={baseStyles}
          activeStyles={styles}
          breakpoint={breakpoint}
          onResetToInherited={onResetProperty}
        />
      </div>
    </div>
  );
};
