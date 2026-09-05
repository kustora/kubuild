import React from 'react';

export interface CanvasRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface GuideLine {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number;
  start: number;
  end: number;
  color: 'cyan' | 'magenta';
  matchedValue?: number;
}

export interface SnappingResult {
  snappedRect: CanvasRect;
  guides: GuideLine[];
  snappedX: boolean;
  snappedY: boolean;
}

/**
 * Calculates snapping of activeRect against reference candidateRects (STORA-123).
 * Threshold: 5px default.
 * Cyan for same-edge alignment (top-top, bottom-bottom, center-center, left-left, right-right).
 * Magenta for opposite-edge alignment (top-bottom, bottom-top, left-right, right-left).
 */
export function calculateSnapping(
  activeRect: CanvasRect,
  candidateRects: CanvasRect[],
  threshold = 5,
): SnappingResult {
  let deltaX = 0;
  let deltaY = 0;
  let snappedX = false;
  let snappedY = false;
  const guides: GuideLine[] = [];

  let minDiffX = threshold + 1;
  let minDiffY = threshold + 1;

  const activeTop = activeRect.top;
  const activeBottom = activeRect.top + activeRect.height;
  const activeCenterY = activeRect.top + activeRect.height / 2;

  const activeLeft = activeRect.left;
  const activeRight = activeRect.left + activeRect.width;
  const activeCenterX = activeRect.left + activeRect.width / 2;

  for (const cand of candidateRects) {
    const candTop = cand.top;
    const candBottom = cand.top + cand.height;
    const candCenterY = cand.top + cand.height / 2;

    const candLeft = cand.left;
    const candRight = cand.left + cand.width;
    const candCenterX = cand.left + cand.width / 2;

    // Y checks
    const yComparisons: Array<{
      activeVal: number;
      candVal: number;
      color: 'cyan' | 'magenta';
      idPrefix: string;
    }> = [
      { activeVal: activeTop, candVal: candTop, color: 'cyan', idPrefix: 'top-top' },
      { activeVal: activeCenterY, candVal: candCenterY, color: 'cyan', idPrefix: 'center-center-y' },
      { activeVal: activeBottom, candVal: candBottom, color: 'cyan', idPrefix: 'bottom-bottom' },
      { activeVal: activeTop, candVal: candBottom, color: 'magenta', idPrefix: 'top-bottom' },
      { activeVal: activeBottom, candVal: candTop, color: 'magenta', idPrefix: 'bottom-top' },
    ];

    for (const comp of yComparisons) {
      const diff = Math.abs(comp.activeVal - comp.candVal);
      if (diff <= threshold && diff < minDiffY) {
        minDiffY = diff;
        deltaY = comp.candVal - comp.activeVal;
        snappedY = true;
      }
    }

    // X checks
    const xComparisons: Array<{
      activeVal: number;
      candVal: number;
      color: 'cyan' | 'magenta';
      idPrefix: string;
    }> = [
      { activeVal: activeLeft, candVal: candLeft, color: 'cyan', idPrefix: 'left-left' },
      { activeVal: activeCenterX, candVal: candCenterX, color: 'cyan', idPrefix: 'center-center-x' },
      { activeVal: activeRight, candVal: candRight, color: 'cyan', idPrefix: 'right-right' },
      { activeVal: activeLeft, candVal: candRight, color: 'magenta', idPrefix: 'left-right' },
      { activeVal: activeRight, candVal: candLeft, color: 'magenta', idPrefix: 'right-left' },
    ];

    for (const comp of xComparisons) {
      const diff = Math.abs(comp.activeVal - comp.candVal);
      if (diff <= threshold && diff < minDiffX) {
        minDiffX = diff;
        deltaX = comp.candVal - comp.activeVal;
        snappedX = true;
      }
    }
  }

  const snappedRect: CanvasRect = {
    top: activeRect.top + deltaY,
    left: activeRect.left + deltaX,
    width: activeRect.width,
    height: activeRect.height,
  };

  // Generate guide lines for candidates that match snapped position
  const snappedTop = snappedRect.top;
  const snappedBottom = snappedRect.top + snappedRect.height;
  const snappedCenterY = snappedRect.top + snappedRect.height / 2;

  const snappedLeft = snappedRect.left;
  const snappedRight = snappedRect.left + snappedRect.width;
  const snappedCenterX = snappedRect.left + snappedRect.width / 2;

  let guideIdx = 0;
  for (const cand of candidateRects) {
    const candTop = cand.top;
    const candBottom = cand.top + cand.height;
    const candCenterY = cand.top + cand.height / 2;

    const candLeft = cand.left;
    const candRight = cand.left + cand.width;
    const candCenterX = cand.left + cand.width / 2;

    const horizStart = Math.min(snappedRect.left, cand.left) - 8;
    const horizEnd = Math.max(snappedRect.left + snappedRect.width, cand.left + cand.width) + 8;

    const vertStart = Math.min(snappedRect.top, cand.top) - 8;
    const vertEnd = Math.max(snappedRect.top + snappedRect.height, cand.top + cand.height) + 8;

    // Check matching horizontal guides
    if (snappedY) {
      if (Math.abs(snappedTop - candTop) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'horizontal',
          position: candTop,
          start: horizStart,
          end: horizEnd,
          color: 'cyan',
          matchedValue: candTop,
        });
      }
      if (Math.abs(snappedCenterY - candCenterY) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'horizontal',
          position: candCenterY,
          start: horizStart,
          end: horizEnd,
          color: 'cyan',
          matchedValue: candCenterY,
        });
      }
      if (Math.abs(snappedBottom - candBottom) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'horizontal',
          position: candBottom,
          start: horizStart,
          end: horizEnd,
          color: 'cyan',
          matchedValue: candBottom,
        });
      }
      if (Math.abs(snappedTop - candBottom) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'horizontal',
          position: candBottom,
          start: horizStart,
          end: horizEnd,
          color: 'magenta',
          matchedValue: candBottom,
        });
      }
      if (Math.abs(snappedBottom - candTop) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'horizontal',
          position: candTop,
          start: horizStart,
          end: horizEnd,
          color: 'magenta',
          matchedValue: candTop,
        });
      }
    }

    // Check matching vertical guides
    if (snappedX) {
      if (Math.abs(snappedLeft - candLeft) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'vertical',
          position: candLeft,
          start: vertStart,
          end: vertEnd,
          color: 'cyan',
          matchedValue: candLeft,
        });
      }
      if (Math.abs(snappedCenterX - candCenterX) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'vertical',
          position: candCenterX,
          start: vertStart,
          end: vertEnd,
          color: 'cyan',
          matchedValue: candCenterX,
        });
      }
      if (Math.abs(snappedRight - candRight) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'vertical',
          position: candRight,
          start: vertStart,
          end: vertEnd,
          color: 'cyan',
          matchedValue: candRight,
        });
      }
      if (Math.abs(snappedLeft - candRight) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'vertical',
          position: candRight,
          start: vertStart,
          end: vertEnd,
          color: 'magenta',
          matchedValue: candRight,
        });
      }
      if (Math.abs(snappedRight - candLeft) < 0.5) {
        guides.push({
          id: `guide-${guideIdx++}`,
          type: 'vertical',
          position: candLeft,
          start: vertStart,
          end: vertEnd,
          color: 'magenta',
          matchedValue: candLeft,
        });
      }
    }
  }

  return {
    snappedRect,
    guides,
    snappedX,
    snappedY,
  };
}

