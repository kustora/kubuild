import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import {
  TypographySectorControls,
  GOOGLE_FONTS,
  loadGoogleFont,
} from '../src/components/style-manager/typography-sector-controls';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Typography Sector Controls with Google Fonts (STORA-204)', () => {
  const registry = createDefaultComponentRegistry();

  it('GOOGLE_FONTS contains curated list of Google Fonts', () => {
    const fontNames = GOOGLE_FONTS.map((f) => f.label);
    expect(fontNames).toContain('Inter');
    expect(fontNames).toContain('Poppins');
    expect(fontNames).toContain('Roboto');
    expect(fontNames).toContain('Outfit');
    expect(fontNames).toContain('Plus Jakarta Sans');
    expect(fontNames).toContain('Playfair Display');
    expect(fontNames).toContain('JetBrains Mono');
  });

  it('renders TypographySectorControls with Google Fonts select dropdown', () => {
    const html = renderToString(
      <TypographySectorControls
        styles={{
          fontFamily: '"Poppins", sans-serif',
          fontSize: '18px',
          fontWeight: '600',
          color: '#2563eb',
          textAlign: 'center',
        }}
        onChange={() => {}}
      />,
    );

    expect(html).toContain('Font Family (Google Fonts)');
    expect(html).toContain('Google Sans-Serif');
    expect(html).toContain('Google Serif');
    expect(html).toContain('Google Monospace');
    expect(html).toContain('Poppins');
    expect(html).toContain('Plus Jakarta Sans');
    expect(html).toContain('Outfit');

    // Controls for size, weight, color, alignment
    expect(html).toContain('Font Size');
    expect(html).toContain('Font Weight');
    expect(html).toContain('Text Color');
    expect(html).toContain('Text Align');
    expect(html).toContain('Line Height');
    expect(html).toContain('Letter Spacing');
    expect(html).toContain('Decoration');
    expect(html).toContain('Transform');
  });

  it('updates fontFamily and typography styles in editor store via StyleManagerAccordion', () => {
    const doc = createBlankDocument('Typography Test Doc');
    doc.document.children = [
      {
        id: 'heading-1',
        type: 'heading',
        props: { text: 'Title' },
        styles: {
          base: {
            fontFamily: '"Inter", sans-serif',
            fontSize: '24px',
          },
        },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('heading-1');

    const state = useEditorStore.getState();
    expect(state.getSelectedNode()?.styles?.base?.fontFamily).toBe('"Inter", sans-serif');

    // Update font family to Outfit with 700 weight and center align
    state.updateNodeStyle(
      'heading-1',
      {
        fontFamily: '"Outfit", sans-serif',
        fontWeight: '700',
        textAlign: 'center',
        textTransform: 'uppercase',
      },
      'base',
    );

    const updated = useEditorStore.getState().getSelectedNode();
    expect(updated?.styles?.base?.fontFamily).toBe('"Outfit", sans-serif');
    expect(updated?.styles?.base?.fontWeight).toBe('700');
    expect(updated?.styles?.base?.textAlign).toBe('center');
    expect(updated?.styles?.base?.textTransform).toBe('uppercase');
  });

  it('renders TypographySectorControls inside InspectorPanel', () => {
    const doc = createBlankDocument('Inspector Typography Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode(doc.document.id);

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId={doc.document.id} />,
    );

    expect(html).toContain('data-testid="style-manager-accordion"');
    expect(html).toContain('Typography');
  });
});
