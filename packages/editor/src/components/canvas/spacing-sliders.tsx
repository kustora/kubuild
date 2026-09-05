import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../store';
import { findNodeById } from '@kubuild/core';
import { PageDocument } from '@kubuild/schema';
import { CanvasRect } from './smart-guides';

export interface SpacingSlidersProps {
  selectedNodeId: string;
  selectedRect: CanvasRect;
  document?: PageDocument;
  containerElement?: HTMLElement | null;
  zoom?: number;
}

type PaddingSide = 'top' | 'right' | 'bottom' | 'left';

interface PaddingDragState {
  side: PaddingSide;
  startY: number;
  startX: number;
  initialPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  currentPadding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

interface GapDragState {
  startX: number;
  startY: number;
  initialGap: number;
  currentGap: number;
  flexDirection: 'row' | 'column';
}

function parsePx(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/**
 * Interactive On-Canvas Padding Drag Sliders (STORA-121) & Gap Drag Slider (STORA-122).
 * Features:
 *  - 4 sides padding drag handles (top, right, bottom, left).
 *  - Alt/Option symmetric drag for opposite sides.
 *  - Tinted semi-transparent padding box (pink/purple).
 *  - On-canvas gap slider between children for flex/grid containers.
 *  - 60 FPS RAF optimization (STORA-125).
 */
export const SpacingSliders: React.FC<SpacingSlidersProps> = ({
  selectedNodeId,
  selectedRect,
  document: propDoc,
  containerElement,
  zoom = 1,
}) => {
  const store = useEditorStore();
  const document = propDoc ?? store.document;
  const updateNodeStyle = store.updateNodeStyle;
  const node = findNodeById(document.document, selectedNodeId);

  const [paddingDrag, setPaddingDrag] = useState<PaddingDragState | null>(null);
  const paddingDragRef = useRef<PaddingDragState | null>(null);
  paddingDragRef.current = paddingDrag;

  const [gapDrag, setGapDrag] = useState<GapDragState | null>(null);
  const gapDragRef = useRef<GapDragState | null>(null);
  gapDragRef.current = gapDrag;

  const rafRef = useRef<number | null>(null);

  // Extract current styles
  const baseStyles = node?.styles?.base || {};
  const initialTop = parsePx(baseStyles.paddingTop ?? baseStyles.padding, 0);
  const initialRight = parsePx(baseStyles.paddingRight ?? baseStyles.padding, 0);
  const initialBottom = parsePx(baseStyles.paddingBottom ?? baseStyles.padding, 0);
  const initialLeft = parsePx(baseStyles.paddingLeft ?? baseStyles.padding, 0);

  const isFlexOrGrid =
    node?.type === 'flex' ||
    node?.type === 'grid' ||
    baseStyles.display === 'flex' ||
    baseStyles.display === 'grid';
  const hasMultipleChildren = (node?.children?.length ?? 0) >= 2;
  const initialGap = parsePx(baseStyles.gap, 16);
  const flexDirection =
    baseStyles.flexDirection === 'row' || baseStyles.flexDirection === 'row-reverse'
      ? 'row'
      : 'column';

  // Current values
  const currentPadding = paddingDrag
    ? paddingDrag.currentPadding
    : {
        top: initialTop,
        right: initialRight,
        bottom: initialBottom,
        left: initialLeft,
      };

  const currentGap = gapDrag ? gapDrag.currentGap : initialGap;

  // --- Padding Drag Logic ---
  const handlePaddingPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    side: PaddingSide,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore in headless / test environment
    }

    const state: PaddingDragState = {
      side,
      startX: e.clientX,
      startY: e.clientY,
      initialPadding: {
        top: initialTop,
        right: initialRight,
        bottom: initialBottom,
        left: initialLeft,
      },
      currentPadding: {
        top: initialTop,
        right: initialRight,
        bottom: initialBottom,
        left: initialLeft,
      },
    };

    setPaddingDrag(state);
  };

