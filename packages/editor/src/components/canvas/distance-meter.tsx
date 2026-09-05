import React from 'react';
import { CanvasRect } from './smart-guides';

export interface DistanceMeasurement {
  id: string;
  type: 'horizontal' | 'vertical';
  distance: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  badgeX: number;
  badgeY: number;
}

export interface DistanceMeterProps {
  selectedRect: CanvasRect;
  targetRect: CanvasRect;
}

/**
 * Calculates distance measurement lines and pixel badges between two bounding boxes (STORA-124).
 */
export function calculateDistances(
  selected: CanvasRect,
  target: CanvasRect,
): DistanceMeasurement[] {
  const measurements: DistanceMeasurement[] = [];

  const selRight = selected.left + selected.width;
  const selBottom = selected.top + selected.height;
  const selCenterX = selected.left + selected.width / 2;
  const selCenterY = selected.top + selected.height / 2;

  const tgtRight = target.left + target.width;
  const tgtBottom = target.top + target.height;
  const tgtCenterX = target.left + target.width / 2;
  const tgtCenterY = target.top + target.height / 2;

  // Check if target contains selected (parent/ancestor)
  const isTargetContainer =
    target.left <= selected.left &&
    tgtRight >= selRight &&
    target.top <= selected.top &&
    tgtBottom >= selBottom;

  // Check if selected contains target
  const isSelectedContainer =
    selected.left <= target.left &&
    selRight >= tgtRight &&
    selected.top <= target.top &&
    selBottom >= tgtBottom;

  if (isTargetContainer) {
    // 4 inner distances to parent edges
    const dTop = selected.top - target.top;
    if (dTop > 0) {
      measurements.push({
        id: 'inner-top',
        type: 'vertical',
        distance: Math.round(dTop),
        startX: selCenterX,
        startY: target.top,
        endX: selCenterX,
        endY: selected.top,
        badgeX: selCenterX,
        badgeY: target.top + dTop / 2,
      });
    }

    const dBottom = tgtBottom - selBottom;
    if (dBottom > 0) {
      measurements.push({
        id: 'inner-bottom',
        type: 'vertical',
        distance: Math.round(dBottom),
        startX: selCenterX,
        startY: selBottom,
        endX: selCenterX,
        endY: tgtBottom,
        badgeX: selCenterX,
        badgeY: selBottom + dBottom / 2,
      });
    }

    const dLeft = selected.left - target.left;
    if (dLeft > 0) {
      measurements.push({
        id: 'inner-left',
        type: 'horizontal',
        distance: Math.round(dLeft),
        startX: target.left,
        startY: selCenterY,
        endX: selected.left,
        endY: selCenterY,
        badgeX: target.left + dLeft / 2,
        badgeY: selCenterY,
      });
    }

    const dRight = tgtRight - selRight;
    if (dRight > 0) {
      measurements.push({
        id: 'inner-right',
        type: 'horizontal',
        distance: Math.round(dRight),
        startX: selRight,
        startY: selCenterY,
        endX: tgtRight,
        endY: selCenterY,
        badgeX: selRight + dRight / 2,
        badgeY: selCenterY,
      });
    }

    return measurements;
  }

  if (isSelectedContainer) {
    // 4 inner distances from child to selected edges
    const dTop = target.top - selected.top;
    if (dTop > 0) {
      measurements.push({
        id: 'inner-child-top',
        type: 'vertical',
        distance: Math.round(dTop),
        startX: tgtCenterX,
        startY: selected.top,
        endX: tgtCenterX,
        endY: target.top,
        badgeX: tgtCenterX,
        badgeY: selected.top + dTop / 2,
      });
    }

    const dBottom = selBottom - tgtBottom;
    if (dBottom > 0) {
      measurements.push({
        id: 'inner-child-bottom',
        type: 'vertical',
        distance: Math.round(dBottom),
        startX: tgtCenterX,
        startY: tgtBottom,
        endX: tgtCenterX,
        endY: selBottom,
        badgeX: tgtCenterX,
        badgeY: tgtBottom + dBottom / 2,
      });
    }

    const dLeft = target.left - selected.left;
    if (dLeft > 0) {
      measurements.push({
        id: 'inner-child-left',
        type: 'horizontal',
        distance: Math.round(dLeft),
        startX: selected.left,
        startY: tgtCenterY,
        endX: target.left,
        endY: tgtCenterY,
        badgeX: selected.left + dLeft / 2,
        badgeY: tgtCenterY,
      });
    }

    const dRight = selRight - tgtRight;
    if (dRight > 0) {
      measurements.push({
        id: 'inner-child-right',
        type: 'horizontal',
        distance: Math.round(dRight),
        startX: tgtRight,
        startY: tgtCenterY,
        endX: selRight,
        endY: tgtCenterY,
        badgeX: tgtRight + dRight / 2,
        badgeY: tgtCenterY,
      });
    }

    return measurements;
  }

  // Disjoint or sibling nodes
  // Horizontal gap calculation
  let midY = selCenterY;
  // If there is vertical overlap, anchor horizontal line at center of overlap
  const overlapTop = Math.max(selected.top, target.top);
  const overlapBottom = Math.min(selBottom, tgtBottom);
  if (overlapBottom > overlapTop) {
    midY = (overlapTop + overlapBottom) / 2;
  }

  if (target.left >= selRight) {
    const gapX = target.left - selRight;
    measurements.push({
      id: 'sibling-gap-right',
      type: 'horizontal',
      distance: Math.round(gapX),
      startX: selRight,
      startY: midY,
      endX: target.left,
      endY: midY,
      badgeX: selRight + gapX / 2,
      badgeY: midY,
    });
  } else if (selected.left >= tgtRight) {
    const gapX = selected.left - tgtRight;
    measurements.push({
      id: 'sibling-gap-left',
      type: 'horizontal',
      distance: Math.round(gapX),
      startX: tgtRight,
      startY: midY,
      endX: selected.left,
      endY: midY,
      badgeX: tgtRight + gapX / 2,
      badgeY: midY,
    });
  }

  // Vertical gap calculation
  let midX = selCenterX;
  // If there is horizontal overlap, anchor vertical line at center of overlap
  const overlapLeft = Math.max(selected.left, target.left);
  const overlapRight = Math.min(selRight, tgtRight);
  if (overlapRight > overlapLeft) {
    midX = (overlapLeft + overlapRight) / 2;
  }

  if (target.top >= selBottom) {
    const gapY = target.top - selBottom;
    measurements.push({
      id: 'sibling-gap-bottom',
      type: 'vertical',
      distance: Math.round(gapY),
      startX: midX,
      startY: selBottom,
      endX: midX,
      endY: target.top,
      badgeX: midX,
      badgeY: selBottom + gapY / 2,
    });
  } else if (selected.top >= tgtBottom) {
    const gapY = selected.top - tgtBottom;
    measurements.push({
      id: 'sibling-gap-top',
      type: 'vertical',
      distance: Math.round(gapY),
      startX: midX,
      startY: tgtBottom,
      endX: midX,
      endY: selected.top,
      badgeX: midX,
      badgeY: tgtBottom + gapY / 2,
    });
  }

  return measurements;
}

