import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { useEditorStore } from '../src/store';

// Import all newly developed style inspector components
import {
  AutoLayoutControls,
  ROW_ALIGNMENT_MAP,
  COLUMN_ALIGNMENT_MAP,
  ALIGNMENT_POINTS,
  parseGap,
} from '../src/components/style-manager/auto-layout-controls';

import {
  DimensionSectorControls,
  DimensionUnitInput,
  getWidthSizingMode,
  getHeightSizingMode,
} from '../src/components/style-manager/dimension-sector-controls';

import {
  GridControls,
  GridItemControls,
  GRID_COLUMN_PRESETS,
  parseGridColumns,
  parseSpan,
} from '../src/components/style-manager/grid-controls';

import {
  BorderRadiusControl,
  EffectsSectorControls,
  parseBoxShadow,
  serializeBoxShadow,
  parseBackdropBlur,
  SHADOW_PRESETS,
} from '../src/components/style-manager/effects-sector-controls';

import {
  ColorGradientPicker,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  parseColorString,
  serializeGradient,
} from '../src/components/style-manager/color-gradient-picker';

import {
  TypographySectorControls,
  GOOGLE_FONTS,
} from '../src/components/style-manager/typography-sector-controls';

import {
  DesignTokensPanel,
  DEFAULT_COLOR_TOKENS,
  DEFAULT_TYPOGRAPHY_TOKENS,
} from '../src/components/style-manager/design-tokens-panel';

import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { InspectorPanel } from '../src/components/panels/inspector-panel';

