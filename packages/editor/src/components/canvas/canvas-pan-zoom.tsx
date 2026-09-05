import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Columns3, Hand, MousePointer } from 'lucide-react';

export interface CanvasPanZoomState {
  pan: { x: number; y: number };
  zoom: number;
  isPanning: boolean;
  isSpacePressed: boolean;
}

export interface CanvasZoomToolbarProps {
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onReset: () => void;
  onFit?: () => void;
  className?: string;
  /** Active navigation tool mode: 'select' (V) or 'hand' (H) */
  toolMode?: 'select' | 'hand';
  /** Callback when user changes navigation tool mode */
  onToolModeChange?: (mode: 'select' | 'hand') => void;
  /** Whether multi-device side-by-side preview mode is active (STORA-143) */
  multiDeviceMode?: boolean;
  /** Callback to toggle multi-device preview mode (STORA-143) */
  onToggleMultiDevice?: () => void;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.0;

export function clampZoom(val: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(val * 100) / 100));
}

/**
 * Zoom Presets Toolbar (STORA-131).
 * Supports presets (50%, 75%, 100%, 150%, Fit) and step in/out buttons.
 */
export const CanvasZoomToolbar: React.FC<CanvasZoomToolbarProps> = ({
  zoom,
  onZoomChange,
  onReset,
  onFit,
  className = '',
  toolMode = 'select',
  onToolModeChange,
  multiDeviceMode = false,
  onToggleMultiDevice,
}) => {
  const percentage = Math.round(zoom * 100);

  const handleStepZoom = (delta: number) => {
    onZoomChange(clampZoom(zoom + delta));
  };

  return (
    <div
      data-testid="canvas-zoom-toolbar"
      className={`flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-slate-200 shadow-md rounded-lg p-1 text-slate-700 text-xs select-none z-40 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Tool Mode: Select (V) / Hand (H) */}
      {onToolModeChange && (
        <>
          <div className="flex items-center bg-slate-100 rounded-md p-0.5">
            <button
              type="button"
              data-testid="tool-select-btn"
              title="Select / Move Elements (V)"
              onClick={() => onToolModeChange('select')}
              className={`p-1 rounded transition cursor-pointer ${
                toolMode === 'select'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="tool-hand-btn"
              title="Hand Tool / Pan Canvas (H or Hold Space)"
              onClick={() => onToolModeChange('hand')}
              className={`p-1 rounded transition cursor-pointer ${
                toolMode === 'hand'
                  ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
        </>
      )}
      {/* Zoom Out Button */}
      <button
        type="button"
        data-testid="zoom-out-btn"
        title="Zoom Out (Cmd -)"
        onClick={() => handleStepZoom(-0.1)}
        disabled={zoom <= MIN_ZOOM}
        className="p-1 hover:bg-slate-100 disabled:opacity-40 rounded transition"
      >
        <ZoomOut className="w-3.5 h-3.5" />
      </button>

      {/* Zoom Level Display */}
      <span
        data-testid="zoom-level-display"
        className="px-1.5 min-w-[42px] text-center font-mono font-medium text-slate-800"
      >
        {`${percentage}%`}
      </span>

      {/* Zoom In Button */}
      <button
        type="button"
        data-testid="zoom-in-btn"
        title="Zoom In (Cmd +)"
        onClick={() => handleStepZoom(0.1)}
        disabled={zoom >= MAX_ZOOM}
        className="p-1 hover:bg-slate-100 disabled:opacity-40 rounded transition"
      >
        <ZoomIn className="w-3.5 h-3.5" />
      </button>

      <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

      {/* Presets */}
      <button
        type="button"
        data-testid="zoom-preset-50"
        title="50%"
        onClick={() => onZoomChange(0.5)}
        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
          percentage === 50 ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100'
        }`}
      >
        50%
      </button>
      <button
        type="button"
        data-testid="zoom-preset-75"
        title="75%"
        onClick={() => onZoomChange(0.75)}
        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
          percentage === 75 ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100'
        }`}
      >
        75%
      </button>
      <button
        type="button"
        data-testid="zoom-preset-100"
        title="100%"
        onClick={() => onZoomChange(1.0)}
        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
          percentage === 100 ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100'
        }`}
      >
        100%
      </button>
      <button
        type="button"
        data-testid="zoom-preset-150"
        title="150%"
        onClick={() => onZoomChange(1.5)}
        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition ${
          percentage === 150 ? 'bg-blue-50 text-blue-600 font-semibold' : 'hover:bg-slate-100'
        }`}
      >
        150%
      </button>

      <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />

      {/* Reset Button */}
      <button
        type="button"
        data-testid="zoom-reset-btn"
        title="Reset Zoom (100%)"
        onClick={onReset}
        className="p-1 hover:bg-slate-100 rounded transition"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      {/* Fit to Viewport Button */}
      {onFit && (
        <button
          type="button"
          data-testid="zoom-fit-btn"
          title="Fit Canvas"
          onClick={onFit}
          className="p-1 hover:bg-slate-100 rounded transition text-blue-600"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>
      )}

      {/* STORA-143: Side-by-Side Multi-Device Preview Toggle */}
      {onToggleMultiDevice && (
        <>
          <div className="w-[1px] h-3.5 bg-slate-200 mx-0.5" />
          <button
            type="button"
            data-testid="toggle-multi-device-btn"
            title={multiDeviceMode ? 'Exit Multi-Device Preview' : 'Side-by-Side Multi-Device Preview (Desktop, Tablet, Mobile)'}
            onClick={onToggleMultiDevice}
            className={`p-1 rounded transition flex items-center gap-1 ${
              multiDeviceMode
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">Devices</span>
          </button>
        </>
      )}
    </div>
  );
};

