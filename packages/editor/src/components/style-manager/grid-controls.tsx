import React, { useState, useEffect } from 'react';

export const GRID_COLUMN_PRESETS = [2, 3, 4, 6, 12] as const;

export function parseGridColumns(templateColumns: unknown): number {
  if (!templateColumns || typeof templateColumns !== 'string') return 1;
  const str = templateColumns.trim();
  // Match repeat(N, ...)
  const repeatMatch = str.match(/repeat\(\s*(\d+)\s*,/i);
  if (repeatMatch) {
    return parseInt(repeatMatch[1], 10) || 1;
  }
  // Count fr/px tokens
  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && !tokens.some((t) => t.includes('('))) {
    return Math.min(Math.max(tokens.length, 1), 12);
  }
  return 1;
}

export function parseSpan(val: unknown, fallback: number = 1): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const match = str.match(/(?:span\s+)?(\d+)/i);
  if (match) {
    return parseInt(match[1], 10) || fallback;
  }
  return fallback;
}

export interface GridControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const GridControls: React.FC<GridControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  const currentColumnsStr = String(styles.gridTemplateColumns ?? 'repeat(2, minmax(0, 1fr))');
  const [columnsInput, setColumnsInput] = useState(currentColumnsStr);
  const currentColumnsCount = parseGridColumns(styles.gridTemplateColumns);

  useEffect(() => {
    setColumnsInput(String(styles.gridTemplateColumns ?? ''));
  }, [styles.gridTemplateColumns]);

  const handleSliderChange = (cols: number) => {
    const nextVal = `repeat(${cols}, minmax(0, 1fr))`;
    setColumnsInput(nextVal);
    onChange('gridTemplateColumns', nextVal);
  };

  const handlePresetClick = (cols: number) => {
    const nextVal = `repeat(${cols}, minmax(0, 1fr))`;
    setColumnsInput(nextVal);
    onChange('gridTemplateColumns', nextVal);
  };

  const handleColumnsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setColumnsInput(val);
    onChange('gridTemplateColumns', val);
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="grid-controls">
      {/* Column Slider & Count Display */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-600">Columns (1–12)</label>
          <span className="text-[11px] font-bold font-mono text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
            {currentColumnsCount} {currentColumnsCount === 1 ? 'col' : 'cols'}
          </span>
        </div>
        <input
          type="range"
          data-testid="grid-columns-slider"
          min={1}
          max={12}
          step={1}
          value={currentColumnsCount}
          disabled={disabled}
          onChange={(e) => handleSliderChange(parseInt(e.target.value, 10) || 1)}
          className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>

      {/* Column Presets */}
      <div className="flex flex-col gap-1.5">
        <label className="block text-[11px] font-medium text-slate-600">Column Presets</label>
        <div className="grid grid-cols-5 gap-1">
          {GRID_COLUMN_PRESETS.map((preset) => {
            const isActive = currentColumnsCount === preset;
            return (
              <button
                key={preset}
                type="button"
                data-testid={`grid-preset-${preset}`}
                disabled={disabled}
                onClick={() => handlePresetClick(preset)}
                className={`py-1 text-xs font-semibold rounded border transition cursor-pointer text-center ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                {preset}c
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Grid Track Builder Preview */}
      <div className="flex flex-col gap-1">
        <label className="block text-[11px] font-medium text-slate-600">Track Preview</label>
        <div
          data-testid="grid-track-preview"
          className="grid gap-1 p-2 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden shadow-2xs"
          style={{ gridTemplateColumns: `repeat(${Math.min(currentColumnsCount, 12)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: Math.min(currentColumnsCount, 12) }).map((_, idx) => (
            <div
              key={idx}
              className="h-8 bg-white border border-blue-300 rounded flex items-center justify-center text-[10px] font-mono text-blue-700 font-semibold shadow-2xs"
            >
              {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Custom fr/px Track String Editor */}
      <div className="flex flex-col gap-1">
        <label className="block text-[11px] font-medium text-slate-600">Custom Track String</label>
        <input
          type="text"
          data-testid="grid-template-columns-input"
          placeholder="e.g. repeat(3, 1fr) or 1fr 2fr 1fr"
          value={columnsInput}
          disabled={disabled}
          onChange={handleColumnsInputChange}
          className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
        />
      </div>

      {/* Row Gap and Column Gap Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Row Gap</label>
          <input
            type="text"
            data-testid="grid-row-gap"
            placeholder="0px / 1rem"
            value={String(styles.rowGap ?? styles.gap ?? '')}
            disabled={disabled}
            onChange={(e) => onChange('rowGap', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Column Gap</label>
          <input
            type="text"
            data-testid="grid-col-gap"
            placeholder="0px / 1rem"
            value={String(styles.columnGap ?? styles.gap ?? '')}
            disabled={disabled}
            onChange={(e) => onChange('columnGap', e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono shadow-2xs"
          />
        </div>
      </div>

      {/* Grid Auto Flow */}
      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">Auto Flow</label>
        <select
          data-testid="grid-auto-flow"
          value={String(styles.gridAutoFlow ?? 'row')}
          disabled={disabled}
          onChange={(e) => onChange('gridAutoFlow', e.target.value)}
          className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
        >
          <option value="row">Row</option>
          <option value="column">Column</option>
          <option value="dense">Dense</option>
          <option value="row dense">Row Dense</option>
          <option value="column dense">Column Dense</option>
        </select>
      </div>
    </div>
  );
};

export interface GridItemControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const GridItemControls: React.FC<GridItemControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  const currentColSpan = parseSpan(styles.colSpan ?? styles.gridColumn, 1);
  const currentRowSpan = parseSpan(styles.rowSpan ?? styles.gridRow, 1);

  const handleColSpanChange = (span: number) => {
    onChange('colSpan', String(span));
    onChange('gridColumn', `span ${span}`);
  };

  const handleRowSpanChange = (span: number) => {
    onChange('rowSpan', String(span));
    onChange('gridRow', `span ${span}`);
  };

  return (
    <div className={`flex flex-col gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 ${className}`} data-testid="grid-item-controls">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
          Grid Child Placement (Span)
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          col {currentColSpan} / row {currentRowSpan}
        </span>
      </div>

      {/* Column Span (1–12) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-slate-600">Column Span (1–12)</label>
          <span className="text-[11px] font-bold font-mono text-blue-600">span {currentColSpan}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            data-testid="grid-item-col-span-slider"
            min={1}
            max={12}
            step={1}
            value={currentColSpan}
            disabled={disabled}
            onChange={(e) => handleColSpanChange(parseInt(e.target.value, 10) || 1)}
            className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <select
            data-testid="grid-item-col-span"
            value={currentColSpan}
            disabled={disabled}
            onChange={(e) => handleColSpanChange(parseInt(e.target.value, 10) || 1)}
            className="w-20 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                span {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row Span (1–6) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-slate-600">Row Span (1–6)</label>
          <span className="text-[11px] font-bold font-mono text-blue-600">span {currentRowSpan}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            data-testid="grid-item-row-span-slider"
            min={1}
            max={6}
            step={1}
            value={currentRowSpan}
            disabled={disabled}
            onChange={(e) => handleRowSpanChange(parseInt(e.target.value, 10) || 1)}
            className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <select
            data-testid="grid-item-row-span"
            value={currentRowSpan}
            disabled={disabled}
            onChange={(e) => handleRowSpanChange(parseInt(e.target.value, 10) || 1)}
            className="w-20 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                span {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
