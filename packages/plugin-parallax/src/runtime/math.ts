/**
 * Pure geometry for the parallax runtimes — no DOM access, so it is unit-testable and the
 * same numbers come out in the editor canvas and on a published page.
 */
import { clamp, type Box } from '@kubuild/effect-kit/dom';

export { clamp, scrollProgress, type Box } from '@kubuild/effect-kit/dom';

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Signed distance (px) between the element's center and the viewport's center. */
export function centerOffset(element: Box, viewport: Box): number {
  return element.top + element.height / 2 - (viewport.top + viewport.height / 2);
}

/**
 * Element-parallax translation: an element with `speed` 0.3 lags 30% behind the scroll, so
 * it appears further away; a negative speed makes it lead. Zero when centered, which keeps
 * the authored layout exactly as designed at the moment the user looks at it.
 */
export function parallaxOffset(element: Box, viewport: Box, speed: number): number {
  return -centerOffset(element, viewport) * speed;
}

/**
 * Background-position Y (in %) for background parallax. Percentages only ever move the
 * image within its own overflow, so a large `speed` can never reveal a gap above or below
 * the image — it just saturates at 0% / 100%.
 */
export function backgroundPositionPercent(progress: number, speed: number): number {
  return clamp(50 + (progress - 0.5) * 2 * speed * 50, 0, 100);
}

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export function ease(t: number, easing: EasingName): number {
  switch (easing) {
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default:
      return t;
  }
}

/** Maps overall scroll progress into the [start, end] window, eased, as 0..1. */
export function windowedProgress(progress: number, start: number, end: number, easing: EasingName): number {
  if (end <= start) return progress >= end ? 1 : 0;
  return ease(clamp((progress - start) / (end - start), 0, 1), easing);
}

/** Pointer position relative to a box, normalized to -1..1 on each axis (0 = center). */
export function normalizedPointer(
  clientX: number,
  clientY: number,
  box: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const x = box.width > 0 ? ((clientX - box.left) / box.width) * 2 - 1 : 0;
  const y = box.height > 0 ? ((clientY - box.top) / box.height) * 2 - 1 : 0;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}
