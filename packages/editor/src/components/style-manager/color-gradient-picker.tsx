import React, { useState, useEffect } from 'react';

export interface GradientStop {
  color: string;
  position: number; // 0 to 100
}

export type ColorMode = 'solid' | 'linear' | 'radial';
export type ColorFormat = 'hex' | 'rgba' | 'hsl';

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const intVal = parseInt(clean, 16);
  if (isNaN(intVal) || clean.length < 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function parseColorString(val: unknown): {
  mode: ColorMode;
  color: string;
  alpha: number; // 0 to 1
  angle: number;
  stops: GradientStop[];
} {
  const fallback = {
    mode: 'solid' as ColorMode,
    color: '#3b82f6',
    alpha: 1,
    angle: 90,
    stops: [
      { color: '#3b82f6', position: 0 },
      { color: '#8b5cf6', position: 100 },
    ],
  };

  if (!val || typeof val !== 'string') return fallback;
  const str = val.trim();

  // Linear gradient
  if (str.startsWith('linear-gradient(')) {
    const inner = str.slice('linear-gradient('.length, -1).trim();
    // parse angle
    const angleMatch = inner.match(/^(\d+)deg/i);
    const angle = angleMatch ? parseInt(angleMatch[1], 10) : 90;
    const stopsPart = angleMatch ? inner.replace(angleMatch[0], '').replace(/^,\s*/, '') : inner;

    const stops = parseStops(stopsPart);
    return {
      mode: 'linear',
      color: stops[0]?.color ?? '#3b82f6',
      alpha: 1,
      angle,
      stops: stops.length > 0 ? stops : fallback.stops,
    };
  }

  // Radial gradient
  if (str.startsWith('radial-gradient(')) {
    const inner = str.slice('radial-gradient('.length, -1).trim();
    const cleanInner = inner.replace(/^circle\s*,?\s*/i, '');
    const stops = parseStops(cleanInner);
    return {
      mode: 'radial',
      color: stops[0]?.color ?? '#3b82f6',
      alpha: 1,
      angle: 0,
      stops: stops.length > 0 ? stops : fallback.stops,
    };
  }

  // RGBA
  const rgbaMatch = str.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = parseFloat(rgbaMatch[4]);
    return {
      mode: 'solid',
      color: rgbToHex(r, g, b),
      alpha: isNaN(a) ? 1 : a,
      angle: 90,
      stops: fallback.stops,
    };
  }

  // Hex
  if (str.startsWith('#')) {
    return {
      mode: 'solid',
      color: str,
      alpha: 1,
      angle: 90,
      stops: fallback.stops,
    };
  }

  return {
    mode: 'solid',
    color: str,
    alpha: 1,
    angle: 90,
    stops: fallback.stops,
  };
}

function parseStops(stopsPart: string): GradientStop[] {
  const parts = stopsPart.split(/,(?![^(]*\))/);
  const result: GradientStop[] = [];

  parts.forEach((part, index) => {
    const trimmed = part.trim();
    const posMatch = trimmed.match(/(\d+)%$/);
    const position = posMatch ? parseInt(posMatch[1], 10) : index === 0 ? 0 : 100;
    const color = posMatch ? trimmed.replace(posMatch[0], '').trim() : trimmed;
    if (color) {
      result.push({ color, position });
    }
  });

  return result;
}

export function serializeGradient(
  mode: 'linear' | 'radial',
  angle: number,
  stops: GradientStop[],
): string {
  const stopsStr = stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(', ');

  if (mode === 'linear') {
    return `linear-gradient(${angle}deg, ${stopsStr})`;
  }
  return `radial-gradient(circle, ${stopsStr})`;
}