/**
 * Distance Meter component on Alt/Option hold (STORA-124).
 * Renders measurement lines with pixel badges between selected and hovered nodes.
 */
export const DistanceMeter: React.FC<DistanceMeterProps> = ({
  selectedRect,
  targetRect,
}) => {
  const measurements = calculateDistances(selectedRect, targetRect);

  if (measurements.length === 0) return null;

  return (
    <div
      data-testid="distance-meter-container"
      role="presentation"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 55,
      }}
    >
      {measurements.map((m) => {
        const isHoriz = m.type === 'horizontal';
        const length = isHoriz
          ? Math.abs(m.endX - m.startX)
          : Math.abs(m.endY - m.startY);
        const top = isHoriz ? m.startY : Math.min(m.startY, m.endY);
        const left = isHoriz ? Math.min(m.startX, m.endX) : m.startX;

        return (
          <React.Fragment key={m.id}>
            {/* Measurement Line */}
            <div
              data-testid="distance-meter-line"
              data-distance-type={m.type}
              style={{
                position: 'absolute',
                backgroundColor: '#ef4444',
                pointerEvents: 'none',
                ...(isHoriz
                  ? {
                      top: `${top}px`,
                      left: `${left}px`,
                      width: `${length}px`,
                      height: '1px',
                    }
                  : {
                      top: `${top}px`,
                      left: `${left}px`,
                      width: '1px',
                      height: `${length}px`,
                    }),
              }}
            />

            {/* Pixel Distance Badge */}
            <div
              data-testid="distance-badge"
              style={{
                position: 'absolute',
                top: `${m.badgeY}px`,
                left: `${m.badgeX}px`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                padding: '1px 5px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                zIndex: 56,
              }}
            >
              {`${m.distance}px`}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
