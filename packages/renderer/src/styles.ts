import {
  PageDocument,
  Node,
  ResponsiveStyles,
  BREAKPOINT_MEDIA_QUERIES,
  BREAKPOINT_ORDER,
  type BreakpointName,
} from '@kubuild/schema';
import React from 'react';

/**
 * Normalizes CSS and Kubuild style properties into standard, valid React.CSSProperties.
 * Resolves:
 * - CSS Grid properties: gridTemplateColumns, gridTemplateRows, gridAutoFlow, gridColumn, gridRow, colSpan, rowSpan
 * - Auto Layout flex properties: flexDirection, flexWrap, justifyContent, alignItems, gap, etc.
 * - Child sizing modes: 'fit-content' (hug), 'fill' (flex: 1 1 0%, width: 100%)
 * - 4-corner border radius: borderTopLeftRadius, borderTopRightRadius, borderBottomRightRadius, borderBottomLeftRadius
 * - Backdrop blur: backdropFilter, backdropBlur, WebkitBackdropFilter
 * - Linear and radial gradients: gradient, backgroundGradient, backgroundImage
 */
export function normalizeStyleObject(
  raw: Record<string, unknown> | undefined,
): React.CSSProperties {
  if (!raw || typeof raw !== 'object') return {};

  const style: Record<string, unknown> = { ...raw };

  // 1. CSS Grid child placement: colSpan -> gridColumn, rowSpan -> gridRow
  if (style.colSpan !== undefined && style.colSpan !== null && style.colSpan !== '') {
    if (!style.gridColumn) {
      const spanStr = String(style.colSpan).trim();
      style.gridColumn = spanStr.startsWith('span') ? spanStr : `span ${spanStr}`;
    }
    delete style.colSpan;
  }

  if (style.rowSpan !== undefined && style.rowSpan !== null && style.rowSpan !== '') {
    if (!style.gridRow) {
      const spanStr = String(style.rowSpan).trim();
      style.gridRow = spanStr.startsWith('span') ? spanStr : `span ${spanStr}`;
    }
    delete style.rowSpan;
  }

  // 2. Child sizing modes: fit-content (hug), fill (flex: 1 1 0%)
  if (style.width === 'hug') {
    style.width = 'fit-content';
  } else if (style.width === 'fill') {
    style.width = '100%';
    if (!style.flex) {
      style.flex = '1 1 0%';
    }
  }

  if (style.height === 'hug') {
    style.height = 'fit-content';
  } else if (style.height === 'fill') {
    style.height = '100%';
    if (!style.flex) {
      style.flex = '1 1 0%';
    }
  }

  if (style.sizingMode === 'hug') {
    style.width = style.width || 'fit-content';
    delete style.sizingMode;
  } else if (style.sizingMode === 'fill') {
    if (!style.flex) {
      style.flex = '1 1 0%';
    }
    delete style.sizingMode;
  }

  // 3. Gap unit handling (if number, format to px string)
  if (typeof style.gap === 'number') {
    style.gap = `${style.gap}px`;
  }
  if (typeof style.rowGap === 'number') {
    style.rowGap = `${style.rowGap}px`;
  }
  if (typeof style.columnGap === 'number') {
    style.columnGap = `${style.columnGap}px`;
  }

  // 4. 4-corner border radius unit handling
  if (typeof style.borderTopLeftRadius === 'number') {
    style.borderTopLeftRadius = `${style.borderTopLeftRadius}px`;
  }
  if (typeof style.borderTopRightRadius === 'number') {
    style.borderTopRightRadius = `${style.borderTopRightRadius}px`;
  }
  if (typeof style.borderBottomRightRadius === 'number') {
    style.borderBottomRightRadius = `${style.borderBottomRightRadius}px`;
  }
  if (typeof style.borderBottomLeftRadius === 'number') {
    style.borderBottomLeftRadius = `${style.borderBottomLeftRadius}px`;
  }
  if (typeof style.borderRadius === 'number') {
    style.borderRadius = `${style.borderRadius}px`;
  }

  // 5. Backdrop filter & backdrop blur
  if (style.backdropBlur !== undefined && style.backdropBlur !== null && style.backdropBlur !== '') {
    const rawVal = String(style.backdropBlur).trim();
    const blurStr = typeof style.backdropBlur === 'number' || /^\d+$/.test(rawVal) ? `${rawVal}px` : rawVal;
    const filterVal = `blur(${blurStr})`;
    style.backdropFilter = filterVal;
    style.WebkitBackdropFilter = filterVal;
    delete style.backdropBlur;
  } else if (style.backdropFilter && typeof style.backdropFilter === 'string') {
    style.WebkitBackdropFilter = style.backdropFilter;
  }

  // 6. Linear and radial gradients & background image normalization
  if (style.gradient && typeof style.gradient === 'string') {
    style.backgroundImage = style.gradient;
    delete style.gradient;
  } else if (style.backgroundGradient && typeof style.backgroundGradient === 'string') {
    style.backgroundImage = style.backgroundGradient;
    delete style.backgroundGradient;
  }

  if (style.backgroundImage && typeof style.backgroundImage === 'string') {
    const bg = style.backgroundImage.trim();
    if (
      bg !== '' &&
      bg !== 'none' &&
      !bg.startsWith('url(') &&
      !bg.includes('gradient(') &&
      (bg.startsWith('http://') ||
        bg.startsWith('https://') ||
        bg.startsWith('data:') ||
        bg.startsWith('blob:') ||
        bg.startsWith('/') ||
        bg.startsWith('./'))
    ) {
      style.backgroundImage = `url("${bg}")`;
    }
  }

  return style as React.CSSProperties;
}

