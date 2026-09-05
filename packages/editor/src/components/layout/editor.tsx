import React, { useEffect, useMemo, useState } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import {
  RuntimeContext,
  VariableCatalog,
  Diagnostic,
  buildSampleVariablesFromCatalog,
} from '@kubuild/core';
import { useEditorStore, Viewport } from '../../store';
import { EditorCanvas } from '../canvas/canvas';
import { EditorToolbar } from './toolbar';
import { InspectorPanel } from '../panels/inspector-panel';
import { LayersPanel } from '../panels/layers-panel';
import { TableSpreadsheetEditor, findActiveTableNode } from '../table-editor/table-spreadsheet-editor';
import { HierarchyBreadcrumbs } from '../canvas/breadcrumbs';
import { LeftSidebar } from '../panels/left-sidebar';
import { ActionDebuggerPanel } from '../panels/action-debugger-panel';
import { EditorConfig, resolveEditorConfig, AiEditorConfig, resolveAiEditorConfig } from '../../config';
import {
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  Layers,
  Sliders,
  Undo2,
  Redo2,
  X,
  Boxes,
} from 'lucide-react';

export interface KubuildEditorProps {
  initialDocument?: PageDocument;
  registry?: ComponentRegistry;
  context?: RuntimeContext;
  /** Host-declared bindable variables + preview-only sample values (STORA-053). Never written to the document. */
  variableCatalog?: VariableCatalog;
  onChange?: (doc: PageDocument) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  config?: EditorConfig;
  /**
   * AI provider integration (STORA-501). Opt-in only — when omitted, `KubuildEditor`
   * renders with zero AI UI and zero behavioral difference from a build without AI.
   * The host (consumer) always supplies its own provider adapter/endpoint/API key.
   */
  ai?: AiEditorConfig;
  className?: string;
}