export interface ColorGradientPickerProps {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ColorGradientPicker: React.FC<ColorGradientPickerProps> = ({
  value = '#3b82f6',
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const parsed = parseColorString(value);
  const [mode, setMode] = useState<ColorMode>(parsed.mode);
  const [color, setColor] = useState<string>(parsed.color.startsWith('#') ? parsed.color : '#3b82f6');
  const [alpha, setAlpha] = useState<number>(parsed.alpha);
  const [angle, setAngle] = useState<number>(parsed.angle);
  const [stops, setStops] = useState<GradientStop[]>(parsed.stops);
  const [format, setFormat] = useState<ColorFormat>('hex');

  useEffect(() => {
    const p = parseColorString(value);
    setMode(p.mode);
    setColor(p.color.startsWith('#') ? p.color : '#3b82f6');
    setAlpha(p.alpha);
    setAngle(p.angle);
    setStops(p.stops);
  }, [value]);

  const emitSolidColor = (newColor: string, newAlpha: number) => {
    if (newAlpha < 1) {
      const { r, g, b } = hexToRgb(newColor);
      onChange(`rgba(${r}, ${g}, ${b}, ${newAlpha.toFixed(2).replace(/\.?0+$/, '')})`);
    } else {
      onChange(newColor);
    }
  };

  const handleModeChange = (newMode: ColorMode) => {
    setMode(newMode);
    if (newMode === 'solid') {
      emitSolidColor(color, alpha);
    } else {
      onChange(serializeGradient(newMode, angle, stops));
    }
  };

  const handleColorChange = (newColor: string) => {
    setColor(newColor);
    if (mode === 'solid') {
      emitSolidColor(newColor, alpha);
    }
  };

  const handleAlphaChange = (newAlpha: number) => {
    setAlpha(newAlpha);
    if (mode === 'solid') {
      emitSolidColor(color, newAlpha);
    }
  };

  const handleAngleChange = (newAngle: number) => {
    setAngle(newAngle);
    if (mode === 'linear') {
      onChange(serializeGradient('linear', newAngle, stops));
    }
  };

  const handleStopColorChange = (index: number, stopColor: string) => {
    const updated = [...stops];
    updated[index] = { ...updated[index], color: stopColor };
    setStops(updated);
    onChange(serializeGradient(mode === 'radial' ? 'radial' : 'linear', angle, updated));
  };

  const handleStopPosChange = (index: number, pos: number) => {
    const updated = [...stops];
    updated[index] = { ...updated[index], position: pos };
    setStops(updated);
    onChange(serializeGradient(mode === 'radial' ? 'radial' : 'linear', angle, updated));
  };

  const handleAddStop = () => {
    const nextPos = Math.min(100, Math.max(0, (stops[stops.length - 1]?.position ?? 50) + 10));
    const nextStops = [...stops, { color: '#ec4899', position: nextPos }];
    setStops(nextStops);
    onChange(serializeGradient(mode === 'radial' ? 'radial' : 'linear', angle, nextStops));
  };

  const handleRemoveStop = (index: number) => {
    if (stops.length <= 2) return;
    const nextStops = stops.filter((_, i) => i !== index);
    setStops(nextStops);
    onChange(serializeGradient(mode === 'radial' ? 'radial' : 'linear', angle, nextStops));
  };

  // Compute display string based on format
  const getFormattedValue = (): string => {
    if (mode !== 'solid') return value;
    const { r, g, b } = hexToRgb(color);
    if (format === 'rgba') {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (format === 'hsl') {
      const hsl = rgbToHsl(r, g, b);
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }
    return color;
  };

  return (
    <div className={`flex flex-col gap-2.5 p-2.5 bg-slate-50 rounded-lg border border-slate-200 ${className}`} data-testid="color-gradient-picker">
      {label && <label className="block text-[11px] font-medium text-slate-600">{label}</label>}

      {/* Mode Selector Tabs (Solid, Linear, Radial) */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-0.5 rounded border border-slate-200 shadow-2xs">
        <button
          type="button"
          data-testid="color-picker-mode-solid"
          disabled={disabled}
          onClick={() => handleModeChange('solid')}
          className={`py-1 text-xs rounded font-medium transition cursor-pointer ${
            mode === 'solid' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Solid
        </button>
        <button
          type="button"
          data-testid="color-picker-mode-linear"
          disabled={disabled}
          onClick={() => handleModeChange('linear')}
          className={`py-1 text-xs rounded font-medium transition cursor-pointer ${
            mode === 'linear' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Linear
        </button>
        <button
          type="button"
          data-testid="color-picker-mode-radial"
          disabled={disabled}
          onClick={() => handleModeChange('radial')}
          className={`py-1 text-xs rounded font-medium transition cursor-pointer ${
            mode === 'radial' ? 'bg-white text-blue-600 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Radial
        </button>
      </div>

      {/* Solid Mode Controls */}
      {mode === 'solid' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              data-testid="color-picker-native-input"
              value={color}
              disabled={disabled}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0.5 bg-white shrink-0"
            />
            <input
              type="text"
              data-testid="color-picker-text-input"
              value={getFormattedValue()}
              disabled={disabled}
              onChange={(e) => handleColorChange(e.target.value)}
              className="flex-1 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 font-mono shadow-2xs"
            />
            {/* Format toggle button */}
            <button
              type="button"
              data-testid="color-picker-format-toggle"
              disabled={disabled}
              onClick={() => {
                const nextFormat: ColorFormat = format === 'hex' ? 'rgba' : format === 'rgba' ? 'hsl' : 'hex';
                setFormat(nextFormat);
              }}
              className="px-1.5 py-1 text-[10px] font-bold uppercase rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer shadow-2xs"
            >
              {format}
            </button>
          </div>

          {/* Alpha / Opacity Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500">Opacity (Alpha)</span>
              <span className="text-[10px] font-mono text-slate-500">{Math.round(alpha * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                data-testid="color-picker-alpha-slider"
                min={0}
                max={1}
                step={0.01}
                value={alpha}
                disabled={disabled}
                onChange={(e) => handleAlphaChange(parseFloat(e.target.value) || 0)}
                className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <input
                type="number"
                data-testid="color-picker-alpha-input"
                min={0}
                max={100}
                value={Math.round(alpha * 100)}
                disabled={disabled}
                onChange={(e) => handleAlphaChange((parseFloat(e.target.value) || 0) / 100)}
                className="w-12 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1 py-0.5 text-right font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Gradient Mode Controls */}
      {mode !== 'solid' && (
        <div className="flex flex-col gap-2.5">
          {/* Visual Gradient Preview Bar */}
          <div
            data-testid="gradient-preview-bar"
            className="w-full h-7 rounded border border-slate-300 shadow-2xs"
            style={{ background: serializeGradient(mode, angle, stops) }}
          />

          {/* Angle Picker (Linear Gradient only) */}
          {mode === 'linear' && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-500">Gradient Angle</span>
                <span className="text-[10px] font-mono text-slate-500">{angle}°</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  data-testid="gradient-angle-slider"
                  min={0}
                  max={360}
                  step={1}
                  value={angle}
                  disabled={disabled}
                  onChange={(e) => handleAngleChange(parseInt(e.target.value, 10) || 0)}
                  className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                />
                <input
                  type="number"
                  data-testid="gradient-angle-input"
                  min={0}
                  max={360}
                  value={angle}
                  disabled={disabled}
                  onChange={(e) => handleAngleChange(parseInt(e.target.value, 10) || 0)}
                  className="w-14 text-xs bg-white text-slate-900 border border-slate-300 rounded px-1 py-0.5 text-right font-mono"
                />
              </div>
            </div>
          )}

          {/* Color Stops List */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-slate-500">Color Stops</span>
              <button
                type="button"
                data-testid="gradient-add-stop"
                disabled={disabled}
                onClick={handleAddStop}
                className="text-[10px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                + Add Stop
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {stops.map((stop, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-1.5 rounded border border-slate-200 shadow-2xs">
                  <input
                    type="color"
                    data-testid={`gradient-stop-color-${idx}`}
                    value={stop.color.startsWith('#') ? stop.color : '#3b82f6'}
                    disabled={disabled}
                    onChange={(e) => handleStopColorChange(idx, e.target.value)}
                    className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="range"
                    data-testid={`gradient-stop-pos-${idx}`}
                    min={0}
                    max={100}
                    step={1}
                    value={stop.position}
                    disabled={disabled}
                    onChange={(e) => handleStopPosChange(idx, parseInt(e.target.value, 10) || 0)}
                    className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                  <span className="text-[10px] font-mono text-slate-500 w-8 text-right shrink-0">
                    {stop.position}%
                  </span>
                  {stops.length > 2 && (
                    <button
                      type="button"
                      data-testid={`gradient-remove-stop-${idx}`}
                      disabled={disabled}
                      onClick={() => handleRemoveStop(idx)}
                      className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer text-xs"
                      title="Remove stop"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