/**
 * How the renderer applies `styles.desktop` / `styles.tablet` / `styles.mobile` (STORA-540).
 *
 * - `'viewport'`: merge `base` with the single layer named by the `viewport` prop into the
 *   inline style. Used by the editor canvas, where each device frame previews one viewport
 *   regardless of the real browser width.
 * - `'css'`: inline style is `base` only; breakpoint layers are emitted as `@media` rules
 *   scoped to `[data-kubuild-node="…"]`, so the real browser width picks the layer. Output
 *   depends only on the document, so server and client render identical markup.
 */
export type ResponsiveMode = 'css' | 'viewport';

export function resolveNodeStyles(
  styles?: ResponsiveStyles,
  viewport: BreakpointName = 'desktop',
): React.CSSProperties {
  if (!styles) return {};
  const base = (styles.base as Record<string, unknown>) || {};
  const override = (styles[viewport] as Record<string, unknown>) || {};
  const merged = { ...base, ...override };
  return normalizeStyleObject(merged);
}

/** Normalized `base` layer only — the inline style used by `responsive: 'css'`. */
export function resolveBaseNodeStyles(styles?: ResponsiveStyles): React.CSSProperties {
  if (!styles) return {};
  return normalizeStyleObject((styles.base as Record<string, unknown>) || {});
}

function isEmptyStyleValue(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Split a node's responsive styles into the always-on `base` style plus, per breakpoint,
 * only the declarations that differ from it.
 *
 * Each override is computed on the *normalized* merge (`base` + layer), i.e. exactly what
 * `resolveNodeStyles(styles, breakpoint)` returns, so CSS output reproduces the
 * `viewport`-mode result at every width. A property present in `base` but dropped by the
 * merge (e.g. the implicit `flex` that `width: 'fill'` adds) is reset with `unset`.
 */
export function resolveResponsiveStyleLayers(styles?: ResponsiveStyles): {
  base: Record<string, unknown>;
  overrides: Partial<Record<BreakpointName, Record<string, unknown>>>;
} {
  const base = resolveBaseNodeStyles(styles) as Record<string, unknown>;
  const overrides: Partial<Record<BreakpointName, Record<string, unknown>>> = {};
  if (!styles) return { base, overrides };

  for (const breakpoint of BREAKPOINT_ORDER) {
    const layer = styles[breakpoint];
    if (!layer || typeof layer !== 'object' || Object.keys(layer).length === 0) continue;
    const resolved = resolveNodeStyles(styles, breakpoint) as Record<string, unknown>;
    const diff: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(resolved)) {
      if (isEmptyStyleValue(value)) continue;
      if (value !== base[key]) diff[key] = value;
    }
    for (const [key, value] of Object.entries(base)) {
      if (isEmptyStyleValue(value)) continue;
      if (isEmptyStyleValue(resolved[key])) diff[key] = 'unset';
    }
    if (Object.keys(diff).length > 0) overrides[breakpoint] = diff;
  }

  return { base, overrides };
}

