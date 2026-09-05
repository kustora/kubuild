import React, { useState, useMemo } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry } from '@kubuild/components';
import { KubuildRenderer } from '@kubuild/renderer';
import { RuntimeContext } from '@kubuild/core';
import { useEditorStore, Viewport } from '../../store';
import {
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Maximize,
  X,
  Check,
} from 'lucide-react';

export interface DeviceSpec {
  id: Viewport;
  label: string;
  width: number;
  minHeight: number;
  icon: React.ComponentType<{ className?: string }>;
  resolutionBadge: string;
}

export const DEVICE_SPECS: DeviceSpec[] = [
  {
    id: 'desktop',
    label: 'Desktop',
    width: 1200,
    minHeight: 800,
    icon: Monitor,
    resolutionBadge: '1200px • 16:10',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    width: 768,
    minHeight: 900,
    icon: Tablet,
    resolutionBadge: '768px • iPad',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    width: 375,
    minHeight: 667,
    icon: Smartphone,
    resolutionBadge: '375px • iPhone',
  },
];

export interface MultiDevicePreviewProps {
  document?: PageDocument;
  registry: ComponentRegistry;
  context?: RuntimeContext;
  onClose?: () => void;
  className?: string;
}

/**
 * Side-by-Side Multi-Device Preview Mode (STORA-143).
 * Renders Desktop (1200px), Tablet (768px), and Mobile (375px) frames side-by-side simultaneously
 * with device frame headers, responsive scale controls, and synced node selection.
 */
export const MultiDevicePreview: React.FC<MultiDevicePreviewProps> = ({
  document: propDoc,
  registry,
  context,
  onClose,
  className = '',
}) => {
  const {
    document: storeDoc,
    selectedNodeId,
    selectNode,
    viewport: activeViewport,
    setViewport,
    previewMode,
    toggleMultiDeviceMode,
  } = useEditorStore();

  const doc = propDoc ?? storeDoc;

  // Scale controls: 0.35 to 1.25, default 0.60 to fit all 3 devices on typical screens
  const [scale, setScale] = useState<number>(0.6);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(1.25, Math.round((prev + 0.1) * 100) / 100));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(0.35, Math.round((prev - 0.1) * 100) / 100));
  };

  const handleFit = () => {
    setScale(0.55);
  };

  const handleResetScale = () => {
    setScale(1.0);
  };

  const handleExit = () => {
    if (onClose) {
      onClose();
    } else {
      toggleMultiDeviceMode();
    }
  };

  const scalePercentage = Math.round(scale * 100);

  return (
    <div
      data-testid="multi-device-preview-container"
      className={`relative w-full h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden select-none ${className}`}
    >
      {/* Top Floating Control Bar */}
      <div
        data-testid="multi-device-header-toolbar"
        className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-40 shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Multi-Device Preview
            </span>
          </div>
          <span className="text-slate-600 text-xs">|</span>
          <span className="text-xs text-slate-400">
            Desktop (1200px) • Tablet (768px) • Mobile (375px)
          </span>
        </div>

        {/* Scale Controls (STORA-143) */}
        <div data-testid="multi-device-scale-toolbar" className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700">
          <button
            type="button"
            data-testid="multi-device-zoom-out"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            data-testid="multi-device-zoom-reset"
            onClick={handleResetScale}
            title="Reset Scale to 100%"
            className="text-[11px] font-mono font-medium px-1.5 py-0.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition min-w-[42px] text-center cursor-pointer"
          >
            {scalePercentage}%
          </button>

          <button
            type="button"
            data-testid="multi-device-zoom-in"
            onClick={handleZoomIn}
            title="Zoom In"
            className="p-1 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-3.5 bg-slate-700 mx-0.5" />

          <button
            type="button"
            data-testid="multi-device-zoom-fit"
            onClick={handleFit}
            title="Fit All Devices"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
          >
            <Maximize className="w-3 h-3" />
            <span>Fit</span>
          </button>
        </div>

        {/* Exit Mode Button */}
        <button
          type="button"
          data-testid="exit-multi-device-btn"
          onClick={handleExit}
          title="Exit Multi-Device Preview"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-md border border-slate-700 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit Preview</span>
        </button>
      </div>

      {/* Main Canvas Workspace with Side-by-Side Frames */}
      <div className="flex-1 overflow-auto p-6 md:p-12 flex justify-start lg:justify-center items-start min-h-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        <div
          data-testid="multi-device-frames-row"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            transition: 'transform 150ms ease-out',
          }}
          className="flex items-start gap-12 shrink-0 pb-20"
        >
          {DEVICE_SPECS.map((device) => {
            const Icon = device.icon;
            const isActive = activeViewport === device.id;

            return (
              <div
                key={device.id}
                data-testid={`multi-device-frame-${device.id}`}
                className="flex flex-col gap-3 shrink-0"
              >
                {/* Device Frame Header (STORA-143) */}
                <div
                  data-testid={`multi-device-header-${device.id}`}
                  onClick={() => setViewport(device.id)}
                  title={`Click to activate ${device.label} viewport in Inspector`}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer select-none ${
                    isActive
                      ? 'bg-blue-600/90 text-white shadow-lg ring-2 ring-blue-400/40'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-bold tracking-wide">{device.label}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {device.width}px
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] opacity-80">{device.resolutionBadge}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-blue-200" />}
                  </div>
                </div>

                {/* Device Frame Container */}
                <div
                  style={{
                    width: `${device.width}px`,
                    minHeight: `${device.minHeight}px`,
                  }}
                  className={`bg-white rounded-2xl shadow-2xl overflow-hidden border transition-all duration-200 ${
                    isActive
                      ? 'ring-4 ring-blue-500/40 border-blue-500 shadow-blue-900/20'
                      : 'border-slate-700/60 shadow-black/50'
                  }`}
                >
                  {/* Mockup Top Status Bar */}
                  <div className="h-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between px-3">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    </div>
                    <span className="text-[9px] font-mono text-slate-400 font-medium">
                      {device.width} × {device.minHeight}
                    </span>
                  </div>

                  {/* Render Document in this device's viewport */}
                  <div className="p-2 sm:p-4 text-slate-900 bg-white">
                    <KubuildRenderer
                      document={doc}
                      registry={registry}
                      context={context}
                      viewport={device.id}
                      mode={previewMode ? 'runtime' : 'editor'}
                      onNodeClick={(id) => {
                        selectNode(id);
                        setViewport(device.id);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
