import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument, updateTheme } from '@kubuild/core';
import { useEditorStore } from '../src/store';
import { ThemePanel } from '../src/components/style-manager/theme-panel';
import { DesignTokensPanel, toThemeTokenKey } from '../src/components/style-manager/design-tokens-panel';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';

describe('STORA-551: editor theme editing', () => {
  beforeEach(() => {
    useEditorStore.getState().setDocument(createBlankDocument('Theme'));
  });

  it('ThemePanel lists the document tokens of the active group', () => {
    const html = renderToString(
      <ThemePanel theme={{ colors: { primary: '#2563eb', accent: '#8b5cf6' } }} onChange={() => {}} />,
    );
    expect(html).toContain('data-testid="theme-panel"');
    expect(html).toContain('data-testid="theme-token-colors-primary"');
    expect(html).toContain('data-testid="theme-token-colors-accent"');
    expect(html).toContain('data-testid="theme-add-token-form"');
  });

  it('DesignTokensPanel shows document theme colors (overriding same-named defaults) first', () => {
    const html = renderToString(<DesignTokensPanel theme={{ colors: { primary: '#ff0066', brand: '#123456' } }} />);
    expect(html).toContain('data-testid="color-swatch-brand"');
    expect(html.indexOf('color-swatch-primary')).toBeLessThan(html.indexOf('color-swatch-secondary'));
    expect(html).toContain('#ff0066');
  });

  it('the style accordion exposes the Page Theme section', () => {
    const html = renderToString(<StyleManagerAccordion styles={{}} onCommitStyle={() => {}} initialState={{}} />);
    expect(html).toContain('data-testid="sector-tokens"');
  });

  it('toThemeTokenKey produces safe token keys', () => {
    expect(toThemeTokenKey('Brand Muted')).toBe('brand-muted');
    expect(toThemeTokenKey('  Äccent #2 ')).toBe('ccent-2');
    expect(toThemeTokenKey('***', 'color')).toMatch(/^color-[a-z0-9]+$/);
  });

  it('theme edits go through the command pipeline (undoable) and never touch node styles', () => {
    const store = useEditorStore.getState();
    store.dispatch((doc) => updateTheme(doc, { theme: { colors: { primary: '#111111' } } }));
    expect(useEditorStore.getState().document.theme).toEqual({ colors: { primary: '#111111' } });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.theme).toBeUndefined();
  });
});
