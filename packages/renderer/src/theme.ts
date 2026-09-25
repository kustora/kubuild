import type React from 'react';
import { mergeThemes, themeToCssVariables, type PageDocument, type Theme } from '@kubuild/schema';
import type { RenderContext } from '@kubuild/core';

/**
 * Document theme (STORA-551) with the host's runtime override (`RenderContext.theme`, e.g. a
 * per-tenant brand color) layered on top. Neither input is mutated.
 */
export function resolveRuntimeTheme(
  document: Pick<PageDocument, 'theme'> | undefined | null,
  context?: Pick<RenderContext, 'theme'> | null,
): Theme {
  return mergeThemes(document?.theme, context?.theme);
}

/**
 * Theme tokens as a React inline-style object of CSS custom properties
 * (`{ '--kb-color-primary': '#2563eb' }`). Unsafe keys/values are dropped, so this is safe
 * to call on an unvalidated host override.
 */
export function themeToCssProperties(
  theme: Partial<Theme> | undefined | null,
): React.CSSProperties {
  const style: Record<string, string> = {};
  for (const [name, value] of themeToCssVariables(theme)) {
    style[name] = value;
  }
  return style as React.CSSProperties;
}

/**
 * Theme tokens as CSS declarations (`--kb-color-primary: #2563eb;`) for a stylesheet rule,
 * e.g. `:root { ... }` in generated/exported HTML.
 */
export function themeToCssDeclarations(theme: Partial<Theme> | undefined | null): string {
  return themeToCssVariables(theme)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
}
