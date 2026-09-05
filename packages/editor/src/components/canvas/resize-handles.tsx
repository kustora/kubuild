import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../store';
import { CanvasRect, GuideLine, calculateSnapping } from './smart-guides';

export type ResizeHandleDirection =
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw';

export interface ResizeHandlesProps {
  selectedNodeId: string;
  selectedRect: CanvasRect;
  zoom?: number;
  candidateRects?: CanvasRect[];
  onGuidesChange?: (guides: GuideLine[]) => void;
  onResizeEnd?: (newWidth: number, newHeight: number) => void;
}

interface DragState {
  handle: ResizeHandleDirection;
  startX: number;
  startY: number;
  initialWidth: number;
  initialHeight: number;
  initialTop: number;
  initialLeft: number;
  aspectRatio: number;
  currentWidth: number;
  currentHeight: number;
  currentTop: number;
  currentLeft: number;
}

const HANDLES: Array<{
  dir: ResizeHandleDirection;
  cursor: string;
  style: React.CSSProperties;
}> = [
  {
    dir: 'nw',
    cursor: 'nwse-resize',
    style: { top: -4, left: -4 },
  },
  {
    dir: 'n',
    cursor: 'ns-resize',
    style: { top: -4, left: '50%', transform: 'translateX(-50%)' },
  },
  {
    dir: 'ne',
    cursor: 'nesw-resize',
    style: { top: -4, right: -4 },
  },
  {
    dir: 'e',
    cursor: 'ew-resize',
    style: { top: '50%', right: -4, transform: 'translateY(-50%)' },
  },
  {
    dir: 'se',
    cursor: 'nwse-resize',
    style: { bottom: -4, right: -4 },
  },
  {
    dir: 's',
    cursor: 'ns-resize',
    style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' },
  },
  {
    dir: 'sw',
    cursor: 'nesw-resize',
    style: { bottom: -4, left: -4 },
  },
  {
    dir: 'w',
    cursor: 'ew-resize',
    style: { top: '50%', left: -4, transform: 'translateY(-50%)' },
  },
];

/**
 * 8-Point Visual Transform & Resize Handles (STORA-120).
 * Supports aspect ratio lock (Shift key), live dimension tooltip (W: Xpx H: Ypx),
 * 60 FPS performance via requestAnimationFrame (STORA-125), and snapping integration (STORA-123).
 */
