import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { PageDocument } from '@kubuild/schema';
import {
  importHtml,
  importHtmlZip,
  type HtmlImportOptions,
  type HtmlImportResult,
  type ZipImportResult,
  type HtmlImportDiagnostic,
} from '@kubuild/html-import';
import { useTranslation } from '../../i18n/index.js';

export interface HtmlImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (doc: PageDocument) => void;
  options?: Partial<HtmlImportOptions>;
}

export type HtmlImportTab = 'upload' | 'paste';

export const HtmlImportModal: React.FC<HtmlImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  options,
}) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<HtmlImportTab>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pastedHtml, setPastedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HtmlImportResult | ZipImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(() => {
    setFile(null);
    setPastedHtml('');
    setIsLoading(false);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const isZip = selectedFile.name.toLowerCase().endsWith('.zip');
      if (isZip) {
        const buffer = await selectedFile.arrayBuffer();
        const res = await importHtmlZip(buffer, options);
        if (!res.success) {
          setError(res.error || t.importHtmlFailed);
        }
        setResult(res);
      } else {
        const text = await selectedFile.text();
        const res = await importHtml(text, options);
        if (!res.success) {
          setError(res.error || t.importHtmlFailed);
        }
        setResult(res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.importHtmlFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  };

  const handleAnalyzePaste = async () => {
    if (!pastedHtml.trim() || isLoading) return;

    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const res = await importHtml(pastedHtml, options);
      if (!res.success) {
        setError(res.error || t.importHtmlFailed);
      }
      setResult(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.importHtmlFailed;
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (result?.success && result.document) {
      onImport(result.document);
      handleClose();
    }
  };

  const fidelityScore = result?.report?.stats?.fidelityScore ?? 0;
  const fidelityColor =
    fidelityScore >= 80
      ? 'bg-emerald-500'
      : fidelityScore >= 50
        ? 'bg-amber-500'
        : 'bg-red-500';
  const fidelityTextColor =
    fidelityScore >= 80
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : fidelityScore >= 50
        ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
        : 'text-red-400 border-red-500/30 bg-red-500/10';

  const diagnostics = result?.report?.diagnostics ?? [];
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="html-import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-mono text-xs font-semibold">
              &lt;/&gt;
            </div>
            <div>
              <h2 id="html-import-modal-title" className="text-base font-semibold text-white tracking-tight">
                {t.importHtmlModalTitle}
              </h2>
              <p className="text-xs text-slate-400">
                {t.importHtmlModalDescription}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 py-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('upload');
                resetState();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {t.importHtmlUploadTab}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('paste');
                resetState();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition cursor-pointer ${
                activeTab === 'paste'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {t.importHtmlPasteTab}
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          {/* Upload Tab View */}
          {activeTab === 'upload' && (
            <>
              {!file && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-800/40 transition group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-200">
                      {t.importHtmlDragDropHint}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {t.importHtmlFileFormatsHint}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm,.zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {file && (
                <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/60 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium text-slate-200 truncate">{file.name}</span>
                    <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetState}
                    className="text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded hover:bg-slate-700/50 transition cursor-pointer"
                  >
                    {t.importHtmlChangeFile}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Paste Tab View */}
          {activeTab === 'paste' && (
            <div className="flex flex-col gap-3">
              <textarea
                value={pastedHtml}
                onChange={(e) => setPastedHtml(e.target.value)}
                placeholder={t.importHtmlPastePlaceholder}
                rows={7}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAnalyzePaste}
                  disabled={!pastedHtml.trim() || isLoading}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white transition cursor-pointer shadow-xs"
                >
                  {isLoading && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {t.importHtmlAnalyzeButton}
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-6 gap-3 text-sm text-slate-400">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>{t.importHtmlAnalyzing}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && !isLoading && (
            <div className="p-3.5 bg-red-950/50 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* Report & Preview UI */}
          {result && !isLoading && (
            <div className="flex flex-col gap-4">
              {/* Document Metadata Preview */}
              {result.document && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">{t.importHtmlDocumentPreview}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">v{result.document.version}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                    <div>
                      <span className="text-slate-500 font-medium">{t.importHtmlTitleLabel}: </span>
                      <span className="text-slate-200 font-medium">{result.document.metadata?.title || 'Untitled'}</span>
                    </div>
                    {result.document.metadata?.description && (
                      <div className="truncate">
                        <span className="text-slate-500 font-medium">{t.importHtmlDescriptionLabel}: </span>
                        <span className="text-slate-300 truncate">{result.document.metadata.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fidelity & Stats Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                {/* Fidelity Score */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">{t.importHtmlFidelityScore}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${fidelityTextColor}`}>
                    {Math.round(fidelityScore)}% Fidelity
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${fidelityColor} transition-all duration-300 rounded-full`}
                    style={{ width: `${Math.max(5, Math.min(100, fidelityScore))}%` }}
                  />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/60">
                    <div className="text-base font-semibold text-white">{result.report.stats.nodeCount}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.importHtmlNodeCount}</div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/60">
                    <div className="text-base font-semibold text-amber-400">{result.report.stats.fallbackCount}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.importHtmlFallbacks}</div>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-2 border border-slate-800/60">
                    <div className="text-base font-semibold text-slate-400">{result.report.stats.droppedCount}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{t.importHtmlDroppedCount}</div>
                  </div>
                </div>
              </div>

              {/* Diagnostics Section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    {t.importHtmlDiagnostics}
                    <span className="text-slate-500 font-mono text-[11px]">({diagnostics.length})</span>
                  </span>
                  {(errorCount > 0 || warningCount > 0) && (
                    <div className="flex items-center gap-2 text-[11px] font-normal">
                      {errorCount > 0 && <span className="text-red-400 font-medium">{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
                      {warningCount > 0 && <span className="text-amber-400 font-medium">{warningCount} warning{warningCount > 1 ? 's' : ''}</span>}
                    </div>
                  )}
                </div>

                {diagnostics.length === 0 ? (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t.importHtmlNoDiagnostics}</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                    {diagnostics.map((diag: HtmlImportDiagnostic, idx: number) => {
                      const badgeClasses =
                        diag.severity === 'error'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : diag.severity === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      return (
                        <div
                          key={idx}
                          className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-semibold text-slate-300 truncate">
                              {diag.code}
                            </span>
                            <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-sm border shrink-0 ${badgeClasses}`}>
                              {diag.severity}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed">{diag.message}</p>
                          {(diag.location?.path || diag.location?.line || diag.location?.selector) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {diag.location.path ? `path: ${diag.location.path}` : ''}
                              {diag.location.line ? ` line: ${diag.location.line}` : ''}
                              {diag.location.selector ? ` selector: ${diag.location.selector}` : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 bg-slate-950/80 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          >
            {t.importHtmlCancelButton}
          </button>
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={!result?.success || !result?.document || isLoading}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition cursor-pointer shadow-xs"
          >
            {t.importHtmlConfirmButton}
          </button>
        </div>
      </div>
    </div>
  );
};
