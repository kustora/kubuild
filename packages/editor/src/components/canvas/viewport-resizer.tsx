import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Smartphone, Tablet, Monitor, Maximize2, GripVertical } from 'lucide-react';

export type FluidBreakpoint = 'mobile' | 'tablet' | 'desktop';

export interface BreakpointInfo {
  breakpoint: FluidBreakpoint;
  label: string;
  badgeText: string;
  colorClass: string;
}

export const DEFAULT_MIN_WIDTH = 320;
export const DEFAULT_MAX_WIDTH = 1440;

export const VIEWPORT_PRESETS: Array<{
  name: string;
  width: number;
  breakpoint: FluidBreakpoint;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { name: 'Mobile', width: 375, breakpoint: 'mobile', icon: Smartphone },
  { name: 'Tablet', width: 768, breakpoint: 'tablet', icon: Tablet },
  { name: 'Desktop', width: 1200, breakpoint: 'desktop', icon: Monitor },
  { name: 'Wide', width: 1440, breakpoint: 'desktop', icon: Maximize2 },
];

/**
 * Calculates current breakpoint, human-readable label, and badge string from viewport width (STORA-142).
 * Examples:
 * - 375px -> "375px • Mobile"
 * - 768px -> "768px • Tablet"
 * - 1200px -> "1200px • Desktop"
 */
export function getBreakpointFromWidth(width: number): BreakpointInfo {
  const clampedWidth = Math.round(width);
  if (clampedWidth < 768) {
    return {
      breakpoint: 'mobile',
      label: 'Mobile',
      badgeText: `${clampedWidth}px • Mobile`,
      colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    };
  }
  if (clampedWidth < 1024) {
    return {
      breakpoint: 'tablet',
      label: 'Tablet',
      badgeText: `${clampedWidth}px • Tablet`,
      colorClass: 'bg-amber-50 text-amber-700 border-amber-300',
    };
  }
  return {
    breakpoint: 'desktop',
    label: 'Desktop',
    badgeText: `${clampedWidth}px • Desktop`,
    colorClass: 'bg-blue-50 text-blue-700 border-blue-300',
  };
}

export interface ViewportResizerHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  onBreakpointChange?: (breakpoint: FluidBreakpoint) => void;
  disabled?: boolean;
  className?: string;
  showBadge?: boolean;
  zoom?: number;
}

/**
 * Vertical Draggable Resizer Bar on the right edge of the canvas preview frame (STORA-142).
 * Dragging smoothly modifies viewport width between minWidth (320px) and maxWidth (1440px).
 */
