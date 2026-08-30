import React, { useState } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { useEditorStore } from './store';
import { ImportModal } from './import-modal';
import { CodeViewerModal } from './code-viewer-modal';
import { downloadDocumentAsStora, downloadDocumentAsJson } from './export-utils';

export interface EditorToolbarProps {
  registry: ComponentRegistry;
  className?: string;
  showExportImport?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  registry,
  className,
  showExportImport = true,
}) => {
  const {
    document,
    setDocument,
    selectedNodeId,
    clipboard,
    canUndo,
    canRedo,
    navigatorMode,
    toggleNavigator,
    duplicateComponent,
    deleteComponent,
    copyNode,
    pasteNode,
    undo,
    redo,
  } = useEditorStore();
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isCodeViewerModalOpen, setIsCodeViewerModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const rootId = document.document.id;
  const hasSelection = !!selectedNodeId && selectedNodeId !== rootId;
  const canPaste = !!clipboard && !!selectedNodeId;

  const handleCopy = () => {
    if (!selectedNodeId) return;
    copyNode(selectedNodeId);
    setError(null);
  };

  const handlePaste = () => {
    if (!selectedNodeId) return;
    const result = pasteNode(selectedNodeId, registry);
    setError(result.success ? null : result.error ?? 'Could not paste here.');
  };

  const handleDuplicate = () => {
    if (!selectedNodeId) return;
    const result = duplicateComponent(selectedNodeId, registry);
    setError(result.success ? null : result.error ?? 'Could not duplicate.');
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    const result = deleteComponent(selectedNodeId);
    setError(result.success ? null : result.error ?? 'Could not delete.');
  };

  const handleExportStora = async () => {
    setError(null);
    setIsExporting(true);
    try {
      await downloadDocumentAsStora(document, undefined, { componentRegistry: registry });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during export.';
      setError(`Export failed: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    setError(null);
    try {
      downloadDocumentAsJson(document);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during JSON download.';
      setError(`JSON download failed: ${msg}`);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 ${className || ''}`}>
        {error && (
          <div
            role="alert"
            className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1 mr-1"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 font-bold ml-1"
            >
              ×
            </button>
          </div>
        )}

        <button
          type="button"
          title={`Navigator / Element Tree (${navigatorMode !== 'hidden' ? 'Open' : 'Hidden'})`}
          onClick={toggleNavigator}
          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition font-medium ${
            navigatorMode !== 'hidden'
              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <span>Navigator</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          title="Copy (Ctrl/Cmd+C)"
          disabled={!hasSelection}
          onClick={handleCopy}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Copy
        </button>
        <button
          type="button"
          title="Paste (Ctrl/Cmd+V)"
          disabled={!canPaste}
          onClick={handlePaste}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Paste
        </button>
        <button
          type="button"
          title="Duplicate (Ctrl/Cmd+D)"
          disabled={!hasSelection}
          onClick={handleDuplicate}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Duplicate
        </button>
        <button
          type="button"
          title="Delete (Del/Backspace)"
          disabled={!hasSelection}
          onClick={handleDelete}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-red-400 hover:text-red-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Delete
        </button>
        <button
          type="button"
          title="Undo (Ctrl/Cmd+Z)"
          disabled={!canUndo}
          onClick={undo}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Undo
        </button>
        <button
          type="button"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          disabled={!canRedo}
          onClick={redo}
          className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          Redo
        </button>

        <div className="h-4 w-px bg-slate-200 mx-1" />

        <button
          type="button"
          title="View Semantic HTML & CSS (< >)"
          onClick={() => setIsCodeViewerModalOpen(true)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 transition"
        >
          <span className="font-mono text-[11px] font-bold text-blue-600">&lt;&gt;</span>
          <span>View Code</span>
        </button>

        {showExportImport && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button
              type="button"
              title="Import .stora Package"
              onClick={() => setIsImportModalOpen(true)}
              className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 transition"
            >
              Import
            </button>
            <button
              type="button"
              title="Export .stora Archive"
              disabled={isExporting}
              onClick={handleExportStora}
              className="text-xs px-2.5 py-1 rounded border border-blue-600 bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition shadow-sm"
            >
              {isExporting ? 'Exporting...' : 'Export .stora'}
            </button>
            <button
              type="button"
              title="Download page.json"
              onClick={handleExportJson}
              className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-slate-400 text-slate-600 transition"
            >
              JSON
            </button>
          </>
        )}
      </div>

      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={(importedDoc) => {
          setDocument(importedDoc);
        }}
        registry={registry}
      />

      <CodeViewerModal
        isOpen={isCodeViewerModalOpen}
        onClose={() => setIsCodeViewerModalOpen(false)}
      />
    </>
  );
};

