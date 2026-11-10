/**
 * @kubuild/html-import
 * Responsive stylesheet processing: @media query to breakpoint mapping,
 * pseudo-class to state mapping, delta computation, and ResponsiveStyles compilation.
 */

import {
  BREAKPOINTS,
  getBreakpointForWidth,
  type BreakpointName,
  type ResponsiveStyles,
  type StyleDefinition,
} from '@kubuild/schema';
import type { ComputedElementStyles } from './cascade.js';
import { addDiagnostic, type HtmlImportReport } from './types.js';

/**
 * Result of parsing width constraints from a CSS @media query string.
 */
export interface ParsedMediaQueryWidth {
  minWidth: number | null;
  maxWidth: number | null;
  hasWidthConstraint: boolean;
  isPrintOrSpeech: boolean;
}

/**
 * Result of resolving a media query to a KUBUILD breakpoint.
 */
export interface BreakpointMappingResult {
  breakpoint: BreakpointName;
  approximated: boolean;
  minWidth: number | null;
  maxWidth: number | null;
}

/**
 * Standard pixel conversion for rem/em length values (assumes 16px root font size).
 */
export const BASE_FONT_SIZE_PX = 16;

/**
 * Map of recognized pseudo-classes and attribute selectors to KUBUILD state keys.
 */
export const PSEUDO_CLASS_TO_STATE_KEY: Readonly<Record<string, string>> = Object.freeze({
  ':hover': 'hover',
  hover: 'hover',
  ':focus': 'focus',
  focus: 'focus',
  ':active': 'active',
  active: 'active',
  ':focus-visible': 'focusVisible',
  'focus-visible': 'focusVisible',
  focusvisible: 'focusVisible',
  focusVisible: 'focusVisible',
  ':disabled': 'disabled',
  disabled: 'disabled',
  '[disabled]': 'disabled',
});

/**
 * Converts a raw numeric string and unit to CSS pixels.
 * rem and em units are converted using 16px base font size.
 */
function parseLengthToPx(rawNum: string, rawUnit?: string): number {
  const num = parseFloat(rawNum);
  if (Number.isNaN(num)) return 0;
  const unit = (rawUnit || 'px').toLowerCase();
  if (unit === 'rem' || unit === 'em') {
    return num * BASE_FONT_SIZE_PX;
  }
  return num;
}

/**
 * Extracts width constraints (min-width, max-width in px) from a CSS @media query string.
 * Converts rem and em units to px using a 16px base font size.
 * Returns null if the media query is empty or invalid.
 */
