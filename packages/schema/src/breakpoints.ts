/**
 * Single source of truth for responsive breakpoints (STORA-541).
 *
 * Every consumer that maps a screen width to a `ResponsiveStyles` layer — the editor's
 * viewport switcher/resizer, the runtime renderer's `@media` output, the preview adapter
 * and the static code generator — must read these values instead of hard-coding numbers.
 *
 * Ranges are disjoint and mirror the editor's per-viewport preview exactly: a viewport's
 * effective style is `base` merged with *that one* layer (tablet does not cascade into
 * mobile, desktop does not leak into tablet/mobile).
 *
 *   mobile  :        width <  768px
 *   tablet  : 768 <= width < 1024px
 *   desktop : 1024 <= width
 *
 * 768/1024 were chosen over the older 640/1024 code-generator values because they match
 * the published docs, the editor's existing width→viewport logic and its default tablet
 * preview width (768px), so what users see in the editor is what ships.
 */

/** Viewport layers that carry breakpoint overrides (`base` applies everywhere). */
export type BreakpointName = 'desktop' | 'tablet' | 'mobile';

export interface BreakpointRange {
  /** Inclusive lower bound in CSS px. */
  readonly minWidth: number;
  /** Inclusive upper bound in CSS px, or `null` for unbounded. */
  readonly maxWidth: number | null;
}

export const BREAKPOINTS: Readonly<Record<BreakpointName, BreakpointRange>> = Object.freeze({
  mobile: Object.freeze({ minWidth: 0, maxWidth: 767 }),
  tablet: Object.freeze({ minWidth: 768, maxWidth: 1023 }),
  desktop: Object.freeze({ minWidth: 1024, maxWidth: null }),
});

/** Order used for emitting CSS and iterating layers (widest first). */
export const BREAKPOINT_ORDER: readonly BreakpointName[] = Object.freeze([
  'desktop',
  'tablet',
  'mobile',
]);

/**
 * Upper bounds are emitted as `maxWidth + 0.98px` (e.g. `767.98px`) so fractional
 * viewport widths (zoomed / high-DPI browsers) never fall in a gap between ranges.
 */
function formatMaxWidth(maxWidth: number): string {
  return `${maxWidth + 0.98}px`;
}

/** CSS media query (without the `@media` keyword) for each breakpoint layer. */
export const BREAKPOINT_MEDIA_QUERIES: Readonly<Record<BreakpointName, string>> = Object.freeze({
  desktop: `(min-width: ${BREAKPOINTS.desktop.minWidth}px)`,
  tablet: `(min-width: ${BREAKPOINTS.tablet.minWidth}px) and (max-width: ${formatMaxWidth(
    BREAKPOINTS.tablet.maxWidth as number,
  )})`,
  mobile: `(max-width: ${formatMaxWidth(BREAKPOINTS.mobile.maxWidth as number)})`,
});

/** Resolve which breakpoint layer applies at a given viewport width in CSS px. */
export function getBreakpointForWidth(width: number): BreakpointName {
  if (width < BREAKPOINTS.tablet.minWidth) return 'mobile';
  if (width < BREAKPOINTS.desktop.minWidth) return 'tablet';
  return 'desktop';
}
