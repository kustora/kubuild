import { PageDocument, Node, ResponsiveStyles } from '@kubuild/schema';
import React from 'react';

export function resolveNodeStyles(
  styles?: ResponsiveStyles,
  viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop',
): React.CSSProperties {
  if (!styles) return {};
  const base = (styles.base as React.CSSProperties) || {};
  const override = (styles[viewport] as React.CSSProperties) || {};
  return { ...base, ...override };
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
): string {
  if (!styleDefinition || typeof styleDefinition !== 'object') return '';
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(styleDefinition)) {
    if (value === null || value === undefined || value === '') continue;
    const property = key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    declarations.push(`${property}: ${escapeCssValue(value)};`);
  }
  return declarations.join(' ');
}

/**
 * Walk the document tree and produce scoped CSS rules for pseudo-state
 * style layers (STORA-222). Each node with `styles.states` gets rules like:
 *
 *   [data-kubuild-node="node-1"]:hover { background-color: #1d4ed8; }
 *
 * Scoped via the canonical `data-kubuild-node` attribute so styles never leak
 * between nodes and work identically in editor canvas and runtime preview.
 */
export function collectStateStylesCss(document: PageDocument | undefined | null): string {
  if (!document?.document) return '';
  const rules: string[] = [];

  const walk = (node: Node): void => {
    const states = node.styles?.states;
    if (states && typeof states === 'object') {
      for (const [state, styleDefinition] of Object.entries(states)) {
        const declarations = styleDefinitionToCssDeclarations(
          styleDefinition as Record<string, unknown>,
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
