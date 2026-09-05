import React from 'react';
import { CanvasRect } from './smart-guides';

export interface MarqueeRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface NodeRectEntry {
  id: string;
  rect: CanvasRect;
}

export function rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
  return !(
    a.left > b.left + b.width ||
    a.left + a.width < b.left ||
    a.top > b.top + b.height ||
    a.top + a.height < b.top
  );
}

/**
 * Calculates which nodes in `nodes` intersect with the given `marqueeRect` (STORA-133).
 */
export function calculateMarqueeIntersections(
  marqueeRect: CanvasRect,
  nodes: NodeRectEntry[],
): string[] {
  return nodes
    .filter((entry) => rectsIntersect(marqueeRect, entry.rect))
    .map((entry) => entry.id);
}

export interface MarqueeSelectionBoxProps {
  rect: MarqueeRect | null;
}

/**
 * Marquee Drag Selection Box component (STORA-133).
 */
export const MarqueeSelectionBox: React.FC<MarqueeSelectionBoxProps> = ({ rect }) => {
  if (!rect || rect.width < 2 || rect.height < 2) return null;

  return (
    <div
      data-testid="marquee-selection-box"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        border: '1px solid #3b82f6',
        pointerEvents: 'none',
        zIndex: 60,
      }}
    />
  );
};
