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
