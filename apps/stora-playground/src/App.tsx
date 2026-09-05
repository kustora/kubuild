import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  KubuildEditor,
  ImportModal,
  downloadDocumentAsStora,
  downloadDocumentAsJson,
  Viewport,
} from '@kubuild/editor';
import {
  PreviewViewportAdapter,
  ViewportDevice,
  createMinimalRenderContext,
} from '@kubuild/renderer';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import { PageDocument, starterPageFixture } from '@kubuild/schema';
import {
  Layout,
  Eye,
  Code2,
  Sparkles,
  Download,
  Upload,
  Plus,
  FileText,
  ChevronDown,
  Trash2,
  Copy,
  Pencil,
  Check,
  X,
} from 'lucide-react';

export interface ProjectPage {
  id: string;
  name: string;
  slug: string;
  document: PageDocument;
  width?: number;
  viewport?: Viewport;
}

const INITIAL_PAGES: ProjectPage[] = [
  {
    id: 'page-home',
    name: 'Home',
    slug: '/',
    document: starterPageFixture,
    width: 1200,
    viewport: 'desktop',
  },
  {
    id: 'page-about',
    name: 'About Us',
    slug: '/about',
    width: 1200,
    viewport: 'desktop',
    document: {
      schema: 'stora.page',
      version: '1.0.0',
      metadata: {
        title: 'About Us',
        description: 'About our company and team',
        author: 'KUBUILD Team',
        tags: ['about', 'company'],
        category: 'about',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      document: {
        id: 'root-page',
        type: 'page',
        props: { title: 'About Us' },
        styles: {
          base: {
            backgroundColor: '#ffffff',
            fontFamily: 'Inter, sans-serif',
            color: '#111827',
            minHeight: '100vh',
          },
        },
        children: [
          {
            id: 'about-section',
            type: 'section',
            props: {},
            styles: {
              base: {
                paddingTop: '64px',
                paddingBottom: '64px',
                paddingLeft: '24px',
                paddingRight: '24px',
                backgroundColor: '#f8fafc',
              },
            },
            children: [
              {
                id: 'about-container',
                type: 'container',
                props: { maxWidth: '800px' },
                styles: {
                  base: {
                    margin: '0 auto',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px',
                  },
                },
                children: [
                  {
                    id: 'about-heading',
                    type: 'heading',
                    props: { text: 'About Our Platform', level: 1 },
                    styles: {
                      base: { fontSize: '40px', fontWeight: '800', color: '#0f172a' },
                    },
                    children: [],
                  },
                  {
                    id: 'about-text',
                    type: 'text',
                    props: {
                      content:
                        'We build modern, declarative web tools that work anywhere. Empowering creators to design without friction.',
                    },
                    styles: {
                      base: { fontSize: '18px', color: '#475569', lineHeight: '1.6' },
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  },
];

export function App() {
  const [pages, setPages] = useState<ProjectPage[]>(INITIAL_PAGES);
  const [activePageId, setActivePageId] = useState<string>('page-home');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview' | 'json'>('editor');
  const [previewViewport, setPreviewViewport] = useState<ViewportDevice>('desktop');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState<boolean>(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState<boolean>(false);
  const [isAddPageModalOpen, setIsAddPageModalOpen] = useState<boolean>(false);
  const [newPageName, setNewPageName] = useState<string>('');
  const [newPageSlug, setNewPageSlug] = useState<string>('');
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [editingPageName, setEditingPageName] = useState<string>('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const registry = useMemo(() => createDefaultComponentRegistry(), []);

  const activePage = useMemo(() => {
    return pages.find((p) => p.id === activePageId) || pages[0];
  }, [pages, activePageId]);

  // Update active page document when changed in editor
  const handleDocChange = (updatedDoc: PageDocument) => {
    setPages((prev) =>
      prev.map((p) => (p.id === activePageId ? { ...p, document: updatedDoc } : p)),
    );
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setIsPageDropdownOpen(false);
      }
      if (
        actionsDropdownRef.current &&
        !actionsDropdownRef.current.contains(e.target as HTMLElement)
      ) {
        setIsMobileActionsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreatePage = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPageName.trim() || 'New Page';
    const slug = newPageSlug.trim().startsWith('/')
      ? newPageSlug.trim()
      : `/${newPageSlug.trim().toLowerCase().replace(/\s+/g, '-') || name.toLowerCase().replace(/\s+/g, '-')}`;
    const id = `page-${Date.now().toString(36)}`;
    const newDoc = createBlankDocument(name);

    const createdPage: ProjectPage = {
      id,
      name,
      slug,
      document: newDoc,
      width: 1200,
      viewport: 'desktop',
    };

    setPages((prev) => [...prev, createdPage]);
    setActivePageId(id);
    setNewPageName('');
    setNewPageSlug('');
    setIsAddPageModalOpen(false);
    setIsPageDropdownOpen(false);
  };

  const handleDuplicatePage = (pageToDup: ProjectPage) => {
    const id = `page-${Date.now().toString(36)}`;
    const duplicated: ProjectPage = {
      id,
      name: `${pageToDup.name} (Copy)`,
      slug: `${pageToDup.slug}-copy`,
      document: JSON.parse(JSON.stringify(pageToDup.document)),
      width: pageToDup.width ?? 1200,
      viewport: pageToDup.viewport ?? 'desktop',
    };
    setPages((prev) => [...prev, duplicated]);
    setActivePageId(id);
    setIsPageDropdownOpen(false);
  };

  const handleDeletePage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pages.length <= 1) {
      alert('You must keep at least one page in the project.');
      return;
    }
    const remaining = pages.filter((p) => p.id !== id);
    setPages(remaining);
    if (activePageId === id) {
      setActivePageId(remaining[0].id);
    }
  };

  const handleSaveRename = (id: string) => {
    if (!editingPageName.trim()) {
      setEditingPageId(null);
      return;
    }
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, name: editingPageName.trim() } : p)));
    setEditingPageId(null);
  };

  // Minimal offline RenderContext injected by host without network dependency
  const renderContext = useMemo(
    () =>
      createMinimalRenderContext({
        variables: {
          siteName: 'KUBUILD Demo',
          authorName: 'KUBUILD Team',
          pageTitle: activePage.name,
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
    [activePage.name],
  );

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Top Header */}
      <header className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-3 bg-slate-950 border-b border-slate-800 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/30 shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                KUBUILD{' '}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">
                  BUILDER-01
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Stora Multi-Page Studio</p>
            </div>
          </div>

          <div className="hidden sm:block h-5 w-px bg-slate-800 shrink-0" />

          {/* Multi-Page Selector Dropdown */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 hover:border-blue-500 transition shadow-xs max-w-[130px] sm:max-w-[200px]"
              title="Switch or manage pages"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold text-slate-100 truncate">{activePage.name}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isPageDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isPageDropdownOpen && (
              <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800/80 mb-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Pages ({pages.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPageDropdownOpen(false);
                      setIsAddPageModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Page
                  </button>
                </div>

                <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {pages.map((p) => {
                    const isActive = p.id === activePageId;
                    const isEditing = editingPageId === p.id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (!isEditing) {
                            setActivePageId(p.id);
                            setIsPageDropdownOpen(false);
                          }
                        }}
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition ${
                          isActive
                            ? 'bg-blue-600/15 border border-blue-500/40 text-blue-200'
                            : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText
                            className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`}
                          />
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingPageName}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingPageName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(p.id);
                                if (e.key === 'Escape') setEditingPageId(null);
                              }}
                              style={{ color: '#ffffff', backgroundColor: '#1e293b' }}
                              className="bg-slate-800 border border-blue-500 rounded px-2 py-1 text-xs text-white font-medium outline-none w-full"
                            />
                          ) : (
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono truncate">
                                {p.slug}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveRename(p.id);
                                }}
                                className="p-1 hover:bg-blue-600 rounded text-slate-200"
                                title="Save"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPageId(null);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPageId(p.id);
                                  setEditingPageName(p.name);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                                title="Rename"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDuplicatePage(p);
                                }}
                                className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
                                title="Duplicate"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {pages.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePage(p.id, e)}
                                  className="p-1 hover:bg-red-900/50 hover:text-red-300 rounded text-slate-400"
                                  title="Delete page"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions & View mode switcher */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Desktop Quick Package Actions */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setIsAddPageModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
              title="Add a new page to project"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Page
            </button>
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
                  await downloadDocumentAsStora(activePage.document, undefined, {
                    componentRegistry: registry,
                  });
                } catch (e: unknown) {
                  alert(e instanceof Error ? e.message : String(e));
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
              title="Export active page as .stora archive"
            >
              <Download className="w-3.5 h-3.5" />
              Export .stora
            </button>
            <button
              type="button"
              onClick={() => downloadDocumentAsJson(activePage.document)}
              className="px-2.5 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Export active page as JSON"
            >
              JSON
            </button>
          </div>

          {/* Mobile Actions Dropdown Trigger */}
          <div className="relative lg:hidden" ref={actionsDropdownRef}>
            <button
              type="button"
              onClick={() => setIsMobileActionsOpen(!isMobileActionsOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition"
              title="Page and package actions"
            >
              <span>Actions</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${isMobileActionsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isMobileActionsOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionsOpen(false);
                    setIsAddPageModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  Add New Page
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionsOpen(false);
                    setIsImportOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  Import .stora
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setIsMobileActionsOpen(false);
                    try {
                      await downloadDocumentAsStora(activePage.document, undefined, {
                        componentRegistry: registry,
                      });
                    } catch (e: unknown) {
                      alert(e instanceof Error ? e.message : String(e));
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                  Export .stora
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileActionsOpen(false);
                    downloadDocumentAsJson(activePage.document);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Download JSON
                </button>
              </div>
            )}
          </div>

          {/* View mode switcher */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 sm:p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              title="Visual Editor"
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'editor'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              title="Live Preview"
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              title="Document Tree"
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'json'
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">JSON</span>
            </button>
          </div>
        </div>
      </header>

      {/* Add Page Modal */}
      {isAddPageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Add New Page
              </h2>
              <button
                type="button"
                onClick={() => setIsAddPageModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Page Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Services, Pricing, Contact"
                  value={newPageName}
                  autoFocus
                  onChange={(e) => {
                    setNewPageName(e.target.value);
                    if (
                      !newPageSlug ||
                      newPageSlug === `/${newPageName.toLowerCase().replace(/\s+/g, '-')}`
                    ) {
                      setNewPageSlug(`/${e.target.value.toLowerCase().replace(/\s+/g, '-')}`);
                    }
                  }}
                  style={{ color: '#ffffff', backgroundColor: '#1e293b' }}
                  className="w-full text-sm text-white placeholder:text-slate-400 bg-slate-800 border border-slate-600 rounded-lg px-3.5 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-medium transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  URL Path / Slug
                </label>
                <input
                  type="text"
                  placeholder="/pricing"
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value)}
                  style={{ color: '#93c5fd', backgroundColor: '#1e293b' }}
                  className="w-full text-sm font-mono text-blue-300 placeholder:text-slate-400 bg-slate-800 border border-slate-600 rounded-lg px-3.5 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 font-medium transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPageModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition"
                >
                  Create Page
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={(importedDoc) => {
          handleDocChange(importedDoc);
        }}
        registry={registry}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden min-h-0">
        {activeTab === 'editor' && (
          <KubuildEditor
            pages={pages}
            activePageId={activePageId}
            onActivePageChange={setActivePageId}
            onPagesChange={(nextPages) => {
              setPages(
                nextPages.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug ?? '',
                  document: p.document,
                  width: p.width,
                  viewport: p.viewport,
                })),
              );
            }}
            initialDocument={activePage.document}
            onChange={handleDocChange}
            registry={registry}
            context={renderContext}
            className="h-full"
          />
        )}

        {activeTab === 'preview' && (
          <div className="h-full overflow-auto bg-slate-950/80 p-8 flex justify-center items-start">
            <PreviewViewportAdapter
              document={activePage.document}
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
            <pre>{JSON.stringify(activePage.document, null, 2)}</pre>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