export const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  selectedNodeId,
  selectedRect,
  zoom = 1,
  candidateRects = [],
  onGuidesChange,
  onResizeEnd,
}) => {
  const { updateNodeStyle } = useEditorStore();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  dragStateRef.current = dragState;

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    handle: ResizeHandleDirection,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Set pointer capture if available
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore in headless / test environments
    }

    const initialWidth = Math.max(10, selectedRect.width);
    const initialHeight = Math.max(10, selectedRect.height);
    const initialTop = selectedRect.top;
    const initialLeft = selectedRect.left;
    const aspectRatio = initialWidth / initialHeight;

    const initialDrag: DragState = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialWidth,
      initialHeight,
      initialTop,
      initialLeft,
      aspectRatio,
      currentWidth: initialWidth,
      currentHeight: initialHeight,
      currentTop: initialTop,
      currentLeft: initialLeft,
    };

    setDragState(initialDrag);
  };

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;

      const scale = zoom > 0 ? zoom : 1;
      const deltaX = (e.clientX - currentDrag.startX) / scale;
      const deltaY = (e.clientY - currentDrag.startY) / scale;
      const { handle, initialWidth, initialHeight, initialTop, initialLeft, aspectRatio } =
        currentDrag;

      let newWidth = initialWidth;
      let newHeight = initialHeight;
      let newTop = initialTop;
      let newLeft = initialLeft;

      // Handle horizontal sizing
      if (handle === 'e' || handle === 'ne' || handle === 'se') {
        newWidth = Math.max(10, initialWidth + deltaX);
      } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
        const potentialWidth = initialWidth - deltaX;
        if (potentialWidth >= 10) {
          newWidth = potentialWidth;
          newLeft = initialLeft + deltaX;
        } else {
          newWidth = 10;
          newLeft = initialLeft + (initialWidth - 10);
        }
      }

      // Handle vertical sizing
      if (handle === 's' || handle === 'se' || handle === 'sw') {
        newHeight = Math.max(10, initialHeight + deltaY);
      } else if (handle === 'n' || handle === 'ne' || handle === 'nw') {
        const potentialHeight = initialHeight - deltaY;
        if (potentialHeight >= 10) {
          newHeight = potentialHeight;
          newTop = initialTop + deltaY;
        } else {
          newHeight = 10;
          newTop = initialTop + (initialHeight - 10);
        }
      }

      // Shift key: Lock aspect ratio
      if (e.shiftKey) {
        if (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se') {
          const deltaW = newWidth - initialWidth;
          const deltaH = newHeight - initialHeight;
          if (Math.abs(deltaW) > Math.abs(deltaH * aspectRatio)) {
            newHeight = Math.max(10, newWidth / aspectRatio);
          } else {
            newWidth = Math.max(10, newHeight * aspectRatio);
          }
        } else if (handle === 'e' || handle === 'w') {
          newHeight = Math.max(10, newWidth / aspectRatio);
        } else if (handle === 'n' || handle === 's') {
          newWidth = Math.max(10, newHeight * aspectRatio);
        }
      }

      // Snapping check (STORA-123)
      if (candidateRects.length > 0) {
        const snapResult = calculateSnapping(
          { top: newTop, left: newLeft, width: newWidth, height: newHeight },
          candidateRects,
          5,
        );
        onGuidesChange?.(snapResult.guides);
      }

      // STORA-125: requestAnimationFrame batching for 60 FPS performance
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        // Direct DOM update for high-speed drag layer
        if (overlayRef.current) {
          overlayRef.current.style.width = `${Math.round(newWidth)}px`;
          overlayRef.current.style.height = `${Math.round(newHeight)}px`;
          overlayRef.current.style.top = `${Math.round(newTop)}px`;
          overlayRef.current.style.left = `${Math.round(newLeft)}px`;
        }
        if (tooltipRef.current) {
          tooltipRef.current.innerText = `W: ${Math.round(newWidth)}px  H: ${Math.round(newHeight)}px`;
        }

        setDragState((prev) =>
          prev
            ? {
                ...prev,
                currentWidth: newWidth,
                currentHeight: newHeight,
                currentTop: newTop,
                currentLeft: newLeft,
              }
            : null,
        );
      });
    },
    [zoom, candidateRects, onGuidesChange],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      if (!currentDrag) return;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      onGuidesChange?.([]);

      const finalWidth = Math.round(currentDrag.currentWidth);
      const finalHeight = Math.round(currentDrag.currentHeight);

      // Commit to store style
      updateNodeStyle(
        selectedNodeId,
        {
          width: `${finalWidth}px`,
          height: `${finalHeight}px`,
        },
        'base',
        true,
      );

      onResizeEnd?.(finalWidth, finalHeight);
      setDragState(null);
    },
    [selectedNodeId, updateNodeStyle, onGuidesChange, onResizeEnd],
  );

  useEffect(() => {
    if (dragState) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      };
    }
  }, [dragState, handlePointerMove, handlePointerUp]);

  const activeRect = dragState
    ? {
        top: dragState.currentTop,
        left: dragState.currentLeft,
        width: dragState.currentWidth,
        height: dragState.currentHeight,
      }
    : selectedRect;

  return (
    <div
      ref={overlayRef}
      data-testid="resize-handles-container"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: `${activeRect.top}px`,
        left: `${activeRect.left}px`,
        width: `${activeRect.width}px`,
        height: `${activeRect.height}px`,
        pointerEvents: 'none',
        zIndex: 50,
        boxSizing: 'border-box',
      }}
    >
      {/* 8 visual handles */}
      {HANDLES.map(({ dir, cursor, style }) => (
        <div
          key={dir}
          data-testid={`resize-handle-${dir}`}
          onPointerDown={(e) => handlePointerDown(e, dir)}
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            backgroundColor: '#ffffff',
            border: '1.5px solid #3b82f6',
            borderRadius: '1px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'auto',
            cursor,
            zIndex: 51,
            boxSizing: 'border-box',
            ...style,
          }}
        />
      ))}

      {/* Live dimensions tooltip (STORA-120) */}
      {dragState && (
        <div
          ref={tooltipRef}
          data-testid="resize-dimension-tooltip"
          style={{
            position: 'absolute',
            bottom: '-28px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1e293b',
            color: '#ffffff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            zIndex: 52,
          }}
        >
          {`W: ${Math.round(dragState.currentWidth)}px  H: ${Math.round(dragState.currentHeight)}px`}
        </div>
      )}
    </div>
  );
};