export interface SmartGuidesProps {
  guides: GuideLine[];
}

/**
 * SmartGuides component renders dynamic alignment guide lines (STORA-123).
 */
export const SmartGuides: React.FC<SmartGuidesProps> = ({ guides }) => {
  if (!guides || guides.length === 0) return null;

  return (
    <div
      data-testid="smart-guides-container"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 45,
      }}
    >
      {guides.map((g) => {
        const isHoriz = g.type === 'horizontal';
        const color = g.color === 'cyan' ? '#06b6d4' : '#d946ef';
        const shadow =
          g.color === 'cyan'
            ? '0 0 4px rgba(6, 182, 212, 0.7)'
            : '0 0 4px rgba(217, 70, 239, 0.7)';

        return (
          <div
            key={g.id}
            data-testid="smart-guide-line"
            data-guide-type={g.type}
            data-guide-color={g.color}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              backgroundColor: color,
              boxShadow: shadow,
              zIndex: 45,
              ...(isHoriz
                ? {
                    top: `${g.position}px`,
                    left: `${g.start}px`,
                    width: `${Math.max(1, g.end - g.start)}px`,
                    height: '1px',
                  }
                : {
                    left: `${g.position}px`,
                    top: `${g.start}px`,
                    height: `${Math.max(1, g.end - g.start)}px`,
                    width: '1px',
                  }),
            }}
          />
        );
      })}
    </div>
  );
};