export const ViewportResizerHandle: React.FC<ViewportResizerHandleProps> = ({
  width,
  onWidthChange,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  onBreakpointChange,
  disabled = false,
  className = '',
  showBadge = true,
  zoom = 1,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const bpInfo = getBreakpointFromWidth(width);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startWidth: width,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const scale = zoom && zoom > 0 ? zoom : 1;
      const deltaX = (moveEvent.clientX - dragStartRef.current.startX) / scale;
      const targetWidth = Math.round(dragStartRef.current.startWidth + deltaX);
      const clamped = Math.max(minWidth, Math.min(maxWidth, targetWidth));

      onWidthChange(clamped);
      const nextBp = getBreakpointFromWidth(clamped);
      if (nextBp.breakpoint !== bpInfo.breakpoint) {
        onBreakpointChange?.(nextBp.breakpoint);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextWidth = Math.max(minWidth, width - step);
      onWidthChange(nextWidth);
      onBreakpointChange?.(getBreakpointFromWidth(nextWidth).breakpoint);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextWidth = Math.min(maxWidth, width + step);
      onWidthChange(nextWidth);
      onBreakpointChange?.(getBreakpointFromWidth(nextWidth).breakpoint);
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    // Cycle between mobile (375), tablet (768), and desktop (1200)
    let nextWidth = 1200;
    if (width >= 1200) nextWidth = 375;
    else if (width < 768) nextWidth = 768;
    else nextWidth = 1200;

    onWidthChange(nextWidth);
    onBreakpointChange?.(getBreakpointFromWidth(nextWidth).breakpoint);
  };

  return (
    <div
      data-testid="viewport-resizer-handle"
      role="slider"
      aria-label="Resize Viewport Width"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={handleDoubleClick}
      title="Drag to resize viewport width (Double-click to cycle presets)"
      style={{ touchAction: 'none' }}
      className={`group absolute top-0 right-0 h-full w-4 -mr-2 flex items-center justify-center cursor-col-resize select-none z-30 transition-colors ${
        isDragging ? 'bg-blue-500/20' : 'hover:bg-blue-500/10'
      } ${className}`}
    >
      {/* Visual Draggable Bar Pill */}
      <div
        className={`w-1.5 h-16 rounded-full transition-all duration-150 flex items-center justify-center ${
          isDragging
            ? 'bg-blue-600 ring-4 ring-blue-400/30 scale-y-110'
            : 'bg-slate-300 group-hover:bg-blue-500 group-hover:h-20 shadow-xs'
        }`}
      >
        <GripVertical className="w-2.5 h-2.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Live Dimension & Breakpoint Badge Overlay during hover or drag (STORA-142) */}
      {showBadge && (
        <div
          data-testid="viewport-resizer-badge"
          className={`absolute -top-8 right-1/2 translate-x-1/2 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border shadow-md whitespace-nowrap pointer-events-none transition-all duration-150 ${
            bpInfo.colorClass
          } ${isDragging ? 'opacity-100 scale-105 ring-2 ring-blue-400' : 'opacity-80 group-hover:opacity-100'}`}
        >
          {bpInfo.badgeText}
        </div>
      )}
    </div>
  );
};

export interface ViewportResizerProps {
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  onBreakpointChange?: (breakpoint: FluidBreakpoint) => void;
  disabled?: boolean;
  showPresets?: boolean;
  title?: string;
  slug?: string;
  isActive?: boolean;
  onSelect?: () => void;
  zoom?: number;
  frameRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
  className?: string;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * Canvas Viewport Resizer Frame Container (STORA-142).
 * Wraps canvas content with fluid draggable width handle and quick breakpoint presets toolbar.
 */
export const ViewportResizer: React.FC<ViewportResizerProps> = ({
  width,
  onWidthChange,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  onBreakpointChange,
  disabled = false,
  showPresets = true,
  title,
  slug,
  isActive = true,
  onSelect,
  zoom = 1,
  frameRef,
  children,
  className = '',
  onHeaderPointerDown,
}) => {
  const bpInfo = getBreakpointFromWidth(width);

  return (
    <div
      className={`flex flex-col items-start shrink-0 ${className}`}
      style={{ width: `${width}px` }}
      data-testid="viewport-resizer-container"
    >
      {/* Top Presets & Resolution Badge Bar */}
      {showPresets && (
        <div
          className="flex items-center justify-between gap-2 w-full px-1 py-1 mb-2 select-none text-xs"
          onPointerDown={onHeaderPointerDown}
        >
          {/* Live Resolution & Breakpoint Badge + Title */}
          <div className="flex items-center gap-2 min-w-0 cursor-grab active:cursor-grabbing">
            {title && (
              <span
                onClick={onSelect}
                className={`font-semibold truncate max-w-[200px] cursor-pointer transition ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-700 hover:text-slate-900'
                }`}
                title={title}
              >
                {title}
              </span>
            )}
            {slug && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600 border border-slate-300/60 shrink-0">
                {slug}
              </span>
            )}
            <span
              data-testid="viewport-resolution-badge"
              className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold border shadow-2xs transition-colors shrink-0 ${bpInfo.colorClass}`}
            >
              {bpInfo.badgeText}
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div
            className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {VIEWPORT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isCurrentPresetActive = Math.abs(width - preset.width) < 8;

              return (
                <button
                  key={preset.name}
                  type="button"
                  data-testid={`preset-button-${preset.name.toLowerCase()}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.();
                    onWidthChange(preset.width);
                    onBreakpointChange?.(preset.breakpoint);
                  }}
                  title={`Set to ${preset.name} (${preset.width}px)`}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    isCurrentPresetActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{preset.name}</span>
                  <span className={`text-[10px] ${isCurrentPresetActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {preset.width}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Frame Container with Draggable Handle on Right Edge */}
      <div
        ref={frameRef}
        data-testid="viewport-resizer-frame"
        style={{ width: `${width}px`, maxWidth: '100%' }}
        onClick={isActive ? undefined : onSelect}
        className={`relative bg-white shadow-xl rounded-xl overflow-visible border transition-[width] duration-75 min-h-[500px] ${
          isActive
            ? 'border-blue-400 ring-4 ring-blue-500/10'
            : 'border-slate-200 hover:border-blue-400/80 hover:shadow-2xl cursor-pointer'
        }`}
      >
        {children}

        {/* Vertical Draggable Handle on the Right Edge only when active */}
        {isActive && !disabled && (
          <ViewportResizerHandle
            width={width}
            onWidthChange={onWidthChange}
            minWidth={minWidth}
            maxWidth={maxWidth}
            onBreakpointChange={onBreakpointChange}
            disabled={disabled}
            zoom={zoom}
          />
        )}
      </div>
    </div>
  );
};
