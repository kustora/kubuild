import React, { useEffect } from 'react';
import { PageDocument } from '@kubuild/schema';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { RuntimeContext } from '@kubuild/core';
import { useEditorStore, Viewport } from './store';
import { EditorCanvas } from './canvas';

export interface KubuildEditorProps {
  initialDocument?: PageDocument;
  registry?: ComponentRegistry;
  context?: RuntimeContext;
  onChange?: (doc: PageDocument) => void;
  className?: string;
}

export const KubuildEditor: React.FC<KubuildEditorProps> = ({
  initialDocument,
  registry = createDefaultComponentRegistry(),
  context,
  onChange,
  className,
}) => {
  const { document, setDocument, setOnChangeHandler, viewport, setViewport, selectedNodeId } =
    useEditorStore();

  useEffect(() => {
    if (initialDocument) {
      setDocument(initialDocument);
    }
  }, [initialDocument, setDocument]);

  useEffect(() => {
    setOnChangeHandler(onChange ?? null);
  }, [onChange, setOnChangeHandler]);

  const viewportWidthMap: Record<Viewport, string> = {
    desktop: 'w-full max-w-6xl',
    tablet: 'w-[768px]',
    mobile: 'w-[375px]',
  };

  return (
    <div className={`flex flex-col h-full bg-slate-100 ${className || ''}`}>
      {/* Editor Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800 text-sm">KUBUILD Editor</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border">
            {document.metadata?.title || 'Untitled'}
          </span>
        </div>

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

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
        <div
          className={`${viewportWidthMap[viewport]} bg-white shadow-md rounded-lg overflow-hidden transition-all duration-200 min-h-[600px] border border-slate-200`}
        >
          <EditorCanvas registry={registry} context={context} viewport={viewport} />
        </div>
      </div>
    </div>
  );
};
