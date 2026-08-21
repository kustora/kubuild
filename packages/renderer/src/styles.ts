import { ResponsiveStyles } from '@kubuild/schema';
import React from 'react';

export function resolveNodeStyles(
  styles?: ResponsiveStyles,
  _viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop',
): React.CSSProperties {
  if (!styles) return {};
  const base = (styles.base as React.CSSProperties) || {};
  return { ...base };
}