  const handlePaddingPointerMove = useCallback(
    (e: PointerEvent) => {
      const active = paddingDragRef.current;
      if (!active) return;

      const scale = zoom > 0 ? zoom : 1;
      const deltaX = (e.clientX - active.startX) / scale;
      const deltaY = (e.clientY - active.startY) / scale;
      const isAlt = e.altKey;

      let nextTop = active.initialPadding.top;
      let nextRight = active.initialPadding.right;
      let nextBottom = active.initialPadding.bottom;
      let nextLeft = active.initialPadding.left;

      if (active.side === 'top') {
        nextTop = Math.max(0, Math.round(active.initialPadding.top + deltaY));
        if (isAlt) {
          nextBottom = nextTop;
        }
      } else if (active.side === 'bottom') {
        nextBottom = Math.max(0, Math.round(active.initialPadding.bottom - deltaY));
        if (isAlt) {
          nextTop = nextBottom;
        }
      } else if (active.side === 'left') {
        nextLeft = Math.max(0, Math.round(active.initialPadding.left + deltaX));
        if (isAlt) {
          nextRight = nextLeft;
        }
      } else if (active.side === 'right') {
        nextRight = Math.max(0, Math.round(active.initialPadding.right - deltaX));
        if (isAlt) {
          nextLeft = nextRight;
        }
      }

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPaddingDrag((prev) =>
          prev
            ? {
                ...prev,
                currentPadding: {
                  top: nextTop,
                  right: nextRight,
                  bottom: nextBottom,
                  left: nextLeft,
                },
              }
            : null,
        );
      });
    },
    [zoom],
  );

  const handlePaddingPointerUp = useCallback(() => {
    const active = paddingDragRef.current;
    if (!active) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const { top, right, bottom, left } = active.currentPadding;
    updateNodeStyle(
      selectedNodeId,
      {
        paddingTop: `${top}px`,
        paddingRight: `${right}px`,
        paddingBottom: `${bottom}px`,
        paddingLeft: `${left}px`,
      },
      'base',
      true,
    );

    setPaddingDrag(null);
  }, [selectedNodeId, updateNodeStyle]);

  useEffect(() => {
    if (paddingDrag) {
      window.addEventListener('pointermove', handlePaddingPointerMove);
      window.addEventListener('pointerup', handlePaddingPointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePaddingPointerMove);
        window.removeEventListener('pointerup', handlePaddingPointerUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [paddingDrag, handlePaddingPointerMove, handlePaddingPointerUp]);

  // --- Gap Drag Logic ---
  const handleGapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const state: GapDragState = {
      startX: e.clientX,
      startY: e.clientY,
      initialGap,
      currentGap: initialGap,
      flexDirection,
    };

    setGapDrag(state);
  };

  const handleGapPointerMove = useCallback(
    (e: PointerEvent) => {
      const active = gapDragRef.current;
      if (!active) return;

      const scale = zoom > 0 ? zoom : 1;
      const delta =
        active.flexDirection === 'row'
          ? (e.clientX - active.startX) / scale
          : (e.clientY - active.startY) / scale;

      const nextGap = Math.max(0, Math.round(active.initialGap + delta));

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setGapDrag((prev) => (prev ? { ...prev, currentGap: nextGap } : null));
      });
    },
    [zoom],
  );

  const handleGapPointerUp = useCallback(() => {
    const active = gapDragRef.current;
    if (!active) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const finalGap = active.currentGap;
    updateNodeStyle(
      selectedNodeId,
      {
        gap: `${finalGap}px`,
      },
      'base',
      true,
    );

    setGapDrag(null);
  }, [selectedNodeId, updateNodeStyle]);

  useEffect(() => {
    if (gapDrag) {
      window.addEventListener('pointermove', handleGapPointerMove);
      window.addEventListener('pointerup', handleGapPointerUp);
      return () => {
        window.removeEventListener('pointermove', handleGapPointerMove);
        window.removeEventListener('pointerup', handleGapPointerUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
  }, [gapDrag, handleGapPointerMove, handleGapPointerUp]);

  if (!node) return null;

  return (
    <div
      data-testid="spacing-sliders-container"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: `${selectedRect.top}px`,
        left: `${selectedRect.left}px`,
        width: `${selectedRect.width}px`,
        height: `${selectedRect.height}px`,
        pointerEvents: 'none',
        zIndex: 48,
        boxSizing: 'border-box',
      }}
    >
      {/* Semi-transparent tinted padding box overlay (pink/purple) */}
      <div
        data-testid="padding-box-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        {/* Top padding strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${Math.max(0, currentPadding.top)}px`,
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            borderBottom: '1px dashed rgba(236, 72, 153, 0.4)',
          }}
        />
        {/* Bottom padding strip */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${Math.max(0, currentPadding.bottom)}px`,
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            borderTop: '1px dashed rgba(236, 72, 153, 0.4)',
          }}
        />
        {/* Left padding strip */}
        <div
          style={{
            position: 'absolute',
            top: `${currentPadding.top}px`,
            left: 0,
            width: `${Math.max(0, currentPadding.left)}px`,
            height: `${Math.max(0, selectedRect.height - currentPadding.top - currentPadding.bottom)}px`,
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            borderRight: '1px dashed rgba(236, 72, 153, 0.4)',
          }}
        />
        {/* Right padding strip */}
        <div
          style={{
            position: 'absolute',
            top: `${currentPadding.top}px`,
            right: 0,
            width: `${Math.max(0, currentPadding.right)}px`,
            height: `${Math.max(0, selectedRect.height - currentPadding.top - currentPadding.bottom)}px`,
            backgroundColor: 'rgba(236, 72, 153, 0.12)',
            borderLeft: '1px dashed rgba(236, 72, 153, 0.4)',
          }}
        />
      </div>

      {/* 4 Interactive Padding Handles */}
      {/* Top Handle */}
      <div
        data-testid="padding-handle-top"
        title="Drag Padding Top (Hold Alt for symmetric)"
        onPointerDown={(e) => handlePaddingPointerDown(e, 'top')}
        style={{
          position: 'absolute',
          top: `${Math.max(0, currentPadding.top) - 4}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '24px',
          height: '8px',
          backgroundColor: '#ec4899',
          borderRadius: '4px',
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          zIndex: 49,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Bottom Handle */}
      <div
        data-testid="padding-handle-bottom"
        title="Drag Padding Bottom (Hold Alt for symmetric)"
        onPointerDown={(e) => handlePaddingPointerDown(e, 'bottom')}
        style={{
          position: 'absolute',
          bottom: `${Math.max(0, currentPadding.bottom) - 4}px`,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '24px',
          height: '8px',
          backgroundColor: '#ec4899',
          borderRadius: '4px',
          cursor: 'ns-resize',
          pointerEvents: 'auto',
          zIndex: 49,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Left Handle */}
      <div
        data-testid="padding-handle-left"
        title="Drag Padding Left (Hold Alt for symmetric)"
        onPointerDown={(e) => handlePaddingPointerDown(e, 'left')}
        style={{
          position: 'absolute',
          left: `${Math.max(0, currentPadding.left) - 4}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '8px',
          height: '24px',
          backgroundColor: '#ec4899',
          borderRadius: '4px',
          cursor: 'ew-resize',
          pointerEvents: 'auto',
          zIndex: 49,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Right Handle */}
      <div
        data-testid="padding-handle-right"
        title="Drag Padding Right (Hold Alt for symmetric)"
        onPointerDown={(e) => handlePaddingPointerDown(e, 'right')}
        style={{
          position: 'absolute',
          right: `${Math.max(0, currentPadding.right) - 4}px`,
          top: '50%',
          transform: 'translateY(-50%)',
          width: '8px',
          height: '24px',
          backgroundColor: '#ec4899',
          borderRadius: '4px',
          cursor: 'ew-resize',
          pointerEvents: 'auto',
          zIndex: 49,
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />

      {/* Padding Drag Live Tooltip */}
      {paddingDrag && (
        <div
          data-testid="padding-tooltip"
          style={{
            position: 'absolute',
            top: '-26px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#831843',
            color: '#ffffff',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 52,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        >
          {`Padding ${paddingDrag.side.toUpperCase()}: ${currentPadding[paddingDrag.side]}px`}
        </div>
      )}

      {/* STORA-122: On-Canvas Gap Drag Slider for flex/grid containers with >=2 children */}
      {isFlexOrGrid && hasMultipleChildren && (
        <div
          data-testid="gap-slider-overlay"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            zIndex: 50,
          }}
        >
          <div
            data-testid="gap-slider-handle"
            title="Drag to adjust Gap"
            onPointerDown={handleGapPointerDown}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 8px',
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: 600,
              cursor: flexDirection === 'row' ? 'ew-resize' : 'ns-resize',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
              userSelect: 'none',
              border: '1px solid rgba(255, 255, 255, 0.4)',
            }}
          >
            <span>{`Gap: ${currentGap}px`}</span>
          </div>

          {gapDrag && (
            <div
              data-testid="gap-tooltip"
              style={{
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: '#4c1d95',
                color: '#ffffff',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 52,
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }}
            >
              {`Gap: ${currentGap}px`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