export interface ResponsiveCssRule {
  nodeId: string;
  declarations: string;
}

/**
 * Walk a node tree and collect per-breakpoint override declarations in tree order.
 * Shared by the runtime renderer (`collectResponsiveStylesCss`) and the static code
 * generator, so both emit the same overrides under the same media queries (STORA-542).
 */
export function collectResponsiveCssRules(
  root: Node | undefined | null,
  options: { important?: boolean } = {},
): Record<BreakpointName, ResponsiveCssRule[]> {
  const rules: Record<BreakpointName, ResponsiveCssRule[]> = {
    desktop: [],
    tablet: [],
    mobile: [],
  };
  if (!root) return rules;

  const walk = (node: Node): void => {
    if (node.styles) {
      const { overrides } = resolveResponsiveStyleLayers(node.styles);
      for (const breakpoint of BREAKPOINT_ORDER) {
        const diff = overrides[breakpoint];
        if (!diff) continue;
        const declarations = cssPropertiesToDeclarations(diff, options);
        if (declarations) rules[breakpoint].push({ nodeId: node.id, declarations });
      }
    }
    node.children?.forEach(walk);
  };

  walk(root);
  return rules;
}

/** Scoped attribute selector matching the element the renderer tags with a node id. */
export function nodeAttributeSelector(nodeId: string): string {
  return `[data-kubuild-node="${escapeCssIdent(nodeId)}"]`;
}

/**
 * Produce the `@media` stylesheet for `responsive: 'css'` (STORA-540), e.g.
 *
 *   @media (max-width: 767.98px) {
 *     [data-kubuild-node="grid-1"] { grid-template-columns: 1fr !important; }
 *   }
 *
 * Declarations use `!important` because the `base` layer (and component defaults) are
 * inline styles, which otherwise beat any stylesheet rule. Pseudo-state rules from
 * `collectStateStylesCss` still win while active since `[…]:hover` is more specific.
 * The output is a pure function of the document (no `window`/`matchMedia` access), so
 * SSR and hydration produce byte-identical `<style>` content.
 */
export function collectResponsiveStylesCss(
  document: PageDocument | undefined | null,
  options: { important?: boolean } = { important: true },
): string {
  if (!document?.document) return '';
  const rules = collectResponsiveCssRules(document.document, {
    important: options.important !== false,
  });
  const blocks: string[] = [];
  for (const breakpoint of BREAKPOINT_ORDER) {
    const list = rules[breakpoint];
    if (list.length === 0) continue;
    const body = list
      .map((rule) => `  ${nodeAttributeSelector(rule.nodeId)} { ${rule.declarations} }`)
      .join('\n');
    blocks.push(`@media ${BREAKPOINT_MEDIA_QUERIES[breakpoint]} {\n${body}\n}`);
  }
  return blocks.join('\n');
}

/**
 * Escape a string for safe interpolation into a CSS declaration value.
 * Strips characters that could break out of the declaration context.
 */
function escapeCssValue(value: unknown): string {
  return String(value).replace(/[{};]+/g, '');
}

/**
 * Escape a node id for safe interpolation into an attribute selector.
 */
