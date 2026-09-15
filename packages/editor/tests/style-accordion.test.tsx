import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import {
  StyleManagerAccordion,
  STYLE_SECTORS,
  loadAccordionState,
  saveAccordionState,
  clearMemoryStorage,
  STORAGE_KEY_ACCORDION,
  DEFAULT_ACCORDION_STATE,
} from '../src/components/style-manager/style-manager-accordion';
import { InspectorPanel, StateEditingBadge } from '../src/components/panels/inspector-panel';
import { useEditorStore } from '../src/store';

describe('Sector-Based Style Manager & Visual Box Model (STORA-202)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    clearMemoryStorage();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    useEditorStore.getState().setLocale('en');
  });

  it('defines the required sectors: Dimension, Spacing, Typography, Decorations, Flex, Motion', () => {
    const sectorIds = STYLE_SECTORS.map((s) => s.id);
    expect(sectorIds).toEqual(['dimension', 'spacing', 'typography', 'decorations', 'flex', 'motion']);

    const sectorLabels = STYLE_SECTORS.map((s) => s.label);
    expect(sectorLabels).toContain('Size');
    expect(sectorLabels).toContain('Spacing');
    expect(sectorLabels).toContain('Typography');
    expect(sectorLabels).toContain('Decorations');
    expect(sectorLabels).toContain('Layout & Align');
    expect(sectorLabels).toContain('Motion & Animation');
  });

  it('loads and saves accordion state to localStorage', () => {
    expect(loadAccordionState()).toEqual(DEFAULT_ACCORDION_STATE);

    const customState = {
      dimension: false,
      spacing: true,
      typography: true,
      decorations: true,
      flex: false,
      motion: true,
    };
    saveAccordionState(customState);

    expect(loadAccordionState()).toEqual(customState);
  });

  it('renders all accordion sector headers in English (default) and Indonesian when switched', () => {
    useEditorStore.getState().setLocale('en');
    const htmlEn = renderToString(
      <StyleManagerAccordion
        styles={{}}
        onCommitStyle={() => {}}
        breakpoint="base"
      />,
    );

    expect(htmlEn).toContain('Size');
    expect(htmlEn).toContain('Spacing');
    expect(htmlEn).toContain('Typography');
    expect(htmlEn).toContain('Decorations');
    expect(htmlEn).toContain('Layout &amp; Align');
    expect(htmlEn).toContain('Motion &amp; Animation');
    expect(htmlEn).toContain('Expand All');
    expect(htmlEn).toContain('Collapse All');

    useEditorStore.getState().setLocale('id');
    const htmlId = renderToString(
      <StyleManagerAccordion
        styles={{}}
        onCommitStyle={() => {}}
        breakpoint="base"
      />,
    );

    expect(htmlId).toContain('Ukuran (Size)');
    expect(htmlId).toContain('Jarak &amp; Ruang (Spacing)');
    expect(htmlId).toContain('Tipografi (Teks)');
    expect(htmlId).toContain('Dekorasi &amp; Tampilan');
    expect(htmlId).toContain('Tata Letak &amp; Posisi (Layout &amp; Align)');
    expect(htmlId).toContain('Animasi &amp; Gerakan');
    expect(htmlId).toContain('Buka Semua');
    expect(htmlId).toContain('Tutup Semua');
  });

  it('displays active property count badge when styles are customized in a sector', () => {
    const styles = {
      width: '100%',
      height: '300px',
      marginTop: '20px',
      fontSize: '18px',
      color: '#333333',
    };

    const html = renderToString(
      <StyleManagerAccordion
        styles={styles}
        onCommitStyle={() => {}}
        breakpoint="base"
      />,
    );

    // Dimension has 2 styles (width, height)
    // Spacing has 1 style (marginTop)
    // Typography has 2 styles (fontSize, color)
    expect(html).toContain('2 custom properties set');
    expect(html).toContain('1 custom properties set');
  });

  it('renders sectors open according to initialState', () => {
    const html = renderToString(
      <StyleManagerAccordion
        styles={{}}
        onCommitStyle={() => {}}
        initialState={{
          dimension: true,
          spacing: true,
          typography: true,
          decorations: false,
          flex: false,
        }}
      />,
    );

    // Spacing has BoxModelEditor rendered
    expect(html).toContain('data-testid="visual-box-model"');
    // Dimension has Display and Width inputs
    expect(html).toContain('Display');
    expect(html).toContain('Width');
    // Typography has Font Size and Font Weight
    expect(html).toContain('Font Size');
    expect(html).toContain('Font Weight');
  });

  it('integrates StyleManagerAccordion inside InspectorPanel for active selected node', () => {
    const doc = createBlankDocument('Accordion Inspector Test');
    doc.document.children = [
      {
        id: 'hero-box',
        type: 'container',
        props: { tag: 'div' },
        styles: {
          base: {
            display: 'flex',
            marginTop: '32px',
            color: '#2563eb',
          },
        },
      },
    ];

    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero-box');

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="hero-box" />,
    );

    expect(html).toContain('data-testid="style-manager-accordion"');
    expect(html).toContain('Size');
    expect(html).toContain('Spacing');
    expect(html).toContain('Typography');
    expect(html).toContain('Decorations');
    expect(html).toContain('Layout &amp; Align');
  });
});

describe('Active state visual indicator (STORA-223)', () => {
  const registry = createDefaultComponentRegistry();

  function docWithNode(): ReturnType<typeof createBlankDocument> {
    const doc = createBlankDocument('State Badge Test');
    doc.document.children = [
      {
        id: 'hero-box',
        type: 'container',
        props: { tag: 'div' },
        styles: { base: { backgroundColor: '#2563eb' } },
      },
    ];
    return doc;
  }

  it('shows no warning badge when editing in Default state', () => {
    const doc = docWithNode();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero-box');

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="hero-box" />,
    );

    expect(html).not.toContain('data-testid="state-editing-badge"');
    expect(html).not.toContain('Editing :hover State');
  });

  it('renders the amber badge with the state name for :hover', () => {
    const html = renderToString(<StateEditingBadge state=":hover" />);

    expect(html).toContain('data-testid="state-editing-badge"');
    // renderToString injects <!-- --> between interpolated text segments
    expect(html).toContain('Editing');
    expect(html).toContain(':hover');
    expect(html).toContain('State');
    expect(html).toContain('bg-amber-50');
    expect(html).toContain('border-amber-300');
  });

  it('renders the badge for :active and :focus too', () => {
    expect(renderToString(<StateEditingBadge state=":active" />)).toContain(':active');
    expect(renderToString(<StateEditingBadge state=":focus" />)).toContain(':focus');
  });

  it('shows the badge inside InspectorPanel when a non-default state is selected', () => {
    const doc = docWithNode();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('hero-box');

    // Default render: selector present with Default option, badge absent
    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="hero-box" />,
    );
    expect(html).toContain('style-state-selector');
    expect(html).toContain(':hover');
    expect(html).not.toContain('data-testid="state-editing-badge"');
  });
});
