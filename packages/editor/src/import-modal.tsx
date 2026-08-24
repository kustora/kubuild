import React, { useState, useRef } from 'react';
import { ComponentRegistry } from '@kubuild/components';
import { PageDocument, PageDocumentSchema } from '@kubuild/schema';
import {
  inspectPackage,
  importPackage,
  PreflightReport,
  MissingDependencyPolicy,
  validateDocument,
} from '@kubuild/core';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (doc: PageDocument) => void;
  registry: ComponentRegistry;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  registry,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [isJsonFile, setIsJsonFile] = useState<boolean>(false);
  const [jsonDoc, setJsonDoc] = useState<PageDocument | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [dependencyPolicy, setDependencyPolicy] = useState<MissingDependencyPolicy>('import-with-placeholder');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setFile(null);
    setFileBytes(null);
    setIsJsonFile(false);
    setJsonDoc(null);
    setIsLoading(false);
    setError(null);
    setPreflight(null);
    setDependencyPolicy('import-with-placeholder');
  };

  const handleClose = () => {
    resetState();
    onClose();
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

  const defaultSupportedCapabilities = [
    'assetProvider',
    'actionRegistry',
    'variableRegistry',
    'dataProvider',
  ];

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsLoading(true);
    setPreflight(null);
    setIsJsonFile(false);
    setJsonDoc(null);

    try {
      if (selectedFile.name.endsWith('.json')) {
        setIsJsonFile(true);
        const text = await selectedFile.text();
        const parsed = JSON.parse(text);
        const parseCheck = PageDocumentSchema.safeParse(parsed);
        if (!parseCheck.success) {
          throw new Error('Invalid Page Document JSON structure.');
        }
        const valResult = validateDocument(parseCheck.data, { componentRegistry: registry });
        if (!valResult.valid) {
          const firstErr = valResult.errors[0];
          throw new Error(`Document validation error: ${firstErr.message} at ${firstErr.path}`);
        }
        setJsonDoc(parseCheck.data);
      } else {
        // Assume .stora / zip archive
        const arrayBuffer = await selectedFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        setFileBytes(bytes);

        const report = await inspectPackage(bytes, {
          componentRegistry: registry,
          supportedCapabilities: defaultSupportedCapabilities,
          dependencyPolicy,
        });
        setPreflight(report);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolicyChange = async (newPolicy: MissingDependencyPolicy) => {
    setDependencyPolicy(newPolicy);
    if (fileBytes) {
      setIsLoading(true);
      try {
        const report = await inspectPackage(fileBytes, {
          componentRegistry: registry,
          supportedCapabilities: defaultSupportedCapabilities,
          dependencyPolicy: newPolicy,
        });
        setPreflight(report);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleConfirmImport = async () => {
    if (isJsonFile && jsonDoc) {
      onImport(jsonDoc);
      handleClose();
      return;
    }

    if (!fileBytes) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await importPackage(fileBytes, {
        componentRegistry: registry,
        supportedCapabilities: defaultSupportedCapabilities,
        dependencyPolicy,
      });

      if (!result.success) {
        const errors = result.errors
          .filter((d) => d.severity === 'error')
          .map((d) => d.message)
          .join('; ');
        throw new Error(`Import failed: ${errors || result.diagnosticMessage || 'Unknown error'}`);
      }

      onImport(result.document);
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const hasBlockingErrors =
    preflight &&
    (!preflight.canImport || preflight.diagnostics.some((d) => d.severity === 'error'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <h2 className="font-semibold text-base">Import .stora Package</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* Dropzone */}
          {!file && (
            <div
              onDragOver={(e) => e.preventDefault()}
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
                  Click to select or drag and drop package
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports .stora portable archive and .json page document</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".stora,.zip,.json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-6 gap-3 text-sm text-slate-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Inspecting package preflight...
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">{error}</div>
            </div>
          )}

          {/* File Selected Badge */}
          {file && !isLoading && (
            <div className="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700/60 rounded-lg text-xs">
              <div className="flex items-center gap-2 truncate">
                <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span className="font-medium text-slate-200 truncate">{file.name}</span>
                <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700/50 transition"
              >
                Change
              </button>
            </div>
          )}

          {/* JSON Preview */}
          {isJsonFile && jsonDoc && (
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Valid Page Document JSON
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Title:</span> {jsonDoc.metadata?.title || 'Untitled'}
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Schema Version:</span> {jsonDoc.version}
              </div>
            </div>
          )}

          {/* Preflight Report for .stora */}
          {preflight && (
            <div className="flex flex-col gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 flex flex-col gap-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="font-semibold text-slate-200">Preflight Inspection Report</div>
                  <div
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 ${
                      preflight.canImport && preflight.diagnostics.length === 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : preflight.canImport
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    <span>{preflight.canImport ? (preflight.diagnostics.length === 0 ? 'Ready' : 'Warnings') : 'Blocked'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>
                    <span className="text-slate-400">Package Version:</span>{' '}
                    {preflight.manifest?.packageVersion || '1.0.0'}
                  </div>
                  <div>
                    <span className="text-slate-400">Schema Version:</span>{' '}
                    {preflight.manifest?.schemaVersion || preflight.sourceVersion || '1.0.0'}
                  </div>
                  <div>
                    <span className="text-slate-400">Assets:</span>{' '}
                    {preflight.assetCount} item(s)
                  </div>
                  <div>
                    <span className="text-slate-400">Requires Migration:</span>{' '}
                    {preflight.requiresMigration ? 'Yes' : 'No'}
                  </div>
                </div>

                {/* Missing Components */}
                {preflight.missingComponents.length > 0 && (
                  <div className="mt-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <span>Missing Custom Components ({preflight.missingComponents.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preflight.missingComponents.map((c) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.5 bg-amber-900/40 border border-amber-700/50 rounded font-mono text-[10px] text-amber-200"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing Capabilities */}
                {preflight.missingCapabilities.length > 0 && (
                  <div className="mt-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                      <span>Missing Capabilities ({preflight.missingCapabilities.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preflight.missingCapabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 bg-amber-900/40 border border-amber-700/50 rounded font-mono text-[10px] text-amber-200"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policy Selector if there are missing dependencies */}
                {(preflight.missingComponents.length > 0 || preflight.missingCapabilities.length > 0) && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <label className="text-slate-400 text-[11px] font-medium">Import Policy Decision:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePolicyChange('import-with-placeholder')}
                        className={`p-2 rounded-lg border text-left text-xs transition ${
                          dependencyPolicy === 'import-with-placeholder'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-300 font-medium'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-medium">Use Placeholders</div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Keep nodes intact for placeholder rendering
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePolicyChange('cancel')}
                        className={`p-2 rounded-lg border text-left text-xs transition ${
                          dependencyPolicy === 'cancel'
                            ? 'border-red-500 bg-red-500/10 text-red-300 font-medium'
                            : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-medium">Strict (Block)</div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Abort import if any dependencies missing
                        </p>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={(!preflight && !jsonDoc) || !!hasBlockingErrors || isLoading}
            onClick={handleConfirmImport}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-lg shadow-blue-500/20"
          >
            Import to Editor
          </button>
        </div>
      </div>
    </div>
  );
};