export function parseMediaQueryWidth(mediaQuery: string): ParsedMediaQueryWidth | null {
  if (!mediaQuery || typeof mediaQuery !== 'string') {
    return null;
  }

  const query = mediaQuery.replace(/^\s*@media\s+/i, '').trim();
  if (!query) {
    return null;
  }

  // Check for non-width media types like print or speech
  if (/\b(print|speech)\b/i.test(query)) {
    return {
      minWidth: null,
      maxWidth: null,
      hasWidthConstraint: false,
      isPrintOrSpeech: true,
    };
  }

  let minWidth: number | null = null;
  let maxWidth: number | null = null;

  // 1. Traditional syntax: min-width: <val>
  const minMatches = query.matchAll(/min-width\s*:\s*([0-9.]+)\s*(px|rem|em)?/gi);
  for (const match of minMatches) {
    const val = parseLengthToPx(match[1], match[2]);
    minWidth = minWidth !== null ? Math.max(minWidth, val) : val;
  }

  // 2. Traditional syntax: max-width: <val>
  const maxMatches = query.matchAll(/max-width\s*:\s*([0-9.]+)\s*(px|rem|em)?/gi);
  for (const match of maxMatches) {
    const val = parseLengthToPx(match[1], match[2]);
    maxWidth = maxWidth !== null ? Math.min(maxWidth, val) : val;
  }

  // 3. Level 4 range syntax: width <= <val>, width < <val>
  const rangeMaxMatches = query.matchAll(/width\s*(<=|<)\s*([0-9.]+)\s*(px|rem|em)?/gi);
  for (const match of rangeMaxMatches) {
    let val = parseLengthToPx(match[2], match[3]);
    if (match[1] === '<') {
      val = val <= 768 ? 767 : val - 0.02;
    }
    maxWidth = maxWidth !== null ? Math.min(maxWidth, val) : val;
  }

  // 4. Level 4 range syntax: <val> <= width, <val> < width
  const rangeMinPreMatches = query.matchAll(/([0-9.]+)\s*(px|rem|em)?\s*(<=|<)\s*width/gi);
  for (const match of rangeMinPreMatches) {
    let val = parseLengthToPx(match[1], match[2]);
    if (match[3] === '<') {
      val = val >= 767 ? 768 : val + 0.02;
    }
    minWidth = minWidth !== null ? Math.max(minWidth, val) : val;
  }

  // 5. Level 4 range syntax: width >= <val>, width > <val>
  const rangeMinMatches = query.matchAll(/width\s*(>=|>)\s*([0-9.]+)\s*(px|rem|em)?/gi);
  for (const match of rangeMinMatches) {
    let val = parseLengthToPx(match[2], match[3]);
    if (match[1] === '>') {
      val = val >= 767 ? 768 : val + 0.02;
    }
    minWidth = minWidth !== null ? Math.max(minWidth, val) : val;
  }

  const hasWidthConstraint = minWidth !== null || maxWidth !== null;

  return {
    minWidth,
    maxWidth,
    hasWidthConstraint,
    isPrintOrSpeech: false,
  };
}

/**
 * Resolves parsed width constraints to the nearest KUBUILD breakpoint
 * (desktop >= 1024px, tablet 768..1023px, mobile < 768px).
 * Identifies whether the mapping was approximated from a custom boundary.
 */
export function resolveBreakpointMapping(
  parsed: ParsedMediaQueryWidth,
): BreakpointMappingResult | null {
  if (!parsed.hasWidthConstraint || parsed.isPrintOrSpeech) {
    return null;
  }

  const { minWidth, maxWidth } = parsed;

  // Case 1: Exact matches against standard KUBUILD breakpoints
  // Mobile exact: max-width <= 767.99 (e.g. 767px, 767.98px) without min-width
  if (
    (minWidth === null || minWidth === 0) &&
    maxWidth !== null &&
    Math.abs(maxWidth - BREAKPOINTS.mobile.maxWidth!) < 1
  ) {
    return {
      breakpoint: 'mobile',
      approximated: false,
      minWidth,
      maxWidth,
    };
  }

  // Desktop exact: min-width >= 1024px without max-width
  if (
    minWidth !== null &&
    Math.abs(minWidth - BREAKPOINTS.desktop.minWidth) < 1 &&
    maxWidth === null
  ) {
    return {
      breakpoint: 'desktop',
      approximated: false,
      minWidth,
      maxWidth,
    };
  }

  // Tablet exact:
  // a) (min-width: 768px) and (max-width: 1023px / 1023.98px / 1024px)
  // b) (min-width: 768px) alone
  if (
    minWidth !== null &&
    Math.abs(minWidth - BREAKPOINTS.tablet.minWidth) < 1 &&
    (maxWidth === null ||
      (maxWidth >= BREAKPOINTS.tablet.maxWidth! && maxWidth <= BREAKPOINTS.desktop.minWidth))
  ) {
    return {
      breakpoint: 'tablet',
      approximated: false,
      minWidth,
      maxWidth,
    };
  }

  // Case 2: Custom / Non-standard boundaries (Approximated)
  let target: BreakpointName;

  if (minWidth !== null && maxWidth !== null) {
    const mid = (minWidth + maxWidth) / 2;
    target = getBreakpointForWidth(mid);
  } else if (maxWidth !== null) {
    target = getBreakpointForWidth(maxWidth);
  } else if (minWidth !== null) {
    target = getBreakpointForWidth(minWidth);
  } else {
    return null;
  }

  return {
    breakpoint: target,
    approximated: true,
    minWidth,
    maxWidth,
  };
}

