import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { resolveNodeStyles } from '@kubuild/renderer';
import { useEditorStore } from '../src/store';
import {
  InheritanceIndicator,
  InheritanceSummaryBar,
  getPropertyInheritanceStatus,
  getOverriddenProperties,
} from '../src/components/style-manager/inheritance-indicator';
import {
  ViewportResizer,
  ViewportResizerHandle,
  getBreakpointFromWidth,
  DEFAULT_MIN_WIDTH,
  DEFAULT_MAX_WIDTH,
} from '../src/components/canvas/viewport-resizer';
import {
  MultiDevicePreview,
  DEVICE_SPECS,
} from '../src/components/canvas/multi-device-preview';
import { StyleManagerAccordion } from '../src/components/style-manager/style-manager-accordion';
import { DimensionSectorControls } from '../src/components/style-manager/dimension-sector-controls';
import { TypographySectorControls } from '../src/components/style-manager/typography-sector-controls';
import { CanvasZoomToolbar } from '../src/components/canvas/canvas-pan-zoom';
import { KubuildEditor } from '../src/components/layout/editor';

describe('Responsive Cascade & Fluid Breakpoint Specialist (Agent 4)', () => {
  const registry = createDefaultComponentRegistry();

  function createSampleDoc() {
    const doc = createBlankDocument('Responsive Cascade Test');
    doc.document.children = [
      {
        id: 'box-1',
        type: 'container',
        styles: {
          base: {
            width: '400px',
            fontSize: '24px',
            color: '#111827',
            paddingTop: '20px',
          },
          tablet: {
            width: '320px',
          },
          mobile: {
            width: '100%',
            fontSize: '18px',
          },
        },
        props: {},
      },
    ];
    return doc;
  }

  beforeEach(() => {
    useEditorStore.getState().setDocument(createSampleDoc());
    useEditorStore.getState().selectNode('box-1');
    useEditorStore.getState().setViewport('desktop');
    useEditorStore.getState().setMultiDeviceMode(false);
  });

  // =========================================================================
  // STORA-140: Visual Style Inheritance Indicators in Inspector Panel
  // =========================================================================
  describe('STORA-140: Visual Style Inheritance Indicators in Inspector Panel', () => {
    it('detects base styles when active breakpoint is base or desktop', () => {
      const baseStyles = { width: '400px', fontSize: '24px' };
      const status = getPropertyInheritanceStatus('width', 'base', {}, baseStyles);
      expect(status.isBase).toBe(true);
      expect(status.isOverridden).toBe(false);
      expect(status.isInherited).toBe(false);

      const statusDesktop = getPropertyInheritanceStatus('fontSize', 'desktop', {}, baseStyles);
      expect(statusDesktop.isBase).toBe(true);
    });

    it('detects inherited property when not set in mobile/tablet viewport but exists in base', () => {
      const baseStyles = { width: '400px', fontSize: '24px', color: '#111827' };
      const mobileStyles = { width: '100%' };

      const status = getPropertyInheritanceStatus('fontSize', 'mobile', mobileStyles, baseStyles);
      expect(status.isInherited).toBe(true);
      expect(status.isOverridden).toBe(false);
      expect(status.isBase).toBe(false);
      expect(status.inheritedValue).toBe('24px');
    });

    it('detects overridden property when explicitly set in active non-base viewport', () => {
      const baseStyles = { width: '400px', fontSize: '24px' };
      const mobileStyles = { width: '100%', fontSize: '18px' };

      const status = getPropertyInheritanceStatus('fontSize', 'mobile', mobileStyles, baseStyles);
      expect(status.isOverridden).toBe(true);
      expect(status.isInherited).toBe(false);
      expect(status.activeValue).toBe('18px');
      expect(status.inheritedValue).toBe('24px');
    });

    it('returns list of overridden properties for active viewport via getOverriddenProperties', () => {
      const baseStyles = { width: '400px', fontSize: '24px', color: '#111827' };
      const mobileStyles = { width: '100%', fontSize: '18px' };

      const overrides = getOverriddenProperties('mobile', mobileStyles, baseStyles);
      expect(overrides).toEqual(['width', 'fontSize']);

      const baseOverrides = getOverriddenProperties('base', mobileStyles, baseStyles);
      expect(baseOverrides).toEqual([]);
    });

    it('renders watermark and subtle indicator for inherited styles in tablet/mobile', () => {
      const baseStyles = { fontSize: '24px' };
      const activeStyles = {};

      const html = renderToString(
        <InheritanceIndicator
          property="fontSize"
          activeBreakpoint="mobile"
          activeStyles={activeStyles}
          baseStyles={baseStyles}
        />,
      );

      expect(html).toContain('data-testid="inheritance-indicator-fontSize"');
      expect(html).toContain('data-status="inherited"');
      expect(html).toContain('data-testid="style-inherited-dot-fontSize"');
      expect(html).toContain('data-testid="style-inherited-watermark-fontSize"');
      expect(html).toContain('Inherited: 24px');
    });

    it('renders bold dot indicator and override badge for overridden properties', () => {
      const baseStyles = { fontSize: '24px' };
      const activeStyles = { fontSize: '18px' };

      const html = renderToString(
        <InheritanceIndicator
          property="fontSize"
          activeBreakpoint="mobile"
          activeStyles={activeStyles}
          baseStyles={baseStyles}
          onResetToInherited={() => {}}
        />,
      );

      expect(html).toContain('data-testid="inheritance-indicator-fontSize"');
      expect(html).toContain('data-status="overridden"');
      expect(html).toContain('data-testid="style-override-dot-fontSize"');
      expect(html).toContain('data-testid="style-override-badge-fontSize"');
      expect(html).toContain('data-testid="reset-inherited-fontSize"');
    });

    it('renders InheritanceSummaryBar displaying counts for non-base viewports', () => {
      const baseStyles = { width: '400px', fontSize: '24px', color: '#111827' };
      const activeStyles = { width: '320px' };

      const html = renderToString(
        <InheritanceSummaryBar
          activeBreakpoint="tablet"
          activeStyles={activeStyles}
          baseStyles={baseStyles}
          onResetAllOverrides={() => {}}
        />,
      );

      expect(html).toContain('data-testid="inheritance-summary-bar"');
      expect(html).toContain('Tablet Overrides:');
      expect(html).toContain('1 override');
      expect(html).toContain('data-testid="reset-all-viewport-overrides"');
    });

    it('does not render InheritanceSummaryBar when in base viewport', () => {
      const html = renderToString(
        <InheritanceSummaryBar
          activeBreakpoint="base"
          activeStyles={{ width: '400px' }}
          baseStyles={{ width: '400px' }}
        />,
      );
      expect(html).toBe('');
    });
  });

  // =========================================================================
  // STORA-141: "Reset to Inherited" Action on Style Properties
  // =========================================================================
  describe('STORA-141: "Reset to Inherited" Action on Style Properties', () => {
    it('calls onResetToInherited callback when reset button is clicked', () => {
      const handleReset = vi.fn();
      const baseStyles = { width: '400px' };
      const activeStyles = { width: '100%' };

      const html = renderToString(
        <InheritanceIndicator
          property="width"
          activeBreakpoint="mobile"
          activeStyles={activeStyles}
          baseStyles={baseStyles}
          onResetToInherited={handleReset}
        />,
      );

      expect(html).toContain('data-testid="reset-inherited-width"');
    });

    it('store.resetNodeStyleProperty removes property key from viewport layer and cascades to base', () => {
      const store = useEditorStore.getState();
      const initialNode = store.document.document.children?.[0];
      expect(initialNode?.styles?.mobile?.fontSize).toBe('18px');
      expect(initialNode?.styles?.base?.fontSize).toBe('24px');

      // Resolve before reset
      const resolvedBefore = resolveNodeStyles(initialNode?.styles, 'mobile');
      expect(resolvedBefore.fontSize).toBe('18px');

      // Execute STORA-141 Reset action
      const result = store.resetNodeStyleProperty('box-1', 'fontSize', 'mobile');
      expect(result.success).toBe(true);

      // Verify property was deleted from mobile layer
      const updatedNode = useEditorStore.getState().document.document.children?.[0];
      expect(updatedNode?.styles?.mobile?.fontSize).toBeUndefined();
      expect(updatedNode?.styles?.mobile?.width).toBe('100%'); // other overrides preserved

      // Re-evaluate cascade: must fall back to base!
      const resolvedAfter = resolveNodeStyles(updatedNode?.styles, 'mobile');
      expect(resolvedAfter.fontSize).toBe('24px');
      expect(resolvedAfter.width).toBe('100%');
    });

    it('store.resetNodeViewportStyles clears all overrides on active breakpoint layer', () => {
      const store = useEditorStore.getState();
      const result = store.resetNodeViewportStyles('box-1', 'mobile');
      expect(result.success).toBe(true);

      const updatedNode = useEditorStore.getState().document.document.children?.[0];
      expect(updatedNode?.styles?.mobile).toEqual({});

      // All properties now fall back to base
      const resolved = resolveNodeStyles(updatedNode?.styles, 'mobile');
      expect(resolved.width).toBe('400px');
      expect(resolved.fontSize).toBe('24px');
      expect(resolved.color).toBe('#111827');
    });

    it('StyleManagerAccordion integrates inheritance indicators in spacing side inputs', () => {
      const baseStyles = { paddingTop: '20px', marginTop: '10px' };
      const mobileStyles = { paddingTop: '40px' };

      const html = renderToString(
        <StyleManagerAccordion
          styles={mobileStyles}
          baseStyles={baseStyles}
          breakpoint="mobile"
          onCommitStyle={() => {}}
          onResetProperty={() => {}}
          onResetAllOverrides={() => {}}
        />,
      );

      // Top banner shows mobile overrides
      expect(html).toContain('data-testid="inheritance-summary-bar"');
      // Overridden property indicator for paddingTop
      expect(html).toContain('data-testid="inheritance-indicator-paddingTop"');
      expect(html).toContain('data-testid="style-override-dot-paddingTop"');
      // Inherited property indicator for marginTop
      expect(html).toContain('data-testid="inheritance-indicator-marginTop"');
      expect(html).toContain('data-testid="style-inherited-dot-marginTop"');
    });

    it('DimensionSectorControls integrates inheritance indicators and reset buttons', () => {
      const baseStyles = { width: '400px', height: '200px' };
      const tabletStyles = { width: '300px' }; // width overridden, height inherited

      const html = renderToString(
        <DimensionSectorControls
          styles={tabletStyles}
          baseStyles={baseStyles}
          breakpoint="tablet"
          onChange={() => {}}
          onResetProperty={() => {}}
        />,
      );

      // Overridden width
      expect(html).toContain('data-testid="inheritance-indicator-width"');
      expect(html).toContain('data-testid="style-override-dot-width"');
      expect(html).toContain('data-testid="reset-inherited-width"');

      // Inherited height
      expect(html).toContain('data-testid="inheritance-indicator-height"');
      expect(html).toContain('data-testid="style-inherited-dot-height"');
    });

    it('TypographySectorControls integrates inheritance indicators for font properties', () => {
      const baseStyles = { fontFamily: '"Inter", sans-serif', fontSize: '16px', color: '#111827' };
      const mobileStyles = { fontSize: '14px' };

      const html = renderToString(
        <TypographySectorControls
          styles={mobileStyles}
          baseStyles={baseStyles}
          breakpoint="mobile"
          onChange={() => {}}
          onResetProperty={() => {}}
        />,
      );

      expect(html).toContain('data-testid="inheritance-indicator-fontSize"');
      expect(html).toContain('data-testid="style-override-dot-fontSize"');
      expect(html).toContain('data-testid="inheritance-indicator-fontFamily"');
      expect(html).toContain('data-testid="style-inherited-dot-fontFamily"');
    });
  });

  // =========================================================================
  // STORA-142: Interactive Fluid Viewport Width Resizer Handle
  // =========================================================================
  describe('STORA-142: Interactive Fluid Viewport Width Resizer Handle', () => {
    it('getBreakpointFromWidth maps pixel widths to correct breakpoint and badge text', () => {
      // Mobile: < 768px
      const mobileInfo = getBreakpointFromWidth(375);
      expect(mobileInfo.breakpoint).toBe('mobile');
      expect(mobileInfo.label).toBe('Mobile');
      expect(mobileInfo.badgeText).toBe('375px • Mobile');

      const mobileInfoBoundary = getBreakpointFromWidth(767);
      expect(mobileInfoBoundary.breakpoint).toBe('mobile');

      // Tablet: 768px - 1023px
      const tabletInfo = getBreakpointFromWidth(768);
      expect(tabletInfo.breakpoint).toBe('tablet');
      expect(tabletInfo.label).toBe('Tablet');
      expect(tabletInfo.badgeText).toBe('768px • Tablet');

      // Desktop: >= 1024px
      const desktopInfo = getBreakpointFromWidth(1200);
      expect(desktopInfo.breakpoint).toBe('desktop');
      expect(desktopInfo.label).toBe('Desktop');
      expect(desktopInfo.badgeText).toBe('1200px • Desktop');

      const wideInfo = getBreakpointFromWidth(1440);
      expect(wideInfo.badgeText).toBe('1440px • Desktop');
    });

    it('renders ViewportResizerHandle on the right edge of the frame with slider role', () => {
      const html = renderToString(
        <ViewportResizerHandle
          width={768}
          onWidthChange={() => {}}
          minWidth={DEFAULT_MIN_WIDTH}
          maxWidth={DEFAULT_MAX_WIDTH}
        />,
      );

      expect(html).toContain('data-testid="viewport-resizer-handle"');
      expect(html).toContain('role="slider"');
      expect(html).toContain('aria-valuenow="768"');
      expect(html).toContain(`aria-valuemin="${DEFAULT_MIN_WIDTH}"`);
      expect(html).toContain(`aria-valuemax="${DEFAULT_MAX_WIDTH}"`);
      expect(html).toContain('data-testid="viewport-resizer-badge"');
      expect(html).toContain('768px • Tablet');
    });

    it('renders ViewportResizer container with resolution badge, preset buttons, and children', () => {
      const html = renderToString(
        <ViewportResizer
          width={1200}
          onWidthChange={() => {}}
          showPresets={true}
        >
          <div data-testid="test-canvas-content">Canvas Content</div>
        </ViewportResizer>,
      );

      expect(html).toContain('data-testid="viewport-resizer-container"');
      expect(html).toContain('data-testid="viewport-resolution-badge"');
      expect(html).toContain('1200px • Desktop');
      expect(html).toContain('data-testid="preset-button-mobile"');
      expect(html).toContain('data-testid="preset-button-tablet"');
      expect(html).toContain('data-testid="preset-button-desktop"');
      expect(html).toContain('data-testid="preset-button-wide"');
      expect(html).toContain('data-testid="viewport-resizer-frame"');
      expect(html).toContain('data-testid="test-canvas-content"');
      expect(html).toContain('data-testid="viewport-resizer-handle"');
    });
  });

  // =========================================================================
  // STORA-143: Side-by-Side Multi-Device Preview Mode
  // =========================================================================
  describe('STORA-143: Side-by-Side Multi-Device Preview Mode', () => {
    it('defines 3 device specifications: Desktop (1200px), Tablet (768px), and Mobile (375px)', () => {
      expect(DEVICE_SPECS.length).toBe(3);
      expect(DEVICE_SPECS.find((d) => d.id === 'desktop')?.width).toBe(1200);
      expect(DEVICE_SPECS.find((d) => d.id === 'tablet')?.width).toBe(768);
      expect(DEVICE_SPECS.find((d) => d.id === 'mobile')?.width).toBe(375);
    });

    it('renders Desktop, Tablet, and Mobile frames side-by-side simultaneously', () => {
      const doc = createSampleDoc();
      const html = renderToString(
        <MultiDevicePreview
          document={doc}
          registry={registry}
          onClose={() => {}}
        />,
      );

      expect(html).toContain('data-testid="multi-device-preview-container"');
      expect(html).toContain('data-testid="multi-device-header-toolbar"');
      expect(html).toContain('data-testid="multi-device-scale-toolbar"');
      expect(html).toContain('data-testid="multi-device-frames-row"');

      // All 3 device frames rendered simultaneously
      expect(html).toContain('data-testid="multi-device-frame-desktop"');
      expect(html).toContain('data-testid="multi-device-header-desktop"');
      expect(html).toContain('Desktop');
      expect(html).toContain('1200px');

      expect(html).toContain('data-testid="multi-device-frame-tablet"');
      expect(html).toContain('data-testid="multi-device-header-tablet"');
      expect(html).toContain('Tablet');
      expect(html).toContain('768px');

      expect(html).toContain('data-testid="multi-device-frame-mobile"');
      expect(html).toContain('data-testid="multi-device-header-mobile"');
      expect(html).toContain('Mobile');
      expect(html).toContain('375px');

      expect(html).toContain('data-testid="exit-multi-device-btn"');
    });

    it('renders scale controls (zoom in, zoom out, fit, reset) in MultiDevicePreview toolbar', () => {
      const doc = createSampleDoc();
      const html = renderToString(
        <MultiDevicePreview
          document={doc}
          registry={registry}
        />,
      );

      expect(html).toContain('data-testid="multi-device-zoom-out"');
      expect(html).toContain('data-testid="multi-device-zoom-reset"');
      expect(html).toContain('data-testid="multi-device-zoom-in"');
      expect(html).toContain('data-testid="multi-device-zoom-fit"');
    });

    it('store toggles multiDeviceMode on and off', () => {
      expect(useEditorStore.getState().multiDeviceMode).toBe(false);

      useEditorStore.getState().toggleMultiDeviceMode();
      expect(useEditorStore.getState().multiDeviceMode).toBe(true);

      useEditorStore.getState().toggleMultiDeviceMode();
      expect(useEditorStore.getState().multiDeviceMode).toBe(false);

      useEditorStore.getState().setMultiDeviceMode(true);
      expect(useEditorStore.getState().multiDeviceMode).toBe(true);
    });

    it('CanvasZoomToolbar renders multi-device toggle button', () => {
      const handleToggle = vi.fn();
      const html = renderToString(
        <CanvasZoomToolbar
          zoom={1}
          onZoomChange={() => {}}
          onReset={() => {}}
          multiDeviceMode={false}
          onToggleMultiDevice={handleToggle}
        />,
      );

      expect(html).toContain('data-testid="toggle-multi-device-btn"');
      expect(html).toContain('Devices');
    });

    it('KubuildEditor top toolbar includes multi-device toggle button', () => {
      const html = renderToString(
        <KubuildEditor
          initialDocument={createSampleDoc()}
          registry={registry}
        />,
      );

      expect(html).toContain('data-testid="multi-device-toolbar-toggle"');
      expect(html).toContain('Multi-Device');
    });
  });
});
