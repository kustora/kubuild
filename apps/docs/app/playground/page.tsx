'use client';

import React, { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Download,
  Copy,
  Check,
  BookOpen,
  LayoutTemplate,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { EditorHandle } from '@kubuild/editor';
import type { PageDocument } from '@kubuild/schema';
import {
  PLAYGROUND_TEMPLATES,
  SAAS_LANDING_DOC,
  CREATOR_BIO_DOC,
  MINIMAL_PORTFOLIO_DOC,
} from './templates';

// Dynamic import with ssr: false to prevent SSR hydration mismatches
const KubuildEditor = dynamic(
  () => import('@kubuild/editor').then((mod) => mod.KubuildEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3">
        <div className="size-9 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shadow-lg shadow-indigo-500/20" />
        <p className="text-sm font-medium tracking-wide text-neutral-300">
          Loading KUBUILD Interactive Editor...
        </p>
      </div>
    ),
  }
);

export default function PlaygroundPage() {
  const editorRef = useRef<EditorHandle | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('saas-landing');
  const [currentDoc, setCurrentDoc] = useState<PageDocument>(SAAS_LANDING_DOC);
  const [copied, setCopied] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);

  // Switch template
  const handleSelectTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    let targetDoc: PageDocument = SAAS_LANDING_DOC;
    if (templateId === 'creator-link-in-bio') {
      targetDoc = CREATOR_BIO_DOC;
    } else if (templateId === 'minimal-portfolio') {
      targetDoc = MINIMAL_PORTFOLIO_DOC;
    }

    setCurrentDoc(targetDoc);
    if (editorRef.current) {
      editorRef.current.replaceDocument(targetDoc);
    }
  }, []);

  // Export .stora JSON file
  const handleExportStora = useCallback(async () => {
    try {
      setExporting(true);
      const activeDoc = editorRef.current ? editorRef.current.getDocument() : currentDoc;
      const { downloadDocumentAsStora, downloadDocumentAsJson } = await import('@kubuild/editor');
      
      try {
        await downloadDocumentAsStora(activeDoc);
      } catch {
        // Fallback to formatted JSON export if zip archive creation is restricted in sandbox
        const filename = `${activeDoc.metadata?.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'page'}.stora.json`;
        downloadDocumentAsJson(activeDoc, filename);
      }
    } catch (err) {
      console.error('Failed to export document:', err);
    } finally {
      setExporting(false);
    }
  }, [currentDoc]);

  // Copy React embed code
  const handleCopyCode = useCallback(() => {
    const activeDoc = editorRef.current ? editorRef.current.getDocument() : currentDoc;
    const docTitle = activeDoc.metadata?.title || 'My Page';

    const codeSnippet = `import { KubuildRenderer } from '@kubuild/react';
// Import your exported .stora layout document
import pageDocument from './${activeDoc.metadata?.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'page'}.stora.json';

/**
 * Rendered visual page: ${docTitle}
 * Portable, responsive, and framework-agnostic.
 */
export default function PortablePage() {
  return (
    <main className="min-h-screen w-full">
      <KubuildRenderer document={pageDocument} />
    </main>
  );
}`;

    navigator.clipboard.writeText(codeSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [currentDoc]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 backdrop-blur-md z-30">
        {/* Left: Brand & Badge */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition hover:opacity-85 focus:outline-hidden"
            title="KUBUILD Home"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 via-violet-600 to-pink-500 text-white shadow-sm shadow-indigo-500/25 ring-1 ring-white/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="11" width="7" height="10" rx="1.5" />
                <rect x="3" y="13" width="7" height="8" rx="1.5" />
              </svg>
            </div>
            <span className="text-base font-extrabold tracking-tight text-white">KUBUILD</span>
          </Link>
          <span className="flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
            <Sparkles className="size-3" />
            Playground
          </span>
        </div>

        {/* Center: Template Selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <LayoutTemplate className="pointer-events-none absolute left-3 size-3.5 text-neutral-400" />
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              aria-label="Select sample template"
              className="h-8 appearance-none rounded-lg border border-neutral-700 bg-neutral-800/90 pl-8 pr-8 text-xs font-medium text-neutral-200 shadow-xs transition hover:border-neutral-600 focus:border-indigo-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="saas-landing">SaaS Landing Page</option>
              <option value="creator-link-in-bio">Creator Link-in-Bio</option>
              <option value="minimal-portfolio">Minimal Portfolio</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-neutral-400" />
          </div>
        </div>

        {/* Right: Actions & Docs Link */}
        <div className="flex items-center gap-2">
          {/* Export .stora Button */}
          <button
            type="button"
            onClick={handleExportStora}
            disabled={exporting}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs font-medium text-neutral-200 shadow-xs transition hover:bg-neutral-750 hover:text-white active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Download portable .stora package or JSON file"
          >
            <Download className="size-3.5 text-indigo-400" />
            <span>Export .stora</span>
          </button>

          {/* Copy React Code Button */}
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs font-medium text-neutral-200 shadow-xs transition hover:bg-neutral-750 hover:text-white active:scale-95 cursor-pointer"
            title="Copy React renderer embed snippet"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-neutral-400" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <div className="mx-1 h-4 w-px bg-neutral-800" />

          {/* Back to Docs Link */}
          <Link
            href="/docs"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-500 active:scale-95"
          >
            <BookOpen className="size-3.5" />
            <span>Docs</span>
            <ExternalLink className="size-3 opacity-70" />
          </Link>
        </div>
      </header>

      {/* Editor Body: Full Height Canvas */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        <KubuildEditor
          ref={editorRef}
          initialDocument={currentDoc}
          templates={PLAYGROUND_TEMPLATES}
          onChange={(newDoc) => setCurrentDoc(newDoc)}
          className="h-full w-full"
        />
      </main>
    </div>
  );
}
