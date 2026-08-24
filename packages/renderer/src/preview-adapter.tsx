import React, { useMemo } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { RenderContext, Diagnostic } from './render-context';
import { KubuildRenderer } from './renderer';

/**
 * Standard supported viewport devices
 */
export type ViewportDevice = 'desktop' | 'tablet' | 'mobile';

/**
 * Configuration options for a specific viewport device
 */
export interface ViewportConfig {
  /** Width in pixels or CSS dimension (e.g. 768, '768px', '100%') */
  width: number | string;
  /** Optional fixed or min height (e.g. 1024, '1024px', '100%') */
  height?: number | string;
  /** Optional minimum width */
  minWidth?: number | string;
  /** Optional maximum width */
  maxWidth?: number | string;
  /** Optional minimum height */
  minHeight?: number | string;
  /** Optional maximum height */
  maxHeight?: number | string;
  /** User-facing label for the viewport */
  label?: string;
  /** Custom CSS aspect ratio (e.g. '16/9', '9/16') */
  aspectRatio?: string;
  /** Scale factor applied to the preview canvas (e.g. 0.8, 1) */
  scale?: number;
  /** Whether the viewport width stretches fluidly up to maxWidth */
  isFluid?: boolean;
}

/**
 * Configurable host breakpoints for responsive viewport resolution
 */
export interface ViewportBreakpoints {
  /** Maximum screen width considered mobile (default: 480) */
  mobile: number;
  /** Maximum screen width considered tablet (default: 768) */
  tablet: number;
  /** Screen width threshold considered desktop (default: 1024) */
  desktop: number;
}

/**
 * Default viewport device configurations
 */
export const DEFAULT_VIEWPORT_CONFIGS: Record<ViewportDevice, ViewportConfig> = Object.freeze({
  desktop: {
    width: '100%',
    maxWidth: '1280px',
    minHeight: '600px',
    label: 'Desktop (1280px)',
    isFluid: true,
  },
  tablet: {
    width: '768px',
    height: '1024px',
    minHeight: '600px',
    label: 'Tablet (768 × 1024)',
    isFluid: false,
  },
  mobile: {
    width: '375px',
    height: '667px',
    minHeight: '500px',
    label: 'Mobile (375 × 667)',
    isFluid: false,
  },
});

/**
 * Default breakpoint thresholds
 */
export const DEFAULT_BREAKPOINTS: ViewportBreakpoints = Object.freeze({
  mobile: 480,
  tablet: 768,
  desktop: 1024,
});

/**
 * Resolves active viewport device category from a numeric pixel width using host-configurable breakpoints
 */
export function resolveViewportFromWidth(
  width: number,
  breakpoints?: Partial<ViewportBreakpoints>,
): ViewportDevice {
  const resolved = { ...DEFAULT_BREAKPOINTS, ...breakpoints };
  if (width <= resolved.mobile) {
    return 'mobile';
  }
  if (width <= resolved.tablet) {
    return 'tablet';
  }
  return 'desktop';
}

/**
 * Resolves combined viewport configuration merging defaults with host customizations
 */
export function resolveViewportDimensions(
  viewport: ViewportDevice,
  customConfigs?: Partial<Record<ViewportDevice, ViewportConfig>>,
): ViewportConfig {
  const baseConfig = DEFAULT_VIEWPORT_CONFIGS[viewport] || DEFAULT_VIEWPORT_CONFIGS.desktop;
  const custom = customConfigs?.[viewport];
  return { ...baseConfig, ...custom };
}

/**
 * Resolves CSS properties for the preview canvas wrapper
 */
export function resolveViewportContainerStyle(
  viewport: ViewportDevice,
  customConfigs?: Partial<Record<ViewportDevice, ViewportConfig>>,
  customScale?: number,
): React.CSSProperties {
  const config = resolveViewportDimensions(viewport, customConfigs);
  const scale = customScale ?? config.scale ?? 1;

  const toCssVal = (v?: number | string) => (typeof v === 'number' ? `${v}px` : v);

  const style: React.CSSProperties = {
    width: toCssVal(config.width),
    maxWidth: toCssVal(config.maxWidth),
    minWidth: toCssVal(config.minWidth),
    height: toCssVal(config.height),
    minHeight: toCssVal(config.minHeight),
    maxHeight: toCssVal(config.maxHeight),
    aspectRatio: config.aspectRatio,
    transition: 'width 0.2s ease, max-width 0.2s ease, height 0.2s ease',
  };

  if (scale !== 1) {
    style.transform = `scale(${scale})`;
    style.transformOrigin = 'top center';
  }

  return style;
}

/**
 * Props for PreviewViewportAdapter
 */
