import React from 'react';
import { AnimationConfig, DEFAULT_ANIMATION_CONFIG } from '@kubuild/schema';
import { ComponentIcon } from '../ui/icons';

export interface MotionSectorControlsProps {
  animation?: Partial<AnimationConfig>;
  onChange: (animation: Partial<AnimationConfig>) => void;
  onReplay?: () => void;
  disabled?: boolean;
}

export const ANIMATION_TYPES = [

  { value: 'none', label: 'None' },
  {
    group: 'Fade Effects',
    items: [
      { value: 'fade', label: 'Fade' },
      { value: 'fade-up', label: 'Fade Up' },
      { value: 'fade-down', label: 'Fade Down' },
      { value: 'fade-left', label: 'Fade Left' },
      { value: 'fade-right', label: 'Fade Right' },
    ],
  },
  {
    group: 'Zoom Effects',
    items: [
      { value: 'zoom-in', label: 'Zoom In' },
      { value: 'zoom-out', label: 'Zoom Out' },
    ],
  },
  {
    group: 'Slide Effects',
    items: [
      { value: 'slide-up', label: 'Slide Up' },
      { value: 'slide-down', label: 'Slide Down' },
      { value: 'slide-left', label: 'Slide Left' },
      { value: 'slide-right', label: 'Slide Right' },
    ],
  },
  {
    group: 'Flip Effects',
    items: [
      { value: 'flip-up', label: 'Flip Up' },
      { value: 'flip-down', label: 'Flip Down' },
    ],
  },
];

export const EASING_OPTIONS = [
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease', label: 'Ease' },
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-in-out', label: 'Ease In Out' },
];

export const HOVER_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'lift', label: 'Lift' },
  { value: 'scale', label: 'Scale' },
  { value: 'glow', label: 'Glow' },
  { value: 'tilt', label: 'Tilt' },
];

export const LOOP_EFFECTS = [
  { value: 'none', label: 'None' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'spin', label: 'Spin' },
  { value: 'float', label: 'Float' },
  { value: 'shimmer', label: 'Shimmer' },
];

