import React, { useState, useMemo } from 'react';
import { KubuildEditor, ImportModal, downloadDocumentAsStora, downloadDocumentAsJson } from '@kubuild/editor';
import { KubuildRenderer, PreviewViewportAdapter, ViewportDevice, createMinimalRenderContext } from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { PageDocument, starterPageFixture } from '@kubuild/schema';
import { Layout, Eye, Code2, Sparkles, Download, Upload } from 'lucide-react';

export function App() {
  const [doc, setDoc] = useState<PageDocument>(starterPageFixture);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'json'>('editor');
  const [previewViewport, setPreviewViewport] = useState<ViewportDevice>('desktop');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const registry = createDefaultComponentRegistry();


  // Minimal offline RenderContext injected by host without network dependency
  const renderContext = useMemo(
    () =>
      createMinimalRenderContext({
        variables: {
          siteName: 'KUBUILD Demo',
          authorName: 'KUBUILD Team',
        },
        assets: {
          'starter-hero': 'https://picsum.photos/640/360',
        },
        actions: {
          navigate: (payload?: Record<string, unknown>) => {
            console.log('[Playground Action] Navigate called with payload:', payload);
          },
        },
      }),
    [],
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              KUBUILD <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">BUILDER-01</span>
            </h1>
            <p className="text-xs text-slate-400">Stora Reference Playground</p>
          </div>
        </div>

        {/* Actions & View mode switcher */}
        <div className="flex items-center gap-3">
          {/* Quick Package Actions */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Import .stora package"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Import
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await downloadDocumentAsStora(doc, undefined, { componentRegistry: registry });
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : String(e));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
              title="Export .stora archive package"
            >
              <Download className="w-3.5 h-3.5" />
              Export .stora
            </button>
            <button
              type="button"
              onClick={() => downloadDocumentAsJson(doc)}
              className="px-2.5 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Export as JSON"
            >
              JSON
            </button>
          </div>

          {/* View mode switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'editor'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              Visual Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Live Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'json'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Document Tree
            </button>
          </div>
        </div>
      </header>

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={(importedDoc) => {
          setDoc(importedDoc);
        }}
        registry={registry}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'editor' && (
          <KubuildEditor
            initialDocument={doc}
            onChange={setDoc}
            registry={registry}
            className="h-full"
          />
        )}

        {activeTab === 'preview' && (
          <div className="h-full overflow-auto bg-slate-950/80 p-8 flex justify-center items-start">
            <PreviewViewportAdapter
              document={doc}
              registry={registry}
              context={renderContext}
              viewport={previewViewport}
              onViewportChange={setPreviewViewport}
              showChrome={true}
              canvasClassName="bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-200"
            />
          </div>
        )}

        {activeTab === 'json' && (
          <div className="h-full overflow-auto p-6 bg-slate-950 font-mono text-xs text-emerald-400 leading-relaxed">
            <pre>{JSON.stringify(doc, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