/**
 * Maps a CSS @media query condition to the nearest KUBUILD breakpoint
 * ('desktop' | 'tablet' | 'mobile').
 *
 * If the media query has a custom boundary (e.g. max-width: 900px, min-width: 600px),
 * it maps to the closest breakpoint and records a CSS_MEDIA_APPROXIMATED diagnostic
 * with severity 'info'.
 * Non-width media queries (print, speech, prefers-color-scheme) return null without throwing.
 */
export function mapMediaQueryToBreakpoint(
  mediaQuery: string,
  report?: HtmlImportReport,
): BreakpointName | null {
  if (!mediaQuery || typeof mediaQuery !== 'string') {
    return null;
  }

  // Handle comma-separated media queries (e.g. "(max-width: 767px), (max-device-width: 767px)")
  const subQueries = mediaQuery.includes(',') ? mediaQuery.split(',') : [mediaQuery];

  for (const rawSub of subQueries) {
    const sub = rawSub.trim();
    if (!sub) continue;

    const parsed = parseMediaQueryWidth(sub);
    if (!parsed || !parsed.hasWidthConstraint || parsed.isPrintOrSpeech) {
      continue;
    }

    const mapping = resolveBreakpointMapping(parsed);
    if (!mapping) {
      continue;
    }

    if (mapping.approximated && report) {
      addDiagnostic(report, {
        code: 'CSS_MEDIA_APPROXIMATED',
        severity: 'info',
        message: `Media query "${mediaQuery.trim()}" was approximated to nearest breakpoint "${mapping.breakpoint}"`,
        details: {
          originalQuery: mediaQuery.trim(),
          mappedBreakpoint: mapping.breakpoint,
          minWidth: mapping.minWidth ?? undefined,
          maxWidth: mapping.maxWidth ?? undefined,
        },
      });
    }

    return mapping.breakpoint;
  }

  return null;
}

/**
 * Maps a CSS pseudo-class or attribute selector (e.g. :hover, :focus, [disabled])
 * to its corresponding KUBUILD state key ('hover' | 'focus' | 'active' | 'focusVisible' | 'disabled').
 * Returns null for unsupported pseudo-classes (e.g. :first-child, :visited).
 */
export function mapPseudoClassToState(pseudoClass: string): string | null {
  if (!pseudoClass || typeof pseudoClass !== 'string') {
    return null;
  }
  const normalized = pseudoClass.trim().toLowerCase();
  return PSEUDO_CLASS_TO_STATE_KEY[normalized] ?? null;
}

/**
 * Computes delta styles of `override` against `base`.
 * Only keys where the value in `override` differs from `base` are kept.
 * Returns undefined if no differences exist or if `override` is empty.
 */
export function computeDeltaStyles(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined,
): StyleDefinition | undefined {
  if (!override || typeof override !== 'object') {
    return undefined;
  }

  const keys = Object.keys(override);
  if (keys.length === 0) {
    return undefined;
  }

  const delta: StyleDefinition = {};
  let deltaCount = 0;

  for (const key of keys) {
    const overrideVal = override[key];
    if (overrideVal === undefined || overrideVal === null || overrideVal === '') {
      continue;
    }

    const baseVal = base ? base[key] : undefined;

    // Strict equality or string trimmed equality
    const isIdentical =
      baseVal !== undefined &&
      (baseVal === overrideVal ||
        (typeof baseVal !== 'object' &&
          typeof overrideVal !== 'object' &&
          String(baseVal).trim() === String(overrideVal).trim()));

    if (!isIdentical) {
      delta[key] = overrideVal as string | number;
      deltaCount++;
    }
  }

  return deltaCount > 0 ? delta : undefined;
}