export const MotionSectorControls: React.FC<MotionSectorControlsProps> = ({
  animation,
  onChange,
  onReplay,
  disabled = false,
}) => {
  const currentConfig: AnimationConfig = {
    ...DEFAULT_ANIMATION_CONFIG,
    ...(animation ?? {}),
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ type: e.target.value });
  };

  const handleDurationChange = (val: number) => {
    onChange({ duration: Math.max(0, val) });
  };

  const handleDelayChange = (val: number) => {
    onChange({ delay: Math.max(0, val) });
  };

  const handleEasingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ easing: e.target.value });
  };

  const handleOnceToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ once: e.target.checked });
  };

  const handleHoverChange = (effect: string) => {
    onChange({ hoverEffect: effect });
  };

  const handleLoopChange = (effect: string) => {
    onChange({ loopEffect: effect });
  };

  const isAnimated =
    currentConfig.type !== 'none' ||
    currentConfig.hoverEffect !== 'none' ||
    currentConfig.loopEffect !== 'none';

  return (
    <div className="flex flex-col gap-4 text-xs text-slate-700" data-testid="motion-sector-controls">
      {/* Live Replay Button (STORA-262) */}
      {isAnimated && onReplay && (
        <button
          type="button"
          data-testid="motion-replay-button"
          onClick={onReplay}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-medium transition shadow-2xs cursor-pointer"
        >
          <ComponentIcon iconOrType="play" size={13} className="text-blue-600" />
          <span>Play / Replay Animation</span>
        </button>
      )}

      {/* 1. Scroll / Entrance Animation Type */}
      <div className="flex flex-col gap-1">
        <label htmlFor="motion-animation-type" className="font-semibold text-slate-600 flex items-center justify-between">
          <span>Entrance / Scroll Effect</span>
          {currentConfig.type !== 'none' && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              Active
            </span>
          )}
        </label>
        <select
          id="motion-animation-type"
          data-testid="motion-animation-type"
          value={currentConfig.type}
          onChange={handleTypeChange}
          disabled={disabled}
          className="w-full bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
        >
          {ANIMATION_TYPES.map((opt) => {
            if ('items' in opt && Array.isArray(opt.items)) {
              return (
                <optgroup key={opt.group} label={opt.group}>
                  {opt.items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              );
            }
            if ('value' in opt) {
              return (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              );
            }
            return null;
          })}
        </select>
      </div>

      {/* 2. Duration & Delay Sliders */}
      <div className="flex flex-col gap-3 p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg">
        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="motion-duration-slider" className="font-medium text-slate-600">
              Duration
            </label>
            <div className="flex items-center gap-1">
              <input
                id="motion-duration-input"
                data-testid="motion-duration-input"
                type="number"
                min={0}
                max={10000}
                step={50}
                value={currentConfig.duration}
                onChange={(e) => handleDurationChange(parseInt(e.target.value, 10))}
                disabled={disabled}
                className="w-16 bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-[10px]">ms</span>
            </div>
          </div>
          <input
            id="motion-duration-slider"
            data-testid="motion-duration-slider"
            type="range"
            min={0}
            max={3000}
            step={50}
            value={Math.min(currentConfig.duration, 3000)}
            onChange={(e) => handleDurationChange(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Delay */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="motion-delay-slider" className="font-medium text-slate-600">
              Delay
            </label>
            <div className="flex items-center gap-1">
              <input
                id="motion-delay-input"
                data-testid="motion-delay-input"
                type="number"
                min={0}
                max={10000}
                step={50}
                value={currentConfig.delay}
                onChange={(e) => handleDelayChange(parseInt(e.target.value, 10))}
                disabled={disabled}
                className="w-16 bg-white text-slate-900 border border-slate-300 rounded px-1.5 py-0.5 text-right font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-[10px]">ms</span>
            </div>
          </div>
          <input
            id="motion-delay-slider"
            data-testid="motion-delay-slider"
            type="range"
            min={0}
            max={2000}
            step={50}
            value={Math.min(currentConfig.delay, 2000)}
            onChange={(e) => handleDelayChange(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Easing & Trigger Once */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80">
          <div className="flex flex-col gap-1">
            <label htmlFor="motion-easing-select" className="text-[11px] font-medium text-slate-500">
              Easing Curve
            </label>
            <select
              id="motion-easing-select"
              data-testid="motion-easing-select"
              value={currentConfig.easing}
              onChange={handleEasingChange}
              disabled={disabled}
              className="bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {EASING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label
              htmlFor="motion-once-toggle"
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none py-1"
            >
              <input
                id="motion-once-toggle"
                data-testid="motion-once-toggle"
                type="checkbox"
                checked={currentConfig.once}
                onChange={handleOnceToggle}
                disabled={disabled}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Trigger Once</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Hover Micro-Interactions (Segmented Buttons) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-600">Hover Micro-Interaction</label>
          {currentConfig.hoverEffect !== 'none' && (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
              {currentConfig.hoverEffect}
            </span>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Hover Micro-Interaction"
          className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg flex-wrap"
          data-testid="motion-hover-segmented"
        >
          {HOVER_EFFECTS.map((item) => {
            const isSelected = currentConfig.hoverEffect === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`motion-hover-${item.value}`}
                onClick={() => handleHoverChange(item.value)}
                disabled={disabled}
                className={`flex-1 min-w-[50px] py-1 px-2 text-[11px] font-medium rounded text-center transition cursor-pointer ${
                  isSelected
                    ? 'bg-white text-blue-700 font-semibold shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Continuous Loop Effect (Segmented Buttons) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-slate-600">Loop Animation</label>
          {currentConfig.loopEffect !== 'none' && (
            <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
              {currentConfig.loopEffect}
            </span>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Loop Animation"
          className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg flex-wrap"
          data-testid="motion-loop-segmented"
        >
          {LOOP_EFFECTS.map((item) => {
            const isSelected = currentConfig.loopEffect === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`motion-loop-${item.value}`}
                onClick={() => handleLoopChange(item.value)}
                disabled={disabled}
                className={`flex-1 min-w-[50px] py-1 px-1.5 text-[11px] font-medium rounded text-center transition cursor-pointer ${
                  isSelected
                    ? 'bg-white text-indigo-700 font-semibold shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