function escapeCssIdent(value: string): string {
  return value.replace(/["\\\]]/g, '\\$&');
}

/**
 * CSS properties that React leaves unitless when given a number in an inline `style`.
 * Everything else gets `px` appended, so serialized stylesheets (media queries, states,
 * exported CSS) must do the same or `fontSize: 28` would render inline but be dropped
 * as an invalid declaration in a stylesheet.
 */
const UNITLESS_CSS_PROPERTIES = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexPositive',
  'flexShrink',
  'flexNegative',
  'flexOrder',
  'gridArea',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'fontWeight',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
  'fillOpacity',
  'floodOpacity',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
]);

function formatCssDeclarationValue(key: string, value: unknown): string {
  if (
    typeof value === 'number' &&
    value !== 0 &&
    !key.startsWith('--') &&
    !UNITLESS_CSS_PROPERTIES.has(key)
  ) {
    return `${value}px`;
  }
  return escapeCssValue(value);
}

/**
 * Serialize a style definition object into CSS declarations.
 * camelCase keys are converted to kebab-case CSS properties.
 */
export function styleDefinitionToCssDeclarations(
  styleDefinition: Record<string, unknown> | undefined,
  options?: { important?: boolean },
): string {
  if (!styleDefinition || typeof styleDefinition !== 'object') return '';
  return cssPropertiesToDeclarations(
    normalizeStyleObject(styleDefinition) as Record<string, unknown>,
    options,
  );
}

/**
 * Serialize an already-normalized style object into CSS declarations (no re-normalization).
 */
function cssPropertiesToDeclarations(
  normalized: Record<string, unknown>,
  options?: { important?: boolean },
): string {
  const declarations: string[] = [];
  const suffix = options?.important ? ' !important' : '';
  for (const [key, value] of Object.entries(normalized)) {
    if (value === null || value === undefined || value === '') continue;
    let property = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    if (property.startsWith('--')) {
      // css custom property, keep as is
    } else if (property.startsWith('-webkit-') || property.startsWith('-moz-')) {
      // vendor prefix, keep leading dash
    } else if (property.startsWith('-')) {
      // if not vendor prefix, trim leading dash
      property = property.substring(1);
    }
    declarations.push(`${property}: ${formatCssDeclarationValue(key, value)}${suffix};`);
  }
  return declarations.join(' ');
}

/**
 * Walk the document tree and produce scoped CSS rules for pseudo-state
 * style layers (STORA-222). Each node with `styles.states` gets rules like:
 *
 *   [data-kubuild-node="node-1"]:hover { background-color: #1d4ed8 !important; }
 *
 * Scoped via the canonical `data-kubuild-node` attribute so styles never leak
 * between nodes and work identically in editor canvas and runtime preview.
 * Uses `!important` to reliably override the component's inline base style attributes.
 */
export function collectStateStylesCss(
  document: PageDocument | undefined | null,
  options: { important?: boolean } = { important: true },
): string {
  if (!document?.document) return '';
  const rules: string[] = [];

  const walk = (node: Node): void => {
    const states = node.styles?.states;
    if (states && typeof states === 'object') {
      for (const [state, styleDefinition] of Object.entries(states)) {
        const declarations = styleDefinitionToCssDeclarations(
          styleDefinition as Record<string, unknown>,
          { important: options.important !== false },
        );
        if (!declarations) continue;
        // Only accept pseudo-class-looking selectors to avoid selector injection.
        const safeState = /^::?[a-zA-Z-]+$/.test(state) ? state : null;
        if (!safeState) continue;
        rules.push(`${nodeAttributeSelector(node.id)}${safeState} { ${declarations} }`);
      }
    }
    node.children?.forEach(walk);
  };

  walk(document.document);
  return rules.join('\n');
}

/**
 * Modern baseline CSS Reset for consistent rendering across viewports and browsers.
 */
export const DEFAULT_CSS_RESET = `
*, *::before, *::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

body {
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}
`.trim();
