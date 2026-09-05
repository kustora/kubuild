import React, { useState } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { useEditorStore } from '../../store';
import { ImportModal } from '../modals/import-modal';
import { CodeViewerModal } from '../modals/code-viewer-modal';
import { downloadDocumentAsStora, downloadDocumentAsJson } from '../../utils';
import { Copy, ClipboardPaste, CopyPlus, Trash2, Undo2, Redo2, Play, Square, Terminal, Sparkles } from 'lucide-react';

import { EditorToolbarConfig, isAiChatPanelActive } from '../../config';

export interface EditorToolbarProps {
  registry: ComponentRegistry;
  className?: string;
  showExportImport?: boolean;
  config?: EditorToolbarConfig;
  /**
   * Whether any AI capability is actually turned on in `AiEditorConfig` (STORA-504).
   * The AI Chat toggle button only ever renders when this is `true`, regardless of
   * `config.showAiChatToggle` — AI must stay fully invisible when not configured.
   */
  aiEnabled?: boolean;
}

interface ToolbarIconButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  'data-testid'?: string;
}

const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  icon,
  label,
  shortcut,
  onClick,
  disabled = false,
  danger = false,
  'data-testid': testId,
}) => {
  return (
    <div className="relative group flex items-center justify-center">
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        aria-label={`${label}${shortcut ? ` (${shortcut})` : ''}`}
        title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
        className={`p-1.5 rounded border border-slate-200 bg-white transition flex items-center justify-center cursor-pointer ${
          danger
            ? 'text-slate-700 hover:border-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-200'
            : 'text-slate-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-700 disabled:hover:border-slate-200'
        }`}
      >
        {icon}
      </button>

      {/* Floating tooltip on hover */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full mb-1.5 hidden group-hover:flex flex-col items-center z-50 animate-fadeIn select-none"
      >
        <div className="bg-slate-900 text-white text-[11px] font-medium px-2 py-0.5 rounded shadow-md whitespace-nowrap flex items-center gap-1.5">
          <span>{label}</span>
          {shortcut && <span className="text-slate-400 text-[10px] font-mono">{shortcut}</span>}
        </div>
        <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1" />
      </div>
    </div>
  );
};

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  registry,
  className,
  showExportImport: propShowExportImport = true,
  config,
  aiEnabled = false,
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
    aiChatMode,
    toggleAiChat,
    duplicateComponent,
    deleteComponent,
    copyNode,
    pasteNode,
    undo,
    redo,
    previewMode,
    togglePreviewMode,
    actionDebuggerOpen,
    toggleActionDebugger,
  } = useEditorStore();
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isCodeViewerModalOpen, setIsCodeViewerModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const showNavigatorToggle = config?.showNavigatorToggle !== false;
  const showAiChatToggle = config?.showAiChatToggle !== false && aiEnabled;
  const showHistory = config?.showHistory !== false;
  const showClipboard = config?.showClipboard !== false;
  const showCodeViewer = config?.showCodeViewer !== false;
  const showExportImport = propShowExportImport && config?.showExportImport !== false;
  const showPreviewToggle = config?.showPreviewToggle !== false;
  const showActionDebugger = config?.showActionDebugger !== false;
  const customActions = config?.customActions;

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
    setError(result.success ? null : (result.error ?? 'Could not paste here.'));
  };

  const handleDuplicate = () => {
    if (!selectedNodeId) return;
    const result = duplicateComponent(selectedNodeId, registry);
    setError(result.success ? null : (result.error ?? 'Could not duplicate.'));
  };

  const handleDelete = () => {
    if (!selectedNodeId) return;
    const result = deleteComponent(selectedNodeId);
    setError(result.success ? null : (result.error ?? 'Could not delete.'));
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

        {showNavigatorToggle && (
          <button
            type="button"
            title={`Navigator / Element Tree (${navigatorMode !== 'hidden' ? 'Open' : 'Hidden'})`}
            onClick={toggleNavigator}
            className={`hidden sm:flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition font-medium cursor-pointer ${
              navigatorMode !== 'hidden'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>Navigator</span>
          </button>
        )}

        {showAiChatToggle && (
          <button
            type="button"
            data-testid="toolbar-ai-chat-toggle"
            title={`AI Chat (${isAiChatPanelActive(aiChatMode) ? 'Open' : 'Hidden'})`}
            onClick={toggleAiChat}
            aria-pressed={isAiChatPanelActive(aiChatMode)}
            className={`hidden sm:flex items-center gap-1 text-xs px-2.5 py-1 rounded border transition font-medium cursor-pointer ${
              isAiChatPanelActive(aiChatMode)
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>AI Chat</span>
          </button>
        )}

        {(showNavigatorToggle || showAiChatToggle) &&
          (showClipboard || showHistory || showCodeViewer || showExportImport) && (
            <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1" />
          )}

        {(showClipboard || showHistory) && (
          <div className="flex items-center gap-1">
            {showClipboard && (
              <>
                <ToolbarIconButton
                  icon={<Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Copy"
                  shortcut="Ctrl/Cmd+C"
                  disabled={!hasSelection}
                  onClick={handleCopy}
                  data-testid="toolbar-copy"
                />
                <ToolbarIconButton
                  icon={<ClipboardPaste className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Paste"
                  shortcut="Ctrl/Cmd+V"
                  disabled={!canPaste}
                  onClick={handlePaste}
                  data-testid="toolbar-paste"
                />
                <ToolbarIconButton
                  icon={<CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Duplicate"
                  shortcut="Ctrl/Cmd+D"
                  disabled={!hasSelection}
                  onClick={handleDuplicate}
                  data-testid="toolbar-duplicate"
                />
                <ToolbarIconButton
                  icon={<Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Delete"
                  shortcut="Del"
                  disabled={!hasSelection}
                  onClick={handleDelete}
                  danger
                  data-testid="toolbar-delete"
                />
              </>
            )}
            {showClipboard && showHistory && <div className="h-3.5 w-px bg-slate-200 mx-0.5" />}
            {showHistory && (
              <>
                <ToolbarIconButton
                  icon={<Undo2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Undo"
                  shortcut="Ctrl/Cmd+Z"
                  disabled={!canUndo}
                  onClick={undo}
                  data-testid="toolbar-undo"
                />
                <ToolbarIconButton
                  icon={<Redo2 className="w-3.5 h-3.5" aria-hidden="true" />}
                  label="Redo"
                  shortcut="Ctrl/Cmd+Shift+Z"
                  disabled={!canRedo}
                  onClick={redo}
                  data-testid="toolbar-redo"
                />
              </>
            )}
          </div>
        )}

        {(showClipboard || showHistory) && (showCodeViewer || showExportImport) && (
          <div className="hidden sm:block h-4 w-px bg-slate-200 mx-1" />
        )}

        {showCodeViewer && (
          <button
            type="button"
            title="View Semantic HTML & CSS (< >)"
            onClick={() => setIsCodeViewerModalOpen(true)}
            className="flex items-center gap-1.5 text-xs px-2 sm:px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 transition"
          >
            <span className="font-mono text-[11px] font-bold text-blue-600">&lt;&gt;</span>
            <span className="hidden sm:inline">View Code</span>
          </button>
        )}

        {showExportImport && (
          <div className="flex items-center gap-1">
            {showCodeViewer && <div className="h-4 w-px bg-slate-200 mx-1" />}
            <button
              type="button"
              title="Import .stora Package"
              onClick={() => setIsImportModalOpen(true)}
              className="text-xs px-2 sm:px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 transition cursor-pointer"
            >
              Import
            </button>
            <button
              type="button"
              title="Export .stora Archive"
              disabled={isExporting}
              onClick={handleExportStora}
              className="text-xs px-2 sm:px-2.5 py-1 rounded border border-blue-600 bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 transition shadow-xs cursor-pointer"
            >
              {isExporting ? '...' : 'Export'}
            </button>
            <button
              type="button"
              title="Download page.json"
              onClick={handleExportJson}
              className="hidden md:inline-block text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:border-slate-400 text-slate-600 transition cursor-pointer"
            >
              JSON
            </button>
          </div>
        )}

        {showPreviewToggle && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="toolbar-preview-toggle"
                title={previewMode ? 'Exit Preview (Switch to Edit mode)' : 'Interactive Preview Mode'}
                onClick={togglePreviewMode}
                className={`text-xs px-2.5 py-1 rounded border transition font-medium flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  previewMode
                    ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold'
                    : 'border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 text-slate-700'
                }`}
              >
                {previewMode ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Editing</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-600" />
                    <span>Preview</span>
                  </>
                )}
              </button>

              {previewMode && showActionDebugger && (
                <button
                  type="button"
                  data-testid="toolbar-debugger-toggle"
                  title={actionDebuggerOpen ? 'Hide Form & Action Debugger' : 'Show Form & Action Debugger'}
                  onClick={toggleActionDebugger}
                  className={`text-xs px-2 py-1 rounded border transition font-medium flex items-center gap-1.5 cursor-pointer ${
                    actionDebuggerOpen
                      ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                      : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Debugger</span>
                </button>
              )}
            </div>
          </>
        )}

        {customActions && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <div className="flex items-center gap-1">{customActions}</div>
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
