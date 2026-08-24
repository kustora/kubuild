import React, { useState } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { useEditorStore } from './store';
import { ImportModal } from './import-modal';
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
    duplicateComponent,
    deleteComponent,
    copyNode,
    pasteNode,
    undo,
    redo,
  } = useEditorStore();
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
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
    setError(result.success ? null : result.error ?? 'Could not duplicate the selected element.');
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    const result = deleteComponent(selectedNodeId);
    setError(result.success ? null : result.error ?? 'Could not delete the selected element.');
  };

  const handleExportStora = async () => {
    setIsExporting(true);
    setError(null);
    try {
      await downloadDocumentAsStora(document, undefined, { componentRegistry: registry });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = () => {
    try {
      downloadDocumentAsJson(document);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div className={`flex items-center gap-1 ${className || ''}`}>
        {error && (
          <div
            role="alert"
            className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mr-1"
          >
            {error}
          </div>
        )}
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
    </>
  );
};