export const KubuildEditor: React.FC<KubuildEditorProps> = ({
  initialDocument,
  registry = createDefaultComponentRegistry(),
  context,
  variableCatalog,
  onChange,
  onDiagnostic,
  config,
  ai,
  className,
}) => {
  const {
    document,
    setDocument,
    setOnChangeHandler,
    setVariableCatalog,
    viewport,
    setViewport,
    selectedNodeId,
    navigatorMode,
    tableSpreadsheetMode,
    setTableSpreadsheetMode,
    undo,
    redo,
    canUndo,
    canRedo,
    previewMode,
    actionDebuggerOpen,
  } = useEditorStore();
  const lastLoadedDocRef = React.useRef<PageDocument | undefined>(undefined);

  // Mobile drawer states
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState<boolean>(false);
  const [isMobileLayersOpen, setIsMobileLayersOpen] = useState<boolean>(false);

  const activeTable = useMemo(
    () => findActiveTableNode(document.document, selectedNodeId),
    [document.document, selectedNodeId],
  );

  useEffect(() => {
    if (
      initialDocument &&
      initialDocument !== lastLoadedDocRef.current &&
      initialDocument !== useEditorStore.getState().document
    ) {
      lastLoadedDocRef.current = initialDocument;
      setDocument(initialDocument);
    }
  }, [initialDocument, setDocument]);

  useEffect(() => {
    setOnChangeHandler(onChange ?? null);
  }, [onChange, setOnChangeHandler]);

  useEffect(() => {
    setVariableCatalog(variableCatalog ?? []);
  }, [variableCatalog, setVariableCatalog]);

  const sampleVariables = useMemo(
    () => buildSampleVariablesFromCatalog(variableCatalog),
    [variableCatalog],
  );

  // Host-supplied context.variables wins on key conflicts — the catalog only fills gaps
  // so the canvas can preview bindings without the host needing to wire live data itself.
  const previewContext = useMemo<RuntimeContext | undefined>(() => {
    if (Object.keys(sampleVariables).length === 0) {
      return context;
    }
    return { ...context, variables: { ...sampleVariables, ...(context?.variables ?? {}) } };
  }, [context, sampleVariables]);

  const viewportWidthMap: Record<Viewport, string> = {
    desktop: 'w-full max-w-6xl',
    tablet: 'w-full max-w-[768px] sm:w-[768px]',
    mobile: 'w-full max-w-[375px] sm:w-[375px]',
  };

  const viewportIcons: Record<Viewport, React.ReactNode> = {
    desktop: <Monitor className="w-3.5 h-3.5" />,
    tablet: <Tablet className="w-3.5 h-3.5" />,
    mobile: <Smartphone className="w-3.5 h-3.5" />,
  };

  const resolvedConfig = useMemo(() => resolveEditorConfig(config), [config]);
  // Resolved but not yet wired into any panel UI — the chat/generate panel lands in a
  // later epic (EPIC-51+). Resolving here keeps `ai` a validated, always-safe-to-pass prop
  // today; `data-ai-enabled` lets tests confirm the prop is opt-in with zero UI impact.
  const resolvedAiConfig = useMemo(() => resolveAiEditorConfig(ai), [ai]);

  return (
    <div
      data-ai-enabled={resolvedAiConfig.enabled}
      className={`flex flex-col h-full bg-slate-100 text-slate-900 relative overflow-hidden ${className || ''}`}
    >
      {/* Floating Navigator */}
      {navigatorMode === 'floating' && <LayersPanel registry={registry} />}

      {/* Floating Table Spreadsheet Editor */}
      {activeTable && tableSpreadsheetMode === 'floating' && (
        <TableSpreadsheetEditor
          registry={registry}
          tableNode={activeTable}
          mode="floating"
          onToggleMode={() => setTableSpreadsheetMode('docked')}
          onClose={() => setTableSpreadsheetMode('hidden')}
        />
      )}

      {/* Mobile Sidebar Drawer Modal */}
      {isMobileSidebarOpen && resolvedConfig.sidebar.enabled && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-slate-800">Add Components & Blocks</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <LeftSidebar registry={registry} config={resolvedConfig.sidebar} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Inspector Drawer Modal */}
      {isMobileInspectorOpen && resolvedConfig.inspector.enabled && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileInspectorOpen(false)}
          />
          <div className="relative w-84 max-w-[90vw] sm:max-w-md bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-slate-800">
                  {selectedNodeId ? `Inspector (#${selectedNodeId})` : 'Inspector & Properties'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileInspectorOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <InspectorPanel registry={registry} config={resolvedConfig.inspector} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Layers / Navigator Drawer Modal */}
      {isMobileLayersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileLayersOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-xs text-slate-800">Element Tree / Layers</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileLayersOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <LayersPanel registry={registry} />
            </div>
          </div>
        </div>
      )}

      {/* Editor Top Toolbar */}
      {resolvedConfig.toolbar.enabled && (
        <div className="flex items-center justify-between px-3 py-1.5 sm:px-4 sm:py-2 bg-white border-b border-slate-200 gap-2 overflow-x-auto min-h-[44px]">
          {resolvedConfig.toolbar.showTitle ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-slate-800 text-xs sm:text-sm tracking-tight">
                KUBUILD Editor
              </span>
              <span className="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border max-w-[120px] sm:max-w-[200px] truncate font-medium">
                {document.metadata?.title || 'Untitled'}
              </span>
            </div>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 shrink-0">
            <EditorToolbar registry={registry} config={resolvedConfig.toolbar} />

            {/* Viewport switcher */}
            {resolvedConfig.toolbar.showViewportSwitcher && (
              <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 sm:p-1 rounded-md text-xs border border-slate-200/80">
                {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((vp) => (
                  <button
                    key={vp}
                    type="button"
                    onClick={() => setViewport(vp)}
                    title={`Switch to ${vp} preview`}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded capitalize font-medium transition flex items-center gap-1 text-[11px] sm:text-xs ${
                      viewport === vp
                        ? 'bg-white text-blue-600 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {viewportIcons[vp]}
                    <span className="hidden md:inline">{vp}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {resolvedConfig.toolbar.showSelectionStatus && (
            <div className="hidden xl:block text-xs text-slate-500 shrink-0 font-mono">
              {selectedNodeId ? `Selected: #${selectedNodeId}` : 'No element selected'}
            </div>
          )}
        </div>
      )}

      {/* Main Body: Desktop Docked Sidebars + Canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0 relative">
        {/* Desktop Left Sidebar */}
        {resolvedConfig.sidebar.enabled && (
          <div className="hidden lg:flex w-80 shrink-0 bg-white border-r border-slate-200 overflow-hidden flex-col min-h-0 h-full">
            <LeftSidebar registry={registry} config={resolvedConfig.sidebar} />
          </div>
        )}

        {navigatorMode === 'docked' && (
          <div className="hidden lg:flex w-60 shrink-0 bg-white border-r border-slate-200 overflow-hidden flex-col min-h-0 h-full">
            <LayersPanel registry={registry} />
          </div>
        )}

        {/* Central Canvas Area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 h-full bg-slate-100/90 relative">
          <div className="flex-1 overflow-auto p-2 sm:p-4 md:p-8 flex justify-center items-start min-h-0">
            <div
              className={`${viewportWidthMap[viewport]} bg-white shadow-md rounded-lg overflow-hidden transition-all duration-200 min-h-[500px] border border-slate-200`}
            >
              <EditorCanvas
                registry={registry}
                context={previewContext}
                viewport={viewport}
                onDiagnostic={onDiagnostic}
                config={resolvedConfig.canvas}
              />
            </div>
          </div>

          {/* Quick Edit Selected Floating Action Pill (Mobile only) */}
          {selectedNodeId && !isMobileInspectorOpen && resolvedConfig.inspector.enabled && (
            <div className="lg:hidden fixed bottom-14 left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2">
              <button
                type="button"
                onClick={() => setIsMobileInspectorOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl border border-blue-400/40 active:scale-95 transition"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Edit Element (#{selectedNodeId})</span>
              </button>
            </div>
          )}

          {resolvedConfig.canvas.showBreadcrumbs && <HierarchyBreadcrumbs registry={registry} />}

          {/* STORA-345: Live Form Testing & Action Debugger in Preview Mode */}
          {previewMode && actionDebuggerOpen && (
            <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
              <ActionDebuggerPanel />
            </div>
          )}
        </div>

        {/* Desktop Right Inspector */}
        {resolvedConfig.inspector.enabled && (
          <div className="hidden lg:flex w-72 shrink-0 bg-white border-l border-slate-200 overflow-hidden flex-col min-h-0 h-full">
            <InspectorPanel registry={registry} config={resolvedConfig.inspector} />
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only on < lg screens) */}
      <div className="flex lg:hidden items-center justify-around bg-white border-t border-slate-200 px-2 py-1.5 z-20 shrink-0 shadow-lg select-none min-h-[48px]">
        {resolvedConfig.sidebar.enabled && (
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-50 active:bg-slate-100 transition"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-medium">Add</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsMobileLayersOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-md text-slate-600 hover:text-blue-600 hover:bg-slate-50 active:bg-slate-100 transition"
        >
          <Layers className="w-4 h-4" />
          <span className="text-[10px] font-medium">Layers</span>
        </button>

        {resolvedConfig.inspector.enabled && (
          <button
            type="button"
            onClick={() => setIsMobileInspectorOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-md transition relative ${
              selectedNodeId
                ? 'text-blue-600 font-semibold'
                : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
            }`}
          >
            <div className="relative">
              <Sliders className="w-4 h-4" />
              {selectedNodeId && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
              )}
            </div>
            <span className="text-[10px]">{selectedNodeId ? 'Inspect *' : 'Inspect'}</span>
          </button>
        )}

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            title="Undo"
            className="p-2 rounded text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-600 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={redo}
            title="Redo"
            className="p-2 rounded text-slate-600 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-600 transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
