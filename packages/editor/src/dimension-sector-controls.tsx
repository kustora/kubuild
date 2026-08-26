import React, { useState, useEffect, useRef } from 'react';

export const DIMENSION_UNITS = ['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none'] as const;
export type DimensionUnit = (typeof DIMENSION_UNITS)[number];

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
}

export const DimensionUnitInput: React.FC<DimensionUnitInputProps> = ({
  property,
  label,
  value,
  onChange,
  allowedUnits = ['px', '%', 'rem', 'em', 'vw', 'vh', 'auto'],
  placeholder = 'auto',
  disabled = false,
}) => {
  const parsed = parseDimensionValue(value);
  const [num, setNum] = useState(parsed.num);
  const [unit, setUnit] = useState<DimensionUnit>(parsed.unit);
  const isSpecialValue = unit === 'auto' || unit === 'none' || num === 'auto' || num === 'none';

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

    const currentUnit = unit === 'auto' || unit === 'none' ? 'px' : unit;
    if (unit === 'auto' || unit === 'none') {
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

    if (num === 'auto' || num === 'none' || num.trim() === '') {
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

  return (
    <div className="flex flex-col">
      <label className="block text-[11px] font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center rounded border border-slate-300 bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden shadow-2xs">
        <input
          type={isSpecialValue ? 'text' : 'number'}
          data-testid={`dimension-input-${property}`}
          aria-label={label}
          value={num}
          placeholder={placeholder}
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
}

export const DimensionSectorControls: React.FC<DimensionSectorControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="dimension-sector-controls">
      {/* Display & Overflow */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Display</label>
          <select
            data-testid="dimension-select-display"
            aria-label="Display"
            value={String(styles.display ?? 'block')}
            disabled={disabled}
            onChange={(e) => onChange('display', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="block">Block</option>
            <option value="flex">Flex</option>
            <option value="inline-flex">Inline Flex</option>
            <option value="inline-block">Inline Block</option>
            <option value="inline">Inline</option>
            <option value="grid">Grid</option>
            <option value="inline-grid">Inline Grid</option>
            <option value="none">None</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Overflow</label>
          <select
            data-testid="dimension-select-overflow"
            aria-label="Overflow"
            value={String(styles.overflow ?? 'visible')}
            disabled={disabled}
            onChange={(e) => onChange('overflow', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer hover:border-slate-400 transition"
          >
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="scroll">Scroll</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>

      {/* Width & Height */}
      <div className="grid grid-cols-2 gap-2">
        <DimensionUnitInput
          property="width"
          label="Width"
          value={styles.width}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto']}
          placeholder="auto"
          disabled={disabled}
        />
        <DimensionUnitInput
          property="height"
          label="Height"
          value={styles.height}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto']}
          placeholder="auto"
          disabled={disabled}
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
        />
        <DimensionUnitInput
          property="maxWidth"
          label="Max Width"
          value={styles.maxWidth}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="none"
          disabled={disabled}
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
        />
        <DimensionUnitInput
          property="maxHeight"
          label="Max Height"
          value={styles.maxHeight}
          onChange={onChange}
          allowedUnits={['px', '%', 'rem', 'em', 'vw', 'vh', 'auto', 'none']}
          placeholder="none"
          disabled={disabled}
        />
      </div>
    </div>
  );
};