export interface UseCanvasPanZoomOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
}

/**
 * Hook for Canvas Pan (Trackpad swipe, Hand tool, Space+Drag, Middle-click) & Zoom (Cmd/Ctrl + Wheel) (STORA-130, STORA-131).
 */
export function useCanvasPanZoom({
  containerRef,
  enabled = true,
}: UseCanvasPanZoomOptions) {
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [toolMode, setToolMode] = useState<'select' | 'hand'>('select');

  const panRef = useRef(pan);
  panRef.current = pan;

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const toolModeRef = useRef(toolMode);
  toolModeRef.current = toolMode;

  const isSpacePressedRef = useRef(isSpacePressed);
  isSpacePressedRef.current = isSpacePressed;

  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  // Keyboard Space listener for Pan mode + H/V shortcuts (STORA-130)
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      } else if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey) {
        setToolMode('hand');
      } else if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey) {
        setToolMode('select');
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [enabled]);

  // Wheel listener for Zoom (Cmd/Ctrl + Wheel or Pinch) & Pan (Trackpad two-finger swipe or standard mouse wheel)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const onWheel = (e: WheelEvent) => {
      // 1. Zoom with Cmd / Ctrl or pinch gesture (ctrlKey is true on trackpad pinch)
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const nextZoom = clampZoom(currentZoom * zoomFactor);

        if (nextZoom !== currentZoom) {
          // Centered zoom formula relative to (0,0) transform-origin
          const newPanX = mouseX - (mouseX - currentPan.x) * (nextZoom / currentZoom);
          const newPanY = mouseY - (mouseY - currentPan.y) * (nextZoom / currentZoom);

          setZoom(nextZoom);
          setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
        }
      } else {
        // 2. Pan with Trackpad two-finger swipe or mouse wheel (Figma style)
        e.preventDefault();
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        setPan((prev) => ({
          x: Math.round(prev.x - dx),
          y: Math.round(prev.y - dy),
        }));
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, enabled]);

  // Pointer event handlers for panning
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      // Space + left click OR middle click (button 1) OR hand tool mode with left click
      const isMiddleClick = e.button === 1;
      const isSpacePan = isSpacePressedRef.current && e.button === 0;
      const isHandMode = toolModeRef.current === 'hand' && e.button === 0;

      if (isMiddleClick || isSpacePan || isHandMode) {
        e.preventDefault();
        e.stopPropagation();
        setIsPanning(true);
        dragStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          initialPanX: panRef.current.x,
          initialPanY: panRef.current.y,
        };
      }
    },
    [enabled],
  );

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragStartRef.current;
    if (!drag) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;

    setPan({
      x: Math.round(drag.initialPanX + deltaX),
      y: Math.round(drag.initialPanY + deltaY),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragStartRef.current) {
      dragStartRef.current = null;
      setIsPanning(false);
    }
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [isPanning, handlePointerMove, handlePointerUp]);

  const resetPanZoom = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  }, []);

  const fitPanZoom = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1.0);
  }, []);

  const cursorStyle = isPanning
    ? 'grabbing'
    : isSpacePressed || toolMode === 'hand'
    ? 'grab'
    : undefined;

  return {
    pan,
    setPan,
    zoom,
    setZoom,
    isPanning,
    isSpacePressed,
    toolMode,
    setToolMode,
    cursorStyle,
    handlePointerDown,
    resetPanZoom,
    fitPanZoom,
  };
}
