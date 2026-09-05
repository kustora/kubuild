import React, { useState, useEffect } from 'react';

export type AlignmentPointId =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface AlignmentMapItem {
  justify: string;
  align: string;
}

export const ROW_ALIGNMENT_MAP: Record<AlignmentPointId, AlignmentMapItem> = {
  'top-left': { justify: 'flex-start', align: 'flex-start' },
  'top-center': { justify: 'center', align: 'flex-start' },
  'top-right': { justify: 'flex-end', align: 'flex-start' },
  'center-left': { justify: 'flex-start', align: 'center' },
  center: { justify: 'center', align: 'center' },
  'center-right': { justify: 'flex-end', align: 'center' },
  'bottom-left': { justify: 'flex-start', align: 'flex-end' },
  'bottom-center': { justify: 'center', align: 'flex-end' },
  'bottom-right': { justify: 'flex-end', align: 'flex-end' },
};

export const COLUMN_ALIGNMENT_MAP: Record<AlignmentPointId, AlignmentMapItem> = {
  'top-left': { justify: 'flex-start', align: 'flex-start' },
  'top-center': { justify: 'flex-start', align: 'center' },
  'top-right': { justify: 'flex-start', align: 'flex-end' },
  'center-left': { justify: 'center', align: 'flex-start' },
  center: { justify: 'center', align: 'center' },
  'center-right': { justify: 'center', align: 'flex-end' },
  'bottom-left': { justify: 'flex-end', align: 'flex-start' },
  'bottom-center': { justify: 'flex-end', align: 'center' },
  'bottom-right': { justify: 'flex-end', align: 'flex-end' },
};

export const ALIGNMENT_POINTS: { id: AlignmentPointId; label: string }[] = [
  { id: 'top-left', label: 'Top Left' },
  { id: 'top-center', label: 'Top Center' },
  { id: 'top-right', label: 'Top Right' },
  { id: 'center-left', label: 'Center Left' },
  { id: 'center', label: 'Center' },
  { id: 'center-right', label: 'Center Right' },
  { id: 'bottom-left', label: 'Bottom Left' },
  { id: 'bottom-center', label: 'Bottom Center' },
  { id: 'bottom-right', label: 'Bottom Right' },
];

function normalizeAlignment(val: unknown, fallback: string): string {
  if (!val || typeof val !== 'string') return fallback;
  const str = val.trim().toLowerCase();
  if (str === 'start') return 'flex-start';
  if (str === 'end') return 'flex-end';
  return str;
}

export function parseGap(gapVal: unknown): { value: number; unit: 'px' | 'rem' } {
  if (gapVal === undefined || gapVal === null || gapVal === '') {
    return { value: 0, unit: 'px' };
  }
  if (typeof gapVal === 'number') {
    return { value: gapVal, unit: 'px' };
  }
  const str = String(gapVal).trim();
  const match = str.match(/^(-?\d*\.?\d+)\s*(px|rem)?$/i);
  if (match) {
    const num = parseFloat(match[1]) || 0;
    const unit = (match[2]?.toLowerCase() === 'rem' ? 'rem' : 'px') as 'px' | 'rem';
    return { value: num, unit };
  }
  return { value: 0, unit: 'px' };
}

