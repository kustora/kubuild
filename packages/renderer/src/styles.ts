import { PageDocument, Node, ResponsiveStyles } from '@kubuild/schema';
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

  // 6. Linear and radial gradients
  if (style.gradient && typeof style.gradient === 'string') {
    style.backgroundImage = style.gradient;
    delete style.gradient;
  } else if (style.backgroundGradient && typeof style.backgroundGradient === 'string') {
    style.backgroundImage = style.backgroundGradient;
    delete style.backgroundGradient;
  }

  return style as React.CSSProperties;
}

export function resolveNodeStyles(
  styles?: ResponsiveStyles,
  viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop',
): React.CSSProperties {
  if (!styles) return {};
  const base = (styles.base as Record<string, unknown>) || {};
  const override = (styles[viewport] as Record<string, unknown>) || {};
  const merged = { ...base, ...override };
  return normalizeStyleObject(merged);
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
 * Serialize a style definition object into CSS declarations.
 * camelCase keys are converted to kebab-case CSS properties.
 */
export function styleDefinitionToCssDeclarations(
  styleDefinition: Record<string, unknown> | undefined,
  options?: { important?: boolean },
): string {
  if (!styleDefinition || typeof styleDefinition !== 'object') return '';
  const normalized = normalizeStyleObject(styleDefinition);
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
    declarations.push(`${property}: ${escapeCssValue(value)}${suffix};`);
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
        rules.push(`[data-kubuild-node="${escapeCssIdent(node.id)}"]${safeState} { ${declarations} }`);
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
