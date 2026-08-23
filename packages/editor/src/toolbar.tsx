import React, { useState } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { useEditorStore } from './store';

export interface EditorToolbarProps {
  registry: ComponentRegistry;
  className?: string;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ registry, className }) => {
  const {
    document,
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

  return (
    <div className={`flex items-center gap-1 ${className || ''}`}>
      {error && (
        <div
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1"
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
    </div>
  );
};
