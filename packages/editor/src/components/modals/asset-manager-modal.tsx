import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AssetProvider, AssetInfo } from '@kubuild/core';

export interface AssetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the resolved URL of the picked asset. */
  onSelect: (url: string) => void;
  /** Optional host-provided asset provider backing the local gallery tab. */
  assetProvider?: AssetProvider;
  /** Acceptable MIME types, e.g. ['image/*']. Defaults to images only. */
  accept?: string[];
  /** Title shown in the modal header. */
  title?: string;
}

type TabId = 'gallery' | 'url' | 'upload';

interface GalleryItem {
  id: string;
  url: string;
  name: string;
  mimeType: string;
}

const DEFAULT_ACCEPT = ['image/'];

const isAccepted = (mimeType: string, accept: string[]): boolean =>
  accept.some((pattern) => {
    // Normalize 'image/*' and 'image/' to a prefix match on 'image/'.
    const prefix = pattern.endsWith('/*') ? pattern.slice(0, -1) : pattern;
    return mimeType.startsWith(prefix);
  });

/**
 * STORA-250 — Unified asset picker modal.
 *
 * Three sources:
 *  - Gallery: assets listed by the host `AssetProvider` (local `.stora` gallery).
 *  - URL: direct CDN / external URL entry.
 *  - Upload: drag-and-drop or file-picker upload, resolved via
 *    `assetProvider.upload` when available, otherwise an in-memory object URL.
 *
 * Selecting an asset immediately invokes `onSelect(url)` so the caller can
 * update the target node's `src` prop instantly.
 */
export const AssetManagerModal: React.FC<AssetManagerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  assetProvider,
  accept = DEFAULT_ACCEPT,
  title = 'Asset Manager',
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('gallery');
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaded, setUploaded] = useState<GalleryItem[]>([]);
  const [providerAssets, setProviderAssets] = useState<GalleryItem[] | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const galleryItems = useMemo<GalleryItem[]>(() => {
    if (providerAssets) return providerAssets;
    return uploaded;
  }, [providerAssets, uploaded]);

  const loadProviderAssets = useCallback(async () => {
    if (!assetProvider?.list) {
      setProviderAssets([]);
      return;
    }
    try {
      const list = await assetProvider.list();
      setProviderAssets(
        list
          .filter((a: AssetInfo) => isAccepted(a.mimeType || '', accept))
          .map((a: AssetInfo) => ({
            id: a.id,
            url: a.url,
            name: a.alt || a.id,
            mimeType: a.mimeType || '',
          })),
      );
      setProviderError(null);
    } catch (err: unknown) {
      setProviderError(err instanceof Error ? err.message : String(err));
      setProviderAssets([]);
    }
  }, [assetProvider, accept]);

  // Load gallery assets each time the modal opens on the gallery tab.
  React.useEffect(() => {
    if (isOpen && activeTab === 'gallery' && providerAssets === null) {
      void loadProviderAssets();
    }
  }, [isOpen, activeTab, providerAssets, loadProviderAssets]);

  if (!isOpen) return null;

  const handlePick = (item: GalleryItem) => {
    onSelect(item.url);
    onClose();
  };

  const handleUrlSubmit = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setUrlError('URL is required.');
      return;
    }
    try {
      // Validate it is a well-formed absolute URL.
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError('Only http(s) URLs are supported.');
        return;
      }
    } catch {
      setUrlError('Enter a valid absolute URL (https://…).');
      return;
    }
    setUrlError(null);
    onSelect(trimmed);
    onClose();
  };

  const processFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const results: GalleryItem[] = [];
    try {
      for (const file of list) {
        if (!isAccepted(file.type || '', accept)) {
          throw new Error(`Unsupported file type: ${file.type || file.name}`);
        }
        if (assetProvider?.upload) {
          const info = await assetProvider.upload(file);
          results.push({
            id: info.id,
            url: info.url,
            name: info.alt || file.name,
            mimeType: info.mimeType || file.type,
          });
        } else {
          // Fallback: convert file to base64 Data URL so local images persist reliably.
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          results.push({
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            url: dataUrl,
            name: file.name,
            mimeType: file.type,
          });
        }
      }
      setUploaded((prev) => [...results, ...prev]);
      // Merge into provider list view if it was loaded.
      if (providerAssets !== null) {
        setProviderAssets([...results, ...providerAssets]);
      }
      // Instantly select the first uploaded asset.
      handlePick(results[0]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) {
      void processFiles(e.dataTransfer.files);
    }
  };

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'gallery', label: 'Gallery' },
    { id: 'url', label: 'CDN URL' },
    { id: 'upload', label: 'Upload' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h2 className="font-semibold text-base">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close asset manager"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
          {activeTab === 'gallery' && (
            <div className="flex flex-col gap-3">
              {providerError && (
                <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300">
                  Failed to load gallery: {providerError}
                </div>
              )}
              {providerAssets === null ? (
                <div className="flex items-center justify-center py-8 gap-3 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Loading gallery…
                </div>
              ) : galleryItems.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  <p className="font-medium text-slate-400">No assets in the local gallery yet.</p>
                  <p className="text-xs mt-1">
                    Upload files in the Upload tab, or provide an <code className="text-slate-400">AssetProvider</code> to
                    list package assets.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {galleryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePick(item)}
                      title={item.name}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 bg-slate-950/60 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        loading="lazy"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <span className="block text-[10px] text-slate-200 truncate">{item.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'url' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-slate-300" htmlFor="asset-url-input">
                Image URL
              </label>
              <div className="flex gap-2">
                <input
                  id="asset-url-input"
                  type="url"
                  value={urlValue}
                  onChange={(e) => {
                    setUrlValue(e.target.value);
                    setUrlError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUrlSubmit();
                  }}
                  placeholder="https://cdn.example.com/image.jpg"
                  className="flex-1 text-xs bg-slate-950/60 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
                >
                  Use URL
                </button>
              </div>
              {urlError && (
                <div className="text-xs text-red-400" role="alert">
                  {urlError}
                </div>
              )}
              {urlValue.trim() && !urlError && (
                <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950/60 p-3 flex items-center justify-center">
                  <img
                    src={urlValue}
                    alt="Preview"
                    className="max-h-48 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="flex flex-col gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-slate-700 hover:border-blue-500 bg-slate-950/40 hover:bg-slate-800/40'
                } group`}
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-200">
                    {isUploading ? 'Uploading…' : 'Drag and drop files here, or click to browse'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {assetProvider?.upload
                      ? 'Files are uploaded via the host asset provider.'
                      : 'Files are kept in-memory for this session.'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={accept.join(',')}
                  onChange={(e) => {
                    if (e.target.files?.length) void processFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </div>
              {isUploading && (
                <div className="flex items-center justify-center gap-3 text-sm text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </div>
              )}
              {uploadError && (
                <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300" role="alert">
                  {uploadError}
                </div>
              )}
              {uploaded.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {uploaded.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handlePick(item)}
                      title={item.name}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 bg-slate-950/60 transition"
                    >
                      <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <span className="block text-[10px] text-slate-200 truncate">{item.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
