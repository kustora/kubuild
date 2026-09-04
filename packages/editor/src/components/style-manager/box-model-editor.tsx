import React, { useState, useEffect, useRef } from 'react';

export interface BoxModelValues {
  marginTop?: string | number;
  marginRight?: string | number;
  marginBottom?: string | number;
  marginLeft?: string | number;

  borderTopWidth?: string | number;
  borderRightWidth?: string | number;
  borderBottomWidth?: string | number;
  borderLeftWidth?: string | number;

  paddingTop?: string | number;
  paddingRight?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
}

export interface BoxModelEditorProps {
  values?: BoxModelValues | Record<string, unknown>;
  onChange?: (property: string, value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function parseBoxValue(val: unknown): { num: string; unit: string; raw: string } {
  if (val === undefined || val === null || val === '') {
    return { num: '-', unit: 'px', raw: '' };
  }
  if (typeof val === 'number') {
    return { num: String(val), unit: 'px', raw: `${val}px` };
  }
  const str = String(val).trim();
  if (str.toLowerCase() === 'auto') {
    return { num: 'auto', unit: 'auto', raw: 'auto' };
  }
  const match = str.match(/^(-?\d*\.?\d+)\s*(px|rem|%|em|vh|vw)?$/i);
  if (match) {
    const unit = match[2]?.toLowerCase() || 'px';
    return { num: match[1], unit, raw: str };
  }
  return { num: str, unit: 'px', raw: str };
}

interface BoxSideInputProps {
  property: string;
  label: string;
  value: unknown;
  onChange?: (property: string, value: string) => void;
  theme: 'margin' | 'border' | 'padding';
  allowAuto?: boolean;
  disabled?: boolean;
}

const BoxSideInput: React.FC<BoxSideInputProps> = ({
  property,
  label,
  value,
  onChange,
  theme,
  allowAuto = false,
  disabled = false,
}) => {
  const parsed = parseBoxValue(value);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(parsed.raw === '' ? '' : parsed.num);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setInputValue(parsed.raw === '' ? '' : parsed.num);
    }
  }, [value, isEditing, parsed.num, parsed.raw]);

  const commitValue = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (trimmed === '' || trimmed === '-') {
      onChange?.(property, '');
      return;
    }
    if (allowAuto && trimmed.toLowerCase() === 'auto') {
      onChange?.(property, 'auto');
      return;
    }
    const matchWithUnit = trimmed.match(/^(-?\d*\.?\d+)\s*(px|rem|%|em|vh|vw)$/i);
    if (matchWithUnit) {
      onChange?.(property, `${matchWithUnit[1]}${matchWithUnit[2].toLowerCase()}`);
      return;
    }
    const numOnly = Number(trimmed);
    if (!Number.isNaN(numOnly)) {
      const currentUnit = parsed.unit && parsed.unit !== 'auto' ? parsed.unit : 'px';
      onChange?.(property, `${trimmed}${currentUnit}`);
      return;
    }
    onChange?.(property, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(inputValue);
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setInputValue(parsed.raw === '' ? '' : parsed.num);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentNum = Number(inputValue) || 0;
      const step = e.shiftKey ? 10 : 1;
      const nextNum = e.key === 'ArrowUp' ? currentNum + step : Math.max(0, currentNum - step);
      const strVal = String(nextNum);
      setInputValue(strVal);
      commitValue(strVal);
    }
  };

  const themeInputStyles = {
    margin:
      'text-amber-900 bg-amber-100 border-amber-400 focus:ring-amber-500 hover:border-amber-500',
    border:
      'text-slate-900 bg-slate-200 border-slate-400 focus:ring-slate-500 hover:border-slate-500',
    padding:
      'text-emerald-900 bg-emerald-100 border-emerald-400 focus:ring-emerald-500 hover:border-emerald-500',
  }[theme];

  const displayText = parsed.num === '-' ? '0' : parsed.num;

  if (isEditing && !disabled) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label={label}
        data-testid={`box-input-${property}`}
        value={inputValue}
        autoFocus
        onChange={(e) => {
          setInputValue(e.target.value);
          commitValue(e.target.value);
        }}
        onBlur={() => {
          commitValue(inputValue);
          setIsEditing(false);
        }}
        onKeyDown={handleKeyDown}
        className={`w-9 text-center font-mono text-[10px] font-semibold py-0 px-0.5 rounded border focus:outline-none focus:ring-1 shadow-2xs transition ${themeInputStyles}`}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      data-testid={`box-btn-${property}`}
      onClick={() => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.select(), 10);
      }}
      title={`${label}: ${parsed.raw || '0px'} (Click to edit)`}
      className={`min-w-[20px] max-w-[38px] truncate px-1 py-0.5 text-center font-mono text-[10px] font-semibold rounded cursor-pointer transition select-none hover:bg-white/80 active:scale-95 ${
        parsed.num !== '-' && parsed.num !== '0'
          ? 'bg-white/90 shadow-2xs font-bold text-slate-900'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {displayText}
    </button>
  );
};

export const BoxModelEditor: React.FC<BoxModelEditorProps> = ({
  values = {},
  onChange,
  className = '',
  disabled = false,
}) => {
  return (
    <div
      className={`w-full max-w-full select-none rounded-lg p-2 bg-slate-50 border border-slate-200 text-slate-800 box-border overflow-hidden shadow-2xs ${className}`}
      data-testid="visual-box-model"
    >
      {/* MARGIN LAYER (Outer - Orange/Amber) */}
      <div className="relative w-full rounded-md border-2 border-dashed border-amber-400/80 bg-amber-500/10 p-2 box-border transition-colors">
        <span className="absolute top-1 left-1.5 text-[8px] font-black uppercase tracking-wider text-amber-700 pointer-events-none select-none">
          Margin
        </span>

        {/* Margin Top */}
        <div className="flex justify-center mb-1">
          <BoxSideInput
            property="marginTop"
            label="Margin Top"
            value={values.marginTop}
            onChange={onChange}
            theme="margin"
            allowAuto
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-1 min-w-0">
          {/* Margin Left */}
          <div className="shrink-0 flex items-center justify-center">
            <BoxSideInput
              property="marginLeft"
              label="Margin Left"
              value={values.marginLeft}
              onChange={onChange}
              theme="margin"
              allowAuto
              disabled={disabled}
            />
          </div>

          {/* BORDER LAYER (Middle - Slate/Gray) */}
          <div className="relative flex-1 min-w-0 rounded-md border-2 border-solid border-slate-300 bg-slate-200/50 p-2 box-border transition-colors">
            <span className="absolute top-1 left-1.5 text-[8px] font-black uppercase tracking-wider text-slate-600 pointer-events-none select-none">
              Border
            </span>

            {/* Border Top */}
            <div className="flex justify-center mb-1">
              <BoxSideInput
                property="borderTopWidth"
                label="Border Top Width"
                value={values.borderTopWidth}
                onChange={onChange}
                theme="border"
                disabled={disabled}
              />
            </div>

            <div className="flex items-center gap-1 min-w-0">
              {/* Border Left */}
              <div className="shrink-0 flex items-center justify-center">
                <BoxSideInput
                  property="borderLeftWidth"
                  label="Border Left Width"
                  value={values.borderLeftWidth}
                  onChange={onChange}
                  theme="border"
                  disabled={disabled}
                />
              </div>

              {/* PADDING LAYER (Inner - Emerald/Green) */}
              <div className="relative flex-1 min-w-0 rounded-md border-2 border-dashed border-emerald-400/80 bg-emerald-500/15 p-2 box-border transition-colors">
                <span className="absolute top-1 left-1.5 text-[8px] font-black uppercase tracking-wider text-emerald-700 pointer-events-none select-none">
                  Padding
                </span>

                {/* Padding Top */}
                <div className="flex justify-center mb-1">
                  <BoxSideInput
                    property="paddingTop"
                    label="Padding Top"
                    value={values.paddingTop}
                    onChange={onChange}
                    theme="padding"
                    disabled={disabled}
                  />
                </div>

                <div className="flex items-center gap-1 min-w-0">
                  {/* Padding Left */}
                  <div className="shrink-0 flex items-center justify-center">
                    <BoxSideInput
                      property="paddingLeft"
                      label="Padding Left"
                      value={values.paddingLeft}
                      onChange={onChange}
                      theme="padding"
                      disabled={disabled}
                    />
                  </div>

                  {/* CONTENT LAYER (Center - Blue/Neutral) */}
                  <div className="flex-1 min-w-0 flex items-center justify-center py-1 px-1 rounded bg-blue-500/15 border border-blue-300 text-blue-800 shadow-2xs">
                    <span className="text-[9px] font-bold tracking-wider uppercase text-blue-700 truncate">
                      Content
                    </span>
                  </div>

                  {/* Padding Right */}
                  <div className="shrink-0 flex items-center justify-center">
                    <BoxSideInput
                      property="paddingRight"
                      label="Padding Right"
                      value={values.paddingRight}
                      onChange={onChange}
                      theme="padding"
                      disabled={disabled}
                    />
                  </div>
                </div>

                {/* Padding Bottom */}
                <div className="flex justify-center mt-1">
                  <BoxSideInput
                    property="paddingBottom"
                    label="Padding Bottom"
                    value={values.paddingBottom}
                    onChange={onChange}
                    theme="padding"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Border Right */}
              <div className="shrink-0 flex items-center justify-center">
                <BoxSideInput
                  property="borderRightWidth"
                  label="Border Right Width"
                  value={values.borderRightWidth}
                  onChange={onChange}
                  theme="border"
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Border Bottom */}
            <div className="flex justify-center mt-1">
              <BoxSideInput
                property="borderBottomWidth"
                label="Border Bottom Width"
                value={values.borderBottomWidth}
                onChange={onChange}
                theme="border"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Margin Right */}
          <div className="shrink-0 flex items-center justify-center">
            <BoxSideInput
              property="marginRight"
              label="Margin Right"
              value={values.marginRight}
              onChange={onChange}
              theme="margin"
              allowAuto
              disabled={disabled}
            />
          </div>
        </div>

        {/* Margin Bottom */}
        <div className="flex justify-center mt-1">
          <BoxSideInput
            property="marginBottom"
            label="Margin Bottom"
            value={values.marginBottom}
            onChange={onChange}
            theme="margin"
            allowAuto
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export const VisualBoxModel = BoxModelEditor;
