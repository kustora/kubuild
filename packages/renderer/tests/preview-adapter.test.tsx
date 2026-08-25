import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageDocument, starterPageFixture } from '@kubuild/schema';
import {
  PreviewViewportAdapter,
  KubuildPreviewViewport,
  resolveViewportFromWidth,
  resolveViewportDimensions,
  resolveViewportContainerStyle,
  DEFAULT_VIEWPORT_CONFIGS,
  DEFAULT_BREAKPOINTS,
  ViewportDevice,
} from '../src/preview-adapter';
import { KubuildRenderer } from '../src/renderer';
import { createMinimalRenderContext } from '../src/render-context';

describe('PreviewViewportAdapter', () => {
  const mockDoc: PageDocument = {
    schema: 'stora.page',
    version: '1.0.0',
    metadata: {
      title: 'Test Preview Page',
      description: 'Page for viewport preview tests',
      author: 'Test Author',
      tags: ['test'],
      category: 'general',
      version: '1.0.0',
    },
    document: {
      id: 'root-page',
      type: 'page',
      props: {},
      styles: {
        base: { padding: '10px' },
        desktop: { padding: '40px', backgroundColor: '#ffffff' },
        tablet: { padding: '24px', backgroundColor: '#f0f0f0' },
        mobile: { padding: '12px', backgroundColor: '#e0e0e0' },
      },
      children: [
        {
          id: 'heading-1',
          type: 'heading',
          props: { level: 1, text: 'Hello {{ siteName }}' },
          styles: {
            base: { fontSize: '20px' },
            desktop: { fontSize: '32px' },
            tablet: { fontSize: '28px' },
            mobile: { fontSize: '22px' },
          },
        },
        {
          id: 'btn-1',
          type: 'button',
          props: {
            label: 'Click Me',
            action: {
              type: 'navigate',
              payload: { url: '/about', target: '{{ siteName }}' },
            },
          },
        },
      ],
    },
  };

  const mockContext = createMinimalRenderContext({
    variables: { siteName: 'Kustora Store' },
    actions: {
      navigate: vi.fn(),
    },
  });

  describe('Acceptance Criteria 1: Viewport Switching without Document Mutation', () => {
    it('switches between desktop, tablet, and mobile without mutating the source document', () => {
      const docCopy = JSON.parse(JSON.stringify(mockDoc));
      const initialSnapshot = JSON.stringify(mockDoc);

      const desktopHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="desktop" context={mockContext} />,
      );
      expect(desktopHtml).toContain('Hello Kustora Store');
      expect(desktopHtml).toContain('data-viewport="desktop"');
      expect(JSON.stringify(mockDoc)).toBe(initialSnapshot);

      const tabletHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="tablet" context={mockContext} />,
      );
      expect(tabletHtml).toContain('Hello Kustora Store');
      expect(tabletHtml).toContain('data-viewport="tablet"');
      expect(JSON.stringify(mockDoc)).toBe(initialSnapshot);

      const mobileHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="mobile" context={mockContext} />,
      );
      expect(mobileHtml).toContain('Hello Kustora Store');
      expect(mobileHtml).toContain('data-viewport="mobile"');
      expect(JSON.stringify(mockDoc)).toBe(initialSnapshot);
      expect(mockDoc).toEqual(docCopy);
    });
  });

  describe('Acceptance Criteria 2: Component Output & Binding Parity with Runtime Renderer', () => {
    it('produces identical inner markup and variable bindings as direct KubuildRenderer', () => {
      const previewHtml = renderToString(
        <PreviewViewportAdapter
          document={starterPageFixture}
          viewport="desktop"
          context={mockContext}
        />,
      );

      const runtimeHtml = renderToString(
        <KubuildRenderer
          document={starterPageFixture}
          viewport="desktop"
          context={mockContext}
          mode="runtime"
        />,
      );

      // Verify that runtime canvas output is encapsulated completely inside the preview canvas container
      const runtimeCanvasRoot = runtimeHtml.substring(runtimeHtml.indexOf('<div class="kubuild-canvas-root'));
      expect(previewHtml).toContain(runtimeCanvasRoot);
    });

    it('resolves responsive style overrides identically for active viewport', () => {
      const desktopHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="desktop" context={mockContext} />,
      );
      expect(desktopHtml).toContain('padding:40px');
      expect(desktopHtml).toContain('font-size:32px');

      const tabletHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="tablet" context={mockContext} />,
      );
      expect(tabletHtml).toContain('padding:24px');
      expect(tabletHtml).toContain('font-size:28px');

      const mobileHtml = renderToString(
        <PreviewViewportAdapter document={mockDoc} viewport="mobile" context={mockContext} />,
      );
      expect(mobileHtml).toContain('padding:12px');
      expect(mobileHtml).toContain('font-size:22px');
    });
  });

  describe('Acceptance Criteria 3: Host Configurable Viewport Dimensions & Breakpoints', () => {
    it('allows host to customize viewport widths, heights, max-width, and scales', () => {
      const customConfigs = {
        desktop: { width: '1440px', maxWidth: '1600px', label: 'Wide Desktop' },
        tablet: { width: '834px', height: '1194px', label: 'iPad Pro' },
        mobile: { width: 390, height: 844, scale: 0.9, label: 'iPhone 13' },
      };

      const desktopHtml = renderToString(
        <PreviewViewportAdapter
          document={mockDoc}
          viewport="desktop"
          viewportConfigs={customConfigs}
        />,
      );
      expect(desktopHtml).toContain('width:1440px');
      expect(desktopHtml).toContain('max-width:1600px');

      const tabletHtml = renderToString(
        <PreviewViewportAdapter
          document={mockDoc}
          viewport="tablet"
          viewportConfigs={customConfigs}
        />,
      );
      expect(tabletHtml).toContain('width:834px');
      expect(tabletHtml).toContain('height:1194px');

      const mobileHtml = renderToString(
        <PreviewViewportAdapter
          document={mockDoc}
          viewport="mobile"
          viewportConfigs={customConfigs}
        />,
      );
      expect(mobileHtml).toContain('width:390px');
      expect(mobileHtml).toContain('height:844px');
      expect(mobileHtml).toContain('transform:scale(0.9)');
    });

    it('resolves viewport category from width using host configurable breakpoints', () => {
      // Default breakpoints: { mobile: 480, tablet: 768, desktop: 1024 }
      expect(resolveViewportFromWidth(320)).toBe('mobile');
      expect(resolveViewportFromWidth(480)).toBe('mobile');
      expect(resolveViewportFromWidth(600)).toBe('tablet');
      expect(resolveViewportFromWidth(768)).toBe('tablet');
      expect(resolveViewportFromWidth(1024)).toBe('desktop');
      expect(resolveViewportFromWidth(1440)).toBe('desktop');

      // Custom breakpoints
      const customBreakpoints = { mobile: 576, tablet: 992, desktop: 1200 };
      expect(resolveViewportFromWidth(500, customBreakpoints)).toBe('mobile');
      expect(resolveViewportFromWidth(576, customBreakpoints)).toBe('mobile');
      expect(resolveViewportFromWidth(800, customBreakpoints)).toBe('tablet');
      expect(resolveViewportFromWidth(1000, customBreakpoints)).toBe('desktop');
    });
  });

  describe('Device Chrome and Overlay Integration', () => {
    it('renders device chrome with title, badge, and interactive viewport switcher', () => {
      const handleViewportChange = vi.fn();

      const html = renderToString(
        <PreviewViewportAdapter
          document={mockDoc}
          viewport="tablet"
          showChrome={true}
          chromeTitle="My Store Preview"
          onViewportChange={handleViewportChange}
        />,
      );

      expect(html).toContain('My Store Preview');
      expect(html).toContain('data-kubuild-preview-chrome');
      expect(html).toContain('tablet');
      expect(html).toContain('data-testid="viewport-switcher"');
      expect(html).toContain('data-testid="viewport-btn-desktop"');
      expect(html).toContain('data-testid="viewport-btn-tablet"');
      expect(html).toContain('data-testid="viewport-btn-mobile"');
    });

    it('renders non-destructive editor overlay in preview canvas without altering document markup', () => {
      const overlay = (
        <div id="selection-box" style={{ border: '2px solid blue' }}>
          Selected Node
        </div>
      );

      const html = renderToString(
        <PreviewViewportAdapter
          document={mockDoc}
          viewport="desktop"
          editorOverlay={overlay}
        />,
      );

      expect(html).toContain('data-kubuild-preview-overlay');
      expect(html).toContain('id="selection-box"');
      expect(html).toContain('Selected Node');
    });

    it('handles KubuildPreviewViewport alias properly', () => {
      const html = renderToString(
        <KubuildPreviewViewport document={mockDoc} viewport="tablet" />,
      );
      expect(html).toContain('data-viewport="tablet"');
    });
  });

  describe('Viewport Utility Functions', () => {
    it('merges default and custom dimensions with resolveViewportDimensions', () => {
      const dimensions = resolveViewportDimensions('mobile', {
        mobile: { width: '414px', label: 'iPhone Plus' },
      });
      expect(dimensions.width).toBe('414px');
      expect(dimensions.height).toBe('667px'); // Preserves default height
      expect(dimensions.label).toBe('iPhone Plus');
    });

    it('calculates container styles accurately with resolveViewportContainerStyle', () => {
      const defaultDesktopStyle = resolveViewportContainerStyle('desktop');
      expect(defaultDesktopStyle.width).toBe('100%');
      expect(defaultDesktopStyle.maxWidth).toBe('1280px');

      const customMobileStyle = resolveViewportContainerStyle('mobile', {
        mobile: { width: '400px', height: '800px', scale: 0.8 },
      });
      expect(customMobileStyle.width).toBe('400px');
      expect(customMobileStyle.height).toBe('800px');
      expect(customMobileStyle.transform).toBe('scale(0.8)');
    });
  });
});