export interface PreviewViewportAdapterProps {
  /** The portable Page Document to render (remains immutable) */
  document: PageDocument;
  /** Active viewport device mode */
  viewport?: ViewportDevice;
  /** Callback fired when viewport is changed via built-in chrome controls */
  onViewportChange?: (viewport: ViewportDevice) => void;
  /** Host-configurable dimensions & overrides per viewport device */
  viewportConfigs?: Partial<Record<ViewportDevice, ViewportConfig>>;
  /** Host-configurable breakpoint boundaries */
  breakpoints?: Partial<ViewportBreakpoints>;
  /** Component registry providing renderers & schemas */
  registry?: ComponentRegistry;
  /** Immutable runtime context for variable, asset, & action resolution */
  context?: RenderContext;
  /** Rendering mode: 'runtime' or 'editor' */
  mode?: 'editor' | 'runtime';
  /** Whether to render device frame / chrome toolbar */
  showChrome?: boolean;
  /** Optional custom title displayed on device chrome */
  chromeTitle?: string;
  /** Non-destructive editor overlay slot (selection, bounds, grid, etc.) */
  editorOverlay?: React.ReactNode;
  /** Custom zoom/scale factor */
  scale?: number;
  /** Outer container CSS class */
  className?: string;
  /** Outer container inline styles */
  style?: React.CSSProperties;
  /** Inner canvas container CSS class */
  canvasClassName?: string;
  /** Inner canvas container inline styles */
  canvasStyle?: React.CSSProperties;
  /** Optional click handler for canvas nodes */
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  /** Optional diagnostic handler for action or render issues */
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  /** Optional action dispatch handler */
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
}

/**
 * Preview Viewport Adapter Component
 * 
 * Provides an isolated, host-configurable desktop/tablet/mobile preview container that uses
 * the exact same KubuildRenderer and RenderContext as production runtime, differing only in
 * viewport dimensions and optional device chrome/editor overlays.
 */
export const PreviewViewportAdapter: React.FC<PreviewViewportAdapterProps> = ({
  document,
  viewport = 'desktop',
  onViewportChange,
  viewportConfigs,
  breakpoints,
  registry,
  context,
  mode = 'runtime',
  showChrome = false,
  chromeTitle,
  editorOverlay,
  scale,
  className,
  style,
  canvasClassName,
  canvasStyle,
  onNodeClick,
  onDiagnostic,
  onActionDispatch,
}) => {
  const currentConfig = useMemo(
    () => resolveViewportDimensions(viewport, viewportConfigs),
    [viewport, viewportConfigs],
  );

  const containerStyle = useMemo(
    () => resolveViewportContainerStyle(viewport, viewportConfigs, scale),
    [viewport, viewportConfigs, scale],
  );

  const mergedCanvasStyle: React.CSSProperties = useMemo(
    () => ({
      ...containerStyle,
      ...canvasStyle,
      position: 'relative',
      boxSizing: 'border-box',
    }),
    [containerStyle, canvasStyle],
  );

  return (
    <div
      data-kubuild-preview-container
      data-viewport={viewport}
      className={`kubuild-preview-viewport-adapter ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Optional Device Chrome Header */}
      {showChrome && (
        <div
          data-kubuild-preview-chrome
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: containerStyle.maxWidth || containerStyle.width,
            padding: '8px 12px',
            marginBottom: '8px',
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>
              {chromeTitle || document.metadata?.title || 'Preview'}
            </span>
            <span
              data-testid="viewport-badge"
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#334155',
                color: '#94a3b8',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {viewport}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {currentConfig.label || `${currentConfig.width} × ${currentConfig.height || 'auto'}`}
            </span>
          </div>

          {onViewportChange && (
            <div
              data-testid="viewport-switcher"
              style={{ display: 'flex', gap: '4px', backgroundColor: '#0f172a', padding: '2px', borderRadius: '6px' }}
            >
              {(['desktop', 'tablet', 'mobile'] as ViewportDevice[]).map((device) => {
                const isActive = viewport === device;
                return (
                  <button
                    key={device}
                    type="button"
                    data-testid={`viewport-btn-${device}`}
                    onClick={() => onViewportChange(device)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 500,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      backgroundColor: isActive ? '#3b82f6' : 'transparent',
                      color: isActive ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {device}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Responsive Canvas Frame */}
      <div
        data-kubuild-preview-canvas
        data-viewport={viewport}
        className={`kubuild-preview-canvas ${canvasClassName || ''}`}
        style={mergedCanvasStyle}
      >
        {/* Core Document Renderer */}
        <KubuildRenderer
          document={document}
          registry={registry}
          context={context}
          viewport={viewport}
          mode={mode}
          onNodeClick={onNodeClick}
          onDiagnostic={onDiagnostic}
          onActionDispatch={onActionDispatch}
        />

        {/* Non-destructive Editor Overlay Slot */}
        {editorOverlay && (
          <div
            data-kubuild-preview-overlay
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            {editorOverlay}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Alias for PreviewViewportAdapter
 */
export const KubuildPreviewViewport = PreviewViewportAdapter;