/**
 * Builds a schema-valid ResponsiveStyles object from raw ComputedElementStyles.
 *
 * 1. Base styles are assigned directly.
 * 2. @media queries are mapped to KUBUILD breakpoints ('desktop', 'tablet', 'mobile').
 *    - Custom boundaries are approximated to the nearest breakpoint and reported as CSS_MEDIA_APPROXIMATED.
 *    - Breakpoint layers only store DELTA against base (redundant properties identical to base are stripped).
 *    - Empty breakpoint style definitions are omitted.
 * 3. Pseudo-classes (:hover, :focus, :active, :focus-visible, :disabled / [disabled])
 *    are mapped to states ('hover', 'focus', 'active', 'focusVisible', 'disabled').
 *    - States layers only store DELTA against base.
 *    - Unsupported pseudo-classes (:first-child, :visited, etc.) are ignored gracefully.
 *    - Empty states layers are omitted.
 */
export function buildResponsiveStyles(
  computed: ComputedElementStyles,
  report?: HtmlImportReport,
): ResponsiveStyles {
  const result: ResponsiveStyles = {};
  if (!computed || typeof computed !== 'object') {
    return result;
  }

  // 1. Base styles
  const baseStyles: StyleDefinition = {};
  if (computed.base && typeof computed.base === 'object') {
    for (const [key, value] of Object.entries(computed.base)) {
      if (value !== undefined && value !== null && value !== '') {
        baseStyles[key] = value;
      }
    }
  }

  if (Object.keys(baseStyles).length > 0) {
    result.base = baseStyles;
  }

  // 2. Breakpoint overrides from mediaQueries
  const breakpointBuckets: Partial<Record<BreakpointName, Record<string, string | number>>> = {};

  if (Array.isArray(computed.mediaQueries)) {
    for (const entry of computed.mediaQueries) {
      if (!entry || !entry.query || !entry.styles || typeof entry.styles !== 'object') {
        continue;
      }

      const bp = mapMediaQueryToBreakpoint(entry.query, report);
      if (!bp) {
        continue;
      }

      if (!breakpointBuckets[bp]) {
        breakpointBuckets[bp] = {};
      }
      Object.assign(breakpointBuckets[bp]!, entry.styles);
    }
  }

  // Delta computation for each breakpoint layer
  const breakpointOrder: readonly BreakpointName[] = ['desktop', 'tablet', 'mobile'];
  for (const bp of breakpointOrder) {
    const bucket = breakpointBuckets[bp];
    if (bucket) {
      const delta = computeDeltaStyles(baseStyles, bucket);
      if (delta && Object.keys(delta).length > 0) {
        result[bp] = delta;
      }
    }
  }

  // 3. States overrides from pseudoStates
  const stateBuckets: Record<string, Record<string, string | number>> = {};

  if (computed.pseudoStates && typeof computed.pseudoStates === 'object') {
    for (const [rawPseudo, styles] of Object.entries(computed.pseudoStates)) {
      if (!styles || typeof styles !== 'object') {
        continue;
      }

      const stateKey = mapPseudoClassToState(rawPseudo);
      if (!stateKey) {
        continue;
      }

      if (!stateBuckets[stateKey]) {
        stateBuckets[stateKey] = {};
      }
      Object.assign(stateBuckets[stateKey]!, styles);
    }
  }

  const statesResult: Record<string, StyleDefinition> = {};
  for (const [stateKey, styles] of Object.entries(stateBuckets)) {
    const delta = computeDeltaStyles(baseStyles, styles);
    if (delta && Object.keys(delta).length > 0) {
      statesResult[stateKey] = delta;
    }
  }

  if (Object.keys(statesResult).length > 0) {
    result.states = statesResult;
  }

  return result;
}