describe('Figma-Grade Inspector & Design System Controls', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  // ==========================================================================
  // 1. STORA-103: Auto Layout Inspector Panel with 9-Point Alignment Matrix
  // ==========================================================================
  describe('STORA-103: Auto Layout Inspector Panel', () => {
    it('defines 9 alignment matrix positions and their flex mappings', () => {
      expect(ALIGNMENT_POINTS.length).toBe(9);
      expect(ALIGNMENT_POINTS.map((p) => p.id)).toEqual([
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]);

      // Verify row mappings
      expect(ROW_ALIGNMENT_MAP['top-left']).toEqual({ justify: 'flex-start', align: 'flex-start' });
      expect(ROW_ALIGNMENT_MAP['center']).toEqual({ justify: 'center', align: 'center' });
      expect(ROW_ALIGNMENT_MAP['bottom-right']).toEqual({ justify: 'flex-end', align: 'flex-end' });

      // Verify column mappings
      expect(COLUMN_ALIGNMENT_MAP['top-left']).toEqual({ justify: 'flex-start', align: 'flex-start' });
      expect(COLUMN_ALIGNMENT_MAP['center-right']).toEqual({ justify: 'center', align: 'flex-end' });
      expect(COLUMN_ALIGNMENT_MAP['bottom-right']).toEqual({ justify: 'flex-end', align: 'flex-end' });
    });

    it('parses gap values in px and rem units', () => {
      expect(parseGap(undefined)).toEqual({ value: 0, unit: 'px' });
      expect(parseGap('16px')).toEqual({ value: 16, unit: 'px' });
      expect(parseGap('1.5rem')).toEqual({ value: 1.5, unit: 'rem' });
      expect(parseGap(24)).toEqual({ value: 24, unit: 'px' });
    });

    it('renders AutoLayoutControls with 9-box matrix, direction toggles, and gap input', () => {
      const html = renderToString(
        <AutoLayoutControls
          styles={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="auto-layout-controls"');
      expect(html).toContain('data-testid="auto-layout-direction-row"');
      expect(html).toContain('data-testid="auto-layout-direction-column"');
      expect(html).toContain('data-testid="auto-layout-wrap"');
      expect(html).toContain('data-testid="auto-layout-matrix"');
      expect(html).toContain('data-testid="auto-layout-space-between"');

      // Check each matrix cell
      ALIGNMENT_POINTS.forEach((pt) => {
        expect(html).toContain(`data-testid="auto-layout-align-${pt.id}"`);
      });

      // Check gap controls
      expect(html).toContain('data-testid="auto-layout-gap-slider"');
      expect(html).toContain('data-testid="auto-layout-gap-input"');
      expect(html).toContain('data-testid="auto-layout-gap-unit"');
      expect(html).toContain('value="16"');
    });

    it('renders AutoLayoutControls inside StyleManagerAccordion for flex nodes', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{ display: 'flex', gap: '20px' }}
          nodeType="flex"
          onCommitStyle={() => {}}
          initialState={{ flex: true }}
        />,
      );

      expect(html).toContain('data-testid="auto-layout-controls"');
      expect(html).toContain('data-testid="auto-layout-matrix"');
    });
  });

  // ==========================================================================
  // 2. STORA-104: Child Sizing Mode Controls (Hug, Fill, Fixed)
  // ==========================================================================
  describe('STORA-104: Child Sizing Mode Controls (Hug, Fill, Fixed)', () => {
    it('getWidthSizingMode and getHeightSizingMode correctly identify modes', () => {
      expect(getWidthSizingMode('fit-content')).toBe('hug');
      expect(getWidthSizingMode('auto')).toBe('hug');
      expect(getWidthSizingMode('100%')).toBe('fill');
      expect(getWidthSizingMode('auto', '1 1 0%')).toBe('fill');
      expect(getWidthSizingMode('300px')).toBe('fixed');

      expect(getHeightSizingMode('fit-content')).toBe('hug');
      expect(getHeightSizingMode('auto')).toBe('hug');
      expect(getHeightSizingMode('100%')).toBe('fill');
      expect(getHeightSizingMode('400px')).toBe('fixed');
    });

    it('renders segmented buttons for Width and Height sizing modes in DimensionSectorControls', () => {
      const html = renderToString(
        <DimensionSectorControls
          styles={{
            width: 'fit-content',
            height: '100%',
          }}
          onChange={() => {}}
        />,
      );

      // Width sizing mode buttons
      expect(html).toContain('data-testid="sizing-mode-width-hug"');
      expect(html).toContain('data-testid="sizing-mode-width-fill"');
      expect(html).toContain('data-testid="sizing-mode-width-fixed"');

      // Height sizing mode buttons
      expect(html).toContain('data-testid="sizing-mode-height-hug"');
      expect(html).toContain('data-testid="sizing-mode-height-fill"');
      expect(html).toContain('data-testid="sizing-mode-height-fixed"');

      // Active mode indicators
      expect(html.toLowerCase()).toContain('hug');
      expect(html.toLowerCase()).toContain('fill');
    });
  });

  // ==========================================================================
  // 3. STORA-112: Visual Grid Track Builder
  // ==========================================================================
  describe('STORA-112: Visual Grid Track Builder', () => {
    it('parses grid columns from template strings correctly', () => {
      expect(parseGridColumns('repeat(4, minmax(0, 1fr))')).toBe(4);
      expect(parseGridColumns('repeat(12, 1fr)')).toBe(12);
      expect(parseGridColumns('1fr 2fr 1fr')).toBe(3);
      expect(parseGridColumns('')).toBe(1);
    });

    it('renders GridControls with column slider, presets, preview, and gaps', () => {
      const html = renderToString(
        <GridControls
          styles={{
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            rowGap: '16px',
            columnGap: '24px',
            gridAutoFlow: 'row',
          }}
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="grid-controls"');
      expect(html).toContain('data-testid="grid-columns-slider"');

      // Column presets
      GRID_COLUMN_PRESETS.forEach((preset) => {
        expect(html).toContain(`data-testid="grid-preset-${preset}"`);
      });

      // Track preview and custom input
      expect(html).toContain('data-testid="grid-track-preview"');
      expect(html).toContain('data-testid="grid-template-columns-input"');
      expect(html).toContain('repeat(4, minmax(0, 1fr))');

      // Gap inputs
      expect(html).toContain('data-testid="grid-row-gap"');
      expect(html).toContain('data-testid="grid-col-gap"');
      expect(html).toContain('data-testid="grid-auto-flow"');
    });

    it('renders GridControls in StyleManagerAccordion when node has display: grid', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}
          onCommitStyle={() => {}}
        />,
      );

      expect(html).toContain('data-testid="sector-grid"');
      expect(html).toContain('Grid Track Builder');
      expect(html).toContain('data-testid="grid-columns-slider"');
    });
  });

  // ==========================================================================
  // 4. STORA-113: Child Column Span & Row Span Controls
  // ==========================================================================
  describe('STORA-113: Child Column Span & Row Span Controls', () => {
    it('parseSpan extracts span numbers reliably', () => {
      expect(parseSpan('span 3', 1)).toBe(3);
      expect(parseSpan(4, 1)).toBe(4);
      expect(parseSpan('span 12', 1)).toBe(12);
      expect(parseSpan('', 1)).toBe(1);
    });

    it('renders GridItemControls with colSpan (1-12) and rowSpan (1-6) sliders and dropdowns', () => {
      const html = renderToString(
        <GridItemControls
          styles={{
            gridColumn: 'span 3',
            gridRow: 'span 2',
          }}
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="grid-item-controls"');
      expect(html).toContain('data-testid="grid-item-col-span-slider"');
      expect(html).toContain('data-testid="grid-item-col-span"');
      expect(html).toContain('data-testid="grid-item-row-span-slider"');
      expect(html).toContain('data-testid="grid-item-row-span"');
      expect(html).toContain('value="3"');
      expect(html).toContain('value="2"');
    });

    it('renders GridItemControls inside StyleManagerAccordion when parent is a grid', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{ gridColumn: 'span 2' }}
          isParentGrid={true}
          onCommitStyle={() => {}}
          initialState={{ dimension: true }}
        />,
      );

      expect(html).toContain('data-testid="grid-item-controls"');
      expect(html).toContain('data-testid="grid-item-col-span"');
    });
  });

  // ==========================================================================
  // 5. STORA-150: Independent 4-Corner Border Radius Control
  // ==========================================================================
  describe('STORA-150: Independent 4-Corner Border Radius', () => {
    it('renders unified radius input and allows expansion to 4 corners', () => {
      const htmlUnified = renderToString(
        <BorderRadiusControl
          styles={{ borderRadius: '8px' }}
          onChange={() => {}}
        />,
      );

      expect(htmlUnified).toContain('data-testid="border-radius-unified"');
      expect(htmlUnified).toContain('data-testid="border-radius-expand"');
      expect(htmlUnified).not.toContain('data-testid="border-radius-corners-grid"');

      // When individual corners are present, it auto-expands
      const htmlExpanded = renderToString(
        <BorderRadiusControl
          styles={{
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            borderBottomRightRadius: '0px',
            borderBottomLeftRadius: '0px',
          }}
          onChange={() => {}}
        />,
      );

      expect(htmlExpanded).toContain('data-testid="border-radius-corners-grid"');
      expect(htmlExpanded).toContain('data-testid="border-radius-top-left"');
      expect(htmlExpanded).toContain('data-testid="border-radius-top-right"');
      expect(htmlExpanded).toContain('data-testid="border-radius-bottom-left"');
      expect(htmlExpanded).toContain('data-testid="border-radius-bottom-right"');
    });
  });

  // ==========================================================================
  // 6. STORA-151: Advanced Color & Gradient Picker Component
  // ==========================================================================
  describe('STORA-151: Advanced Color & Gradient Picker', () => {
    it('color conversion helpers (hexToRgb, rgbToHex, rgbToHsl) convert accurately', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
      expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 });
    });

    it('parseColorString parses hex, rgba, and linear/radial gradients', () => {
      const hexParsed = parseColorString('#3b82f6');
      expect(hexParsed.mode).toBe('solid');
      expect(hexParsed.color).toBe('#3b82f6');

      const rgbaParsed = parseColorString('rgba(59, 130, 246, 0.5)');
      expect(rgbaParsed.mode).toBe('solid');
      expect(rgbaParsed.alpha).toBe(0.5);

      const linearParsed = parseColorString('linear-gradient(45deg, #ff0000 0%, #0000ff 100%)');
      expect(linearParsed.mode).toBe('linear');
      expect(linearParsed.angle).toBe(45);
      expect(linearParsed.stops.length).toBe(2);

      const radialParsed = parseColorString('radial-gradient(circle, #ffffff 0%, #000000 100%)');
      expect(radialParsed.mode).toBe('radial');
      expect(radialParsed.stops.length).toBe(2);
    });

    it('serializeGradient constructs valid CSS gradient expressions', () => {
      const gradient = serializeGradient('linear', 90, [
        { color: '#ff0000', position: 0 },
        { color: '#00ff00', position: 100 },
      ]);
      expect(gradient).toBe('linear-gradient(90deg, #ff0000 0%, #00ff00 100%)');

      const radial = serializeGradient('radial', 0, [
        { color: '#ffffff', position: 0 },
        { color: '#000000', position: 100 },
      ]);
      expect(radial).toBe('radial-gradient(circle, #ffffff 0%, #000000 100%)');
    });

    it('renders ColorGradientPicker in solid mode with alpha and format switches', () => {
      const html = renderToString(
        <ColorGradientPicker
          value="#3b82f6"
          label="Background Color"
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="color-gradient-picker"');
      expect(html).toContain('data-testid="color-picker-mode-solid"');
      expect(html).toContain('data-testid="color-picker-mode-linear"');
      expect(html).toContain('data-testid="color-picker-mode-radial"');
      expect(html).toContain('data-testid="color-picker-native-input"');
      expect(html).toContain('data-testid="color-picker-text-input"');
      expect(html).toContain('data-testid="color-picker-format-toggle"');
      expect(html).toContain('data-testid="color-picker-alpha-slider"');
      expect(html).toContain('data-testid="color-picker-alpha-input"');
    });

    it('renders ColorGradientPicker in linear gradient mode with angle and stops', () => {
      const html = renderToString(
        <ColorGradientPicker
          value="linear-gradient(135deg, #3b82f6 0%, #ec4899 100%)"
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="gradient-preview-bar"');
      expect(html).toContain('data-testid="gradient-angle-slider"');
      expect(html).toContain('data-testid="gradient-angle-input"');
      expect(html).toContain('data-testid="gradient-add-stop"');
      expect(html).toContain('data-testid="gradient-stop-color-0"');
      expect(html).toContain('data-testid="gradient-stop-color-1"');
      expect(html).toContain('value="135"');
    });
  });

  // ==========================================================================
  // 7. STORA-152: Shadows & Blur Effects Inspector
  // ==========================================================================
  describe('STORA-152: Shadows & Blur Effects Inspector', () => {
    it('parseBoxShadow and serializeBoxShadow parse and reconstruct shadows accurately', () => {
      const parsed = parseBoxShadow('0px 4px 10px 2px rgba(0, 0, 0, 0.2)');
      expect(parsed.inset).toBe(false);
      expect(parsed.offsetX).toBe('0px');
      expect(parsed.offsetY).toBe('4px');
      expect(parsed.blur).toBe('10px');
      expect(parsed.spread).toBe('2px');
      expect(parsed.color).toBe('rgba(0, 0, 0, 0.2)');

      const serialized = serializeBoxShadow(parsed);
      expect(serialized).toBe('0px 4px 10px 2px rgba(0, 0, 0, 0.2)');

      const insetParsed = parseBoxShadow('inset 0px 2px 4px 0px rgba(0, 0, 0, 0.1)');
      expect(insetParsed.inset).toBe(true);
      expect(serializeBoxShadow(insetParsed)).toContain('inset');
    });

    it('parseBackdropBlur extracts numeric blur pixel values', () => {
      expect(parseBackdropBlur('blur(16px)')).toBe(16);
      expect(parseBackdropBlur('blur(0px)')).toBe(0);
      expect(parseBackdropBlur('none')).toBe(0);
    });

    it('renders EffectsSectorControls with shadow inputs, inset toggle, and backdrop blur slider', () => {
      const html = renderToString(
        <EffectsSectorControls
          styles={{
            boxShadow: '0px 4px 6px 0px rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(12px)',
          }}
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="effects-sector-controls"');
      expect(html).toContain('data-testid="shadow-inset-toggle"');
      expect(html).toContain('data-testid="shadow-offset-x"');
      expect(html).toContain('data-testid="shadow-offset-y"');
      expect(html).toContain('data-testid="shadow-blur"');
      expect(html).toContain('data-testid="shadow-spread"');
      expect(html).toContain('data-testid="shadow-color"');

      // Presets
      SHADOW_PRESETS.forEach((p) => {
        expect(html).toContain(`data-testid="shadow-preset-${p.id}"`);
      });

      // Backdrop blur controls
      expect(html).toContain('data-testid="backdrop-blur-slider"');
      expect(html).toContain('data-testid="backdrop-blur-input"');
      expect(html).toContain('data-testid="backdrop-blur-preset-glass"');
      expect(html).toContain('value="12"');
    });
  });

  // ==========================================================================
  // 8. STORA-153: Advanced Typography Control Matrix
  // ==========================================================================
  describe('STORA-153: Advanced Typography Control Matrix', () => {
    it('renders typography controls for weights 100-900, transforms, and alignments', () => {
      const html = renderToString(
        <TypographySectorControls
          styles={{
            fontFamily: '"Inter", sans-serif',
            fontSize: '16px',
            fontWeight: '600',
            lineHeight: '1.5',
            letterSpacing: '0.5px',
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
          onChange={() => {}}
        />,
      );

      expect(html).toContain('data-testid="typography-select-font-family"');
      expect(html).toContain('data-testid="typography-select-font-weight"');
      expect(html).toContain('100 - Thin');
      expect(html).toContain('600 - Semi Bold');
      expect(html).toContain('900 - Black');

      // Text aligns
      expect(html).toContain('data-testid="typography-align-left"');
      expect(html).toContain('data-testid="typography-align-center"');
      expect(html).toContain('data-testid="typography-align-right"');
      expect(html).toContain('data-testid="typography-align-justify"');

      // Text transforms
      expect(html).toContain('data-testid="typography-transform-none"');
      expect(html).toContain('data-testid="typography-transform-uppercase"');
      expect(html).toContain('data-testid="typography-transform-lowercase"');
      expect(html).toContain('data-testid="typography-transform-capitalize"');
    });
  });

  // ==========================================================================
  // 9. STORA-154: Global Design Tokens (Color & Typography Swatches)
  // ==========================================================================
  describe('STORA-154: Global Design Tokens', () => {
    it('contains default curated color and typography tokens', () => {
      expect(DEFAULT_COLOR_TOKENS.length).toBeGreaterThanOrEqual(8);
      expect(DEFAULT_COLOR_TOKENS.map((c) => c.name)).toContain('Primary');
      expect(DEFAULT_COLOR_TOKENS.map((c) => c.name)).toContain('Accent');

      expect(DEFAULT_TYPOGRAPHY_TOKENS.length).toBeGreaterThanOrEqual(6);
      expect(DEFAULT_TYPOGRAPHY_TOKENS.map((t) => t.name)).toContain('Display H1');
      expect(DEFAULT_TYPOGRAPHY_TOKENS.map((t) => t.name)).toContain('Body Regular');
    });

    it('renders DesignTokensPanel with swatches grid and typography presets list', () => {
      const html = renderToString(
        <DesignTokensPanel
          onApplyColor={() => {}}
          onApplyTypography={() => {}}
        />,
      );

      expect(html).toContain('data-testid="design-tokens-panel"');
      expect(html).toContain('data-testid="token-tab-colors"');
      expect(html).toContain('data-testid="token-tab-typography"');
      expect(html).toContain('data-testid="color-swatches-grid"');
      expect(html).toContain('data-testid="color-swatch-primary"');
      expect(html).toContain('data-testid="toggle-add-color-token"');
    });

    it('renders DesignTokensPanel inside StyleManagerAccordion', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{}}
          onCommitStyle={() => {}}
        />,
      );

      expect(html).toContain('data-testid="sector-tokens"');
      expect(html).toContain('data-testid="tokens-accordion-toggle"');
      expect(html).toContain('Global Design Tokens');
    });
  });

  // ==========================================================================
  // 10. End-to-End Store & Inspector Panel Integration
  // ==========================================================================
  describe('End-to-End InspectorPanel Integration', () => {
    it('commits style changes to store when inspected in InspectorPanel', () => {
      const doc = createBlankDocument('Full Inspector Integration');
      doc.document.children = [
        {
          id: 'grid-parent',
          type: 'container',
          props: { tag: 'div' },
          styles: {
            base: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
            },
          },
          children: [
            {
              id: 'grid-child-card',
              type: 'container',
              props: { tag: 'article' },
              styles: {
                base: {
                  gridColumn: 'span 2',
                  backgroundColor: '#ffffff',
                },
              },
            },
          ],
        },
      ];

      useEditorStore.getState().setDocument(doc);
      useEditorStore.getState().selectNode('grid-parent');

      const parentHtml = renderToString(
        <InspectorPanel registry={registry} document={doc} selectedNodeId="grid-parent" />,
      );

      // Parent is grid: should show grid track builder
      expect(parentHtml).toContain('data-testid="sector-grid"');
      expect(parentHtml).toContain('Grid Track Builder');

      // Now select child node: parent is grid, so child span controls should show
      useEditorStore.getState().selectNode('grid-child-card');
      const childHtml = renderToString(
        <InspectorPanel registry={registry} document={doc} selectedNodeId="grid-child-card" />,
      );

      expect(childHtml).toContain('data-testid="grid-item-controls"');
      expect(childHtml).toContain('data-testid="grid-item-col-span"');

      // Update child grid span in store
      useEditorStore.getState().updateNodeStyle(
        'grid-child-card',
        {
          gridColumn: 'span 3',
          gridRow: 'span 2',
          backdropFilter: 'blur(8px)',
        },
        'base',
      );

      const updatedChild = useEditorStore.getState().getSelectedNode();
      expect(updatedChild?.styles?.base?.gridColumn).toBe('span 3');
      expect(updatedChild?.styles?.base?.gridRow).toBe('span 2');
      expect(updatedChild?.styles?.base?.backdropFilter).toBe('blur(8px)');
    });
  });
});
