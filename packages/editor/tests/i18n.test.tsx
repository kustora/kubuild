import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { PageDocument, ComponentNode } from '@kubuild/schema';
import { useEditorStore } from '../src/store';
import { getTranslation, useTranslation } from '../src/i18n';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { DimensionSectorControls } from '../src/components/style-manager/dimension-sector-controls';
import { BoxModelEditor } from '../src/components/style-manager/box-model-editor';
import { MotionSectorControls } from '../src/components/style-manager/motion-sector-controls';
import { LanguageSwitcher } from '../src/components/ui/language-switcher';

describe('Editor i18n & Microcopy Localization', () => {
  const registry = createDefaultComponentRegistry();

  const createDocWithHeading = (): PageDocument => {
    const doc = createBlankDocument('Test');
    const headingNode: ComponentNode = {
      id: 'heading-1',
      type: 'heading',
      props: { text: 'Welcome to Kubuild', level: 1 },
      styles: { base: { color: '#000000' } },
      children: [],
    };
    doc.document.children.push(headingNode);
    return doc;
  };

  beforeEach(() => {
    useEditorStore.getState().setLocale('en');
  });

  it('defaults store locale to "en" and provides English translations', () => {
    expect(useEditorStore.getState().locale).toBe('en');
    const enTranslations = getTranslation('en');
    expect(enTranslations.styleTab).toBe('Style');
    expect(enTranslations.settingsTab).toBe('Settings');
    expect(enTranslations.textSettings).toBe('Text Settings');
    expect(enTranslations.titleSize).toBe('Title Size');
    expect(enTranslations.hug).toBe('Hug Content');
    expect(enTranslations.stateLabel).toBe('State');
  });

  it('updates store locale to "id" and provides Indonesian translations', () => {
    useEditorStore.getState().setLocale('id');
    expect(useEditorStore.getState().locale).toBe('id');
    const idTranslations = getTranslation('id');
    expect(idTranslations.styleTab).toBe('Gaya');
    expect(idTranslations.settingsTab).toBe('Pengaturan');
    expect(idTranslations.textSettings).toBe('Pengaturan Teks');
    expect(idTranslations.titleSize).toBe('Ukuran Judul (Title Size)');
    expect(idTranslations.hugSub).toBe('Sesuai Konten');
    expect(idTranslations.stateLabel).toBe('Kondisi / State');
  });

  it('renders LanguageSwitcher component with interactive buttons', () => {
    const html = renderToString(<LanguageSwitcher />);
    expect(html).toContain('data-testid="language-switcher"');
    expect(html).toContain('EN');
    expect(html).toContain('ID');
  });

  it('renders InspectorPanel in English by default', () => {
    const doc = createDocWithHeading();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('heading-1');

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="heading-1" />,
    );

    // Tab bar
    expect(html).toContain('Style');
    expect(html).toContain('Settings');
    expect(html).toContain('data-testid="language-switcher"');

    // Heading props
    expect(html).toContain('Text Settings');
    expect(html).toContain('Title Size');
    expect(html).toContain('H1 - Main Title (Extra Large)');

    // State selector
    expect(html).toContain('State');
    expect(html).toContain('Normal');
    expect(html).toContain('Hover');
    expect(html).toContain('Pressed');
    expect(html).toContain('Focused');
  });

  it('renders InspectorPanel in Indonesian when locale is "id"', () => {
    useEditorStore.getState().setLocale('id');
    const doc = createDocWithHeading();
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().selectNode('heading-1');

    const html = renderToString(
      <InspectorPanel registry={registry} document={doc} selectedNodeId="heading-1" />,
    );

    // Tab bar
    expect(html).toContain('Gaya');
    expect(html).toContain('Pengaturan');

    // Heading props
    expect(html).toContain('Pengaturan Teks');
    expect(html).toContain('Ukuran Judul (Title Size)');
    expect(html).toContain('H1 - Judul Utama (Sangat Besar)');

    // State selector
    expect(html).toContain('Kondisi / State');
    expect(html).toContain('Normal');
    expect(html).toContain('Saat Disorot (Hover)');
    expect(html).toContain('Saat Ditekan (Pressed)');
    expect(html).toContain('Saat Dipilih (Focused)');
  });

  it('renders DimensionSectorControls in English and Indonesian', () => {
    useEditorStore.getState().setLocale('en');
    const htmlEn = renderToString(
      <DimensionSectorControls styles={{}} onChange={() => {}} />,
    );
    expect(htmlEn).toContain('Sizing Modes');
    expect(htmlEn).toContain('Width Mode');
    expect(htmlEn).toContain('Height Mode');
    expect(htmlEn).toContain('Hug Content');
    expect(htmlEn).toContain('Fill Container');
    expect(htmlEn).toContain('Display');
    expect(htmlEn).toContain('Overflow');

    useEditorStore.getState().setLocale('id');
    const htmlId = renderToString(
      <DimensionSectorControls styles={{}} onChange={() => {}} />,
    );
    expect(htmlId).toContain('Mode Ukuran (Sizing Modes)');
    expect(htmlId).toContain('Mode Lebar (Width)');
    expect(htmlId).toContain('Mode Tinggi (Height)');
    expect(htmlId).toContain('Sesuai Konten');
    expect(htmlId).toContain('Penuhi Ruang');
    expect(htmlId).toContain('Ukuran Tetap');
    expect(htmlId).toContain('Tampilan (Display)');
    expect(htmlId).toContain('Konten Meluap (Overflow)');
  });

  it('renders BoxModelEditor in English and Indonesian', () => {
    useEditorStore.getState().setLocale('en');
    const htmlEn = renderToString(<BoxModelEditor values={{}} />);
    expect(htmlEn).toContain('Margin');
    expect(htmlEn).toContain('Border');
    expect(htmlEn).toContain('Padding');
    expect(htmlEn).toContain('Content');

    useEditorStore.getState().setLocale('id');
    const htmlId = renderToString(<BoxModelEditor values={{}} />);
    expect(htmlId).toContain('Jarak Luar (Margin)');
    expect(htmlId).toContain('Garis Tepi (Border)');
    expect(htmlId).toContain('Jarak Dalam (Padding)');
    expect(htmlId).toContain('Konten (Content)');
  });

  it('renders MotionSectorControls in English and Indonesian', () => {
    useEditorStore.getState().setLocale('en');
    const htmlEn = renderToString(<MotionSectorControls onChange={() => {}} />);
    expect(htmlEn).toContain('Duration');
    expect(htmlEn).toContain('Delay');
    expect(htmlEn).toContain('Motion Curve');
    expect(htmlEn).toContain('Hover Effect');

    useEditorStore.getState().setLocale('id');
    const htmlId = renderToString(<MotionSectorControls onChange={() => {}} />);
    expect(htmlId).toContain('Durasi (Duration)');
    expect(htmlId).toContain('Jeda (Delay)');
    expect(htmlId).toContain('Gaya Gerakan (Motion Curve)');
    expect(htmlId).toContain('Efek Sorot Kursor (Hover Effect)');
  });
});
