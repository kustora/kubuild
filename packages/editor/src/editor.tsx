import React, { useEffect, useMemo } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { RuntimeContext, VariableCatalog, Diagnostic, buildSampleVariablesFromCatalog } from '@kubuild/core';
import { useEditorStore, Viewport } from './store';
import { EditorCanvas } from './canvas';
import { ComponentPanel } from './component-panel';
import { EditorToolbar } from './toolbar';
import { InspectorPanel } from './inspector-panel';
import { LayersPanel } from './layers-panel';
import { TableSpreadsheetEditor, findActiveTableNode } from './table-spreadsheet-editor';
import { HierarchyBreadcrumbs } from './breadcrumbs';
import { LeftSidebar } from './left-sidebar';

export interface KubuildEditorProps {
  initialDocument?: PageDocument;
  registry?: ComponentRegistry;
  context?: RuntimeContext;
  /** Host-declared bindable variables + preview-only sample values (STORA-053). Never written to the document. */
  variableCatalog?: VariableCatalog;
  onChange?: (doc: PageDocument) => void;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  className?: string;
}

export const KubuildEditor: React.FC<KubuildEditorProps> = ({
  initialDocument,
  registry = createDefaultComponentRegistry(),
  context,
  variableCatalog,
  onChange,
  onDiagnostic,
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
  } = useEditorStore();
  const lastLoadedDocRef = React.useRef<PageDocument | undefined>(undefined);

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
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  };

  return (
    <div className={`flex flex-col h-full bg-slate-100 text-slate-900 relative ${className || ''}`}>
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

      {/* Editor Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-sm">KUBUILD Editor</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border">
            {document.metadata?.title || 'Untitled'}
          </span>
        </div>

        <EditorToolbar registry={registry} />

        {/* Viewport switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs">
          {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((vp) => (
            <button
              key={vp}
              type="button"
              onClick={() => setViewport(vp)}
              className={`px-3 py-1 rounded capitalize font-medium transition ${
                viewport === vp
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {vp}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500">
          {selectedNodeId ? `Selected: #${selectedNodeId}` : 'No element selected'}
        </div>
      </div>

      {/* Main Body: Component Panel + Canvas */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="w-72 shrink-0 bg-white border-r border-slate-200 overflow-hidden flex flex-col min-h-0 h-full">
          <LeftSidebar registry={registry} />
        </div>

        {navigatorMode === 'docked' && (
          <div className="w-60 shrink-0 bg-white border-r border-slate-200 overflow-hidden flex flex-col min-h-0 h-full">
            <LayersPanel registry={registry} />
          </div>
        )}

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 h-full">
          <div className="flex-1 overflow-auto p-8 flex justify-center items-start min-h-0">
            <div
              className={`${viewportWidthMap[viewport]} bg-white shadow-md rounded-lg overflow-hidden transition-all duration-200 min-h-[600px] border border-slate-200`}
            >
              <EditorCanvas
                registry={registry}
                context={previewContext}
                viewport={viewport}
                onDiagnostic={onDiagnostic}
              />
            </div>
          </div>
          <HierarchyBreadcrumbs registry={registry} />
        </div>

        <div className="w-72 shrink-0 bg-white border-l border-slate-200 overflow-hidden flex flex-col min-h-0 h-full">
          <InspectorPanel registry={registry} />
        </div>
      </div>
    </div>
  );
};
