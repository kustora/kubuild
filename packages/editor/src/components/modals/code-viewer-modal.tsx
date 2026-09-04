import React, { useState, useMemo, useCallback } from 'react';
import type { PageDocument } from '@kubuild/schema';
import {
  generateSemanticHtml,
  generateDocumentCss,
  generateStandaloneHtml,
} from '@kubuild/renderer';
import { useEditorStore } from './store';
import { downloadFile, sanitizeDocumentFilename } from './export-utils';
import { CodeHighlighter } from './code-highlighter';

export interface CodeViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  document?: PageDocument;
}

export type CodeTab = 'combined' | 'html' | 'css';

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  isOpen,
  onClose,
  title = 'Live Code Viewer',
  document: customDoc,
}) => {
  const storeDoc = useEditorStore((state) => state.document);
  const doc = customDoc || storeDoc;
  const [activeTab, setActiveTab] = useState<CodeTab>('combined');
  const [copied, setCopied] = useState<boolean>(false);
  const [includeReset, setIncludeReset] = useState<boolean>(true);
  const [includeNodeClasses, setIncludeNodeClasses] = useState<boolean>(true);

  // Generate code based on active document and user options
  const htmlCode = useMemo(() => {
    return generateSemanticHtml(doc, {
      includeNodeClasses,
      indentSize: 2,
    });
  }, [doc, includeNodeClasses]);

  const cssCode = useMemo(() => {
    return generateDocumentCss(doc, {
      includeReset,
    });
  }, [doc, includeReset]);

  const combinedCode = useMemo(() => {
    return generateStandaloneHtml(doc, {
      htmlOptions: { includeNodeClasses, indentSize: 2 },
      cssOptions: { includeReset },
    });
  }, [doc, includeNodeClasses, includeReset]);

  const activeCode = useMemo(() => {
    switch (activeTab) {
      case 'html':
        return htmlCode;
      case 'css':
        return cssCode;
      case 'combined':
      default:
        return combinedCode;
    }
  }, [activeTab, htmlCode, cssCode, combinedCode]);

  const lineCount = useMemo(() => {
    return activeCode ? activeCode.split('\n').length : 0;
  }, [activeCode]);

  const charCount = useMemo(() => {
    return activeCode.length;
  }, [activeCode]);

  const countNodes = useCallback((node: any): number => {
    let count = 1;
    if (node?.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        count += countNodes(child);
      }
    }
    return count;
  }, []);

  const totalNodes = useMemo(() => {
    return countNodes(doc.document);
  }, [doc, countNodes]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers or restricted environments
      const textarea = window.document.createElement('textarea');
      textarea.value = activeCode;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      window.document.body.appendChild(textarea);
      textarea.select();
      window.document.execCommand('copy');
      window.document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeCode]);

  const handleDownload = useCallback(() => {
    const docTitle = doc.metadata?.title || 'page';
    if (activeTab === 'css') {
      const filename = sanitizeDocumentFilename(docTitle, 'css');
      downloadFile(cssCode, filename, 'text/css');
    } else {
      const filename = sanitizeDocumentFilename(docTitle, 'html');
      downloadFile(activeCode, filename, 'text/html');
    }
  }, [activeTab, activeCode, cssCode, doc.metadata?.title]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono text-xs font-semibold">
              &lt;&gt;
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="code-viewer-title" className="text-base font-semibold text-white tracking-tight">
                  {title}
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Production-ready clean semantic HTML & structured CSS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg border transition shadow-xs ${
                copied
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-500 border-blue-500 text-white active:scale-95'
              }`}
              title="Copy code to clipboard"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <span>Copy Code</span>
                </>
              )}
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700/80 text-slate-200 hover:text-white transition"
              title={`Download as .${activeTab === 'css' ? 'css' : 'html'}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close modal (Esc)"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab & Controls Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0 gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('combined')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                activeTab === 'combined'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              HTML &amp; CSS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('html')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                activeTab === 'html'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Semantic HTML
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('css')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                activeTab === 'css'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Structured CSS
            </button>
          </div>

          {/* Options Switches */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            {activeTab !== 'html' && (
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition">
                <input
                  type="checkbox"
                  checked={includeReset}
                  onChange={(e) => setIncludeReset(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Include CSS Reset</span>
              </label>
            )}

            {activeTab !== 'css' && (
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-300 transition">
                <input
                  type="checkbox"
                  checked={includeNodeClasses}
                  onChange={(e) => setIncludeNodeClasses(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Include Node Classes</span>
              </label>
            )}
          </div>
        </div>

        {/* Code Content View */}
        <div className="flex-1 min-h-0 bg-slate-950 overflow-auto font-mono text-xs text-slate-200 flex select-text">
          {/* Line Numbers */}
          <div className="py-4 pl-4 pr-3 select-none text-right text-slate-600 border-r border-slate-800/80 bg-slate-950/80 shrink-0 sticky left-0">
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i + 1} className="leading-5 h-5 font-mono text-[11px]">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Syntax Highlighted Code Area */}
          <div className="flex-1 p-4 overflow-x-auto">
            <CodeHighlighter code={activeCode} mode={activeTab} />
          </div>
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-t border-slate-800 bg-slate-900 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              <strong className="text-slate-300 font-semibold">{totalNodes}</strong> Elements
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>
              <strong className="text-slate-300 font-semibold">{lineCount}</strong> Lines
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>
              <strong className="text-slate-300 font-semibold">{(charCount / 1024).toFixed(1)}</strong> KB
            </span>
          </div>

          <div className="text-[11px] text-slate-500">
            Format: {activeTab === 'combined' ? 'Single-file HTML document' : activeTab === 'html' ? 'Semantic HTML markup' : 'Clean CSS stylesheet'}
          </div>
        </div>
      </div>
    </div>
  );
};
