import { ResponsiveStyles } from '@kubuild/schema';
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