export interface AutoLayoutControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const AutoLayoutControls: React.FC<AutoLayoutControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
}) => {
  const direction = String(styles.flexDirection ?? 'row');
  const isColumn = direction === 'column' || direction === 'column-reverse';
  const isWrapped = styles.flexWrap === 'wrap' || styles.flexWrap === 'wrap-reverse';

  const currentJustify = normalizeAlignment(styles.justifyContent, 'flex-start');
  const currentAlign = normalizeAlignment(styles.alignItems, 'stretch');
  const isSpaceBetween = currentJustify === 'space-between';

  // Gap state
  const initialGap = parseGap(styles.gap);
  const [gapNum, setGapNum] = useState<number>(initialGap.value);
  const [gapUnit, setGapUnit] = useState<'px' | 'rem'>(initialGap.unit);

  useEffect(() => {
    const parsed = parseGap(styles.gap);
    setGapNum(parsed.value);
    setGapUnit(parsed.unit);
  }, [styles.gap]);

  const handleAlignmentClick = (pointId: AlignmentPointId) => {
    const map = isColumn ? COLUMN_ALIGNMENT_MAP[pointId] : ROW_ALIGNMENT_MAP[pointId];
    onChange('justifyContent', map.justify);
    onChange('alignItems', map.align);
  };

  const handleSpaceBetweenToggle = () => {
    if (isSpaceBetween) {
      onChange('justifyContent', 'flex-start');
    } else {
      onChange('justifyContent', 'space-between');
    }
  };

  const handleDirectionChange = (nextDir: 'row' | 'column') => {
    onChange('flexDirection', nextDir);
  };

  const handleWrapToggle = () => {
    onChange('flexWrap', isWrapped ? 'nowrap' : 'wrap');
  };

  const handleGapChange = (newVal: number, unit: 'px' | 'rem') => {
    setGapNum(newVal);
    setGapUnit(unit);
    onChange('gap', `${newVal}${unit}`);
  };

  const isPointActive = (pointId: AlignmentPointId): boolean => {
    if (isSpaceBetween) return false;
    const map = isColumn ? COLUMN_ALIGNMENT_MAP[pointId] : ROW_ALIGNMENT_MAP[pointId];
    return currentJustify === map.justify && currentAlign === map.align;
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`} data-testid="auto-layout-controls">
      {/* Direction & Wrap Toggles */}
      <div className="flex flex-col gap-1.5">
        <label className="block text-[11px] font-medium text-slate-600">Direction & Wrap</label>
        <div className="flex items-center gap-2">
          {/* Direction Segmented Control */}
          <div className="flex-1 flex rounded border border-slate-300 bg-slate-100 p-0.5 shadow-2xs">
            <button
              type="button"
              data-testid="auto-layout-direction-row"
              title="Horizontal (Row)"
              disabled={disabled}
              onClick={() => handleDirectionChange('row')}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded transition flex items-center justify-center gap-1 cursor-pointer ${
                !isColumn
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span>Horizontal</span>
            </button>
            <button
              type="button"
              data-testid="auto-layout-direction-column"
              title="Vertical (Column)"
              disabled={disabled}
              onClick={() => handleDirectionChange('column')}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded transition flex items-center justify-center gap-1 cursor-pointer ${
                isColumn
                  ? 'bg-white text-blue-600 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="5 12 12 19 19 12" />
              </svg>
              <span>Vertical</span>
            </button>
          </div>

          {/* Wrap Toggle */}
          <button
            type="button"
            data-testid="auto-layout-wrap"
            title={isWrapped ? 'Wrap enabled (Click to disable)' : 'Wrap disabled (Click to enable)'}
            disabled={disabled}
            onClick={handleWrapToggle}
            className={`px-2.5 py-1 text-xs font-medium rounded border transition cursor-pointer shadow-2xs ${
              isWrapped
                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Wrap
          </button>
        </div>
      </div>

      {/* 9-Point Alignment Matrix & Space Between */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-600">Alignment Matrix</label>
          <button
            type="button"
            data-testid="auto-layout-space-between"
            title="Space Between distribution"
            disabled={disabled}
            onClick={handleSpaceBetweenToggle}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition cursor-pointer ${
              isSpaceBetween
                ? 'bg-blue-500 text-white border-blue-600 shadow-xs'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            Space-Between
          </button>
        </div>

        <div className="flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-slate-50/70">
          <div
            className="grid grid-cols-3 gap-1.5 w-32 h-32 p-1.5 bg-white rounded-md border border-slate-200 shadow-2xs"
            data-testid="auto-layout-matrix"
          >
            {ALIGNMENT_POINTS.map((pt) => {
              const active = isPointActive(pt.id);
              return (
                <button
                  key={pt.id}
                  type="button"
                  data-testid={`auto-layout-align-${pt.id}`}
                  title={pt.label}
                  disabled={disabled}
                  onClick={() => handleAlignmentClick(pt.id)}
                  className={`w-full h-full rounded transition flex items-center justify-center cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full transition-all ${
                      active ? 'bg-white scale-110' : 'bg-slate-400 group-hover:bg-slate-600'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gap Slider & Numeric Input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-slate-600">Gap</label>
          <span className="text-[10px] font-mono text-slate-500">
            {gapNum}
            {gapUnit}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Slider */}
          <input
            type="range"
            data-testid="auto-layout-gap-slider"
            min={0}
            max={gapUnit === 'rem' ? 6 : 80}
            step={gapUnit === 'rem' ? 0.25 : 1}
            value={gapNum}
            disabled={disabled}
            onChange={(e) => handleGapChange(parseFloat(e.target.value) || 0, gapUnit)}
            className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />

          {/* Numeric Input & Unit Toggle */}
          <div className="flex items-center rounded border border-slate-300 bg-white overflow-hidden shadow-2xs w-28 shrink-0">
            <input
              type="number"
              data-testid="auto-layout-gap-input"
              min={0}
              step={gapUnit === 'rem' ? 0.25 : 1}
              value={gapNum}
              disabled={disabled}
              onChange={(e) => handleGapChange(parseFloat(e.target.value) || 0, gapUnit)}
              className="w-full text-xs bg-white text-slate-900 px-1.5 py-1 text-right focus:outline-none font-mono min-w-0"
            />
            <select
              data-testid="auto-layout-gap-unit"
              value={gapUnit}
              disabled={disabled}
              onChange={(e) => handleGapChange(gapNum, e.target.value as 'px' | 'rem')}
              className="shrink-0 text-[11px] bg-slate-100 text-slate-700 font-medium px-1 py-1 border-l border-slate-200 focus:outline-none cursor-pointer hover:bg-slate-200 transition"
            >
              <option value="px">px</option>
              <option value="rem">rem</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
