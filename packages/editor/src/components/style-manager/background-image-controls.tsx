import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, Upload, X, Trash2 } from 'lucide-react';
import type { AssetProvider } from '@kubuild/core';
import { AssetManagerModal } from '../modals/asset-manager-modal';

export interface BackgroundImageControlsProps {
  styles?: Record<string, unknown>;
  onChange: (property: string, value: string) => void;
  disabled?: boolean;
  className?: string;
  assetProvider?: AssetProvider;
}

/**
 * Extracts raw image URL or data URI from a CSS background-image value.
 * e.g. `url("https://example.com/bg.jpg")` -> `https://example.com/bg.jpg`
 */
export function extractImageUrl(val: unknown): string {
  if (!val || typeof val !== 'string') return '';
  const str = val.trim();
  if (str.includes('gradient(') || str === 'none') return '';
  const match = str.match(/^url\(['"]?(.*?)['"]?\)$/i);
  return match ? match[1] : str;
}

/**
 * Formats an image URL into a CSS background-image string `url("...")`.
 */
export function formatBackgroundImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'none') return '';
  if (trimmed.startsWith('url(') || trimmed.includes('gradient(')) return trimmed;
  return `url("${trimmed}")`;
}

export const BG_SIZE_OPTIONS = [
  { id: 'cover', label: 'Cover', value: 'cover' },
  { id: 'contain', label: 'Contain', value: 'contain' },
  { id: 'auto', label: 'Auto', value: 'auto' },
] as const;

export const BG_POSITION_OPTIONS = [
  { label: 'Center', value: 'center' },
  { label: 'Top', value: 'top' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
  { label: 'Top Left', value: 'top left' },
  { label: 'Top Right', value: 'top right' },
  { label: 'Bottom Left', value: 'bottom left' },
  { label: 'Bottom Right', value: 'bottom right' },
] as const;

export const BG_REPEAT_OPTIONS = [
  { id: 'no-repeat', label: 'No Repeat', value: 'no-repeat' },
  { id: 'repeat', label: 'Tile', value: 'repeat' },
  { id: 'repeat-x', label: 'Tile X', value: 'repeat-x' },
  { id: 'repeat-y', label: 'Tile Y', value: 'repeat-y' },
] as const;

export const BG_ATTACHMENT_OPTIONS = [
  { id: 'scroll', label: 'Scroll', value: 'scroll' },
  { id: 'fixed', label: 'Fixed (Parallax)', value: 'fixed' },
] as const;

export const BackgroundImageControls: React.FC<BackgroundImageControlsProps> = ({
  styles = {},
  onChange,
  disabled = false,
  className = '',
  assetProvider,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  const rawBgImage = styles.backgroundImage;
  const currentImageUrl = extractImageUrl(rawBgImage);
  const [inputText, setInputText] = useState(currentImageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setInputText(currentImageUrl);
    }
  }, [currentImageUrl]);

  const hasImage = Boolean(currentImageUrl && currentImageUrl.trim().length > 0);

  const handleCommitUrl = (url: string) => {
    const formatted = formatBackgroundImageUrl(url);
    onChange('backgroundImage', formatted);

    if (formatted) {
      // Set sensible defaults if not previously configured
      if (!styles.backgroundSize) {
        onChange('backgroundSize', 'cover');
      }
      if (!styles.backgroundPosition) {
        onChange('backgroundPosition', 'center');
      }
      if (!styles.backgroundRepeat) {
        onChange('backgroundRepeat', 'no-repeat');
      }
    }
  };

  const handleClearImage = () => {
    setInputText('');
    onChange('backgroundImage', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (assetProvider?.upload) {
      setIsUploading(true);
      setUploadError(null);
      try {
        const info = await assetProvider.upload(file);
        setInputText(info.url);
        handleCommitUrl(info.url);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(msg);
      } finally {
        setIsUploading(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setInputText(dataUrl);
        handleCommitUrl(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const currentSize = String(styles.backgroundSize ?? 'cover').trim() || 'cover';
  const currentPosition = String(styles.backgroundPosition ?? 'center').trim() || 'center';
  const currentRepeat = String(styles.backgroundRepeat ?? 'no-repeat').trim() || 'no-repeat';
  const currentAttachment = String(styles.backgroundAttachment ?? 'scroll').trim() || 'scroll';

  return (
    <div
      className={`flex flex-col gap-2.5 p-2.5 bg-slate-50/80 rounded-lg border border-slate-200 ${className}`}
      data-testid="background-image-controls"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
          <label className="text-[11px] font-medium text-slate-700">Background Image</label>
        </div>
        {hasImage && (
          <button
            type="button"
            data-testid="bg-image-clear-btn"
            title="Remove background image"
            disabled={disabled}
            onClick={handleClearImage}
            className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        data-testid="bg-image-upload-input"
        onChange={handleFileUpload}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif, image/avif"
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Input + Upload Row */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          data-testid="bg-image-url-input"
          placeholder="https://... or upload local image"
          value={inputText}
          disabled={disabled}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onChange={(e) => {
            setInputText(e.target.value);
            handleCommitUrl(e.target.value);
          }}
          onBlur={() => {
            isFocusedRef.current = false;
            handleCommitUrl(inputText);
          }}
          className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px] shadow-2xs"
        />

        <button
          type="button"
          data-testid="bg-image-upload-btn"
          title={isUploading ? 'Uploading image...' : 'Upload local image from device'}
          disabled={disabled || isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 text-xs font-medium cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          type="button"
          data-testid="bg-image-gallery-btn"
          title="Browse Asset Gallery"
          aria-label="Browse Asset Gallery"
          disabled={disabled || isUploading}
          onClick={() => setIsAssetPickerOpen(true)}
          className="shrink-0 p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageIcon className="w-3.5 h-3.5" />
        </button>

        {hasImage && (
          <button
            type="button"
            title="Clear image"
            disabled={disabled}
            onClick={handleClearImage}
            className="shrink-0 p-1.5 rounded border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {uploadError && (
        <span className="text-[10px] text-red-500 font-medium">{uploadError}</span>
      )}

      {/* Asset Manager Modal */}
      {isAssetPickerOpen && (
        <AssetManagerModal
          isOpen
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={(url) => {
            setInputText(url);
            handleCommitUrl(url);
          }}
          assetProvider={assetProvider}
        />
      )}

      {/* Preview and Controls (Shown when an image is selected) */}
      {hasImage && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/80">
          {/* Thumbnail preview */}
          <div
            data-testid="bg-image-preview"
            className="w-full h-16 rounded border border-slate-300 relative overflow-hidden bg-checkerboard shadow-inner flex items-center justify-center"
            style={{
              backgroundImage: formatBackgroundImageUrl(currentImageUrl),
              backgroundSize: currentSize,
              backgroundPosition: currentPosition,
              backgroundRepeat: currentRepeat,
            }}
          >
            <span className="absolute bottom-1 right-1.5 text-[9px] bg-slate-900/70 text-white px-1.5 py-0.5 rounded font-mono backdrop-blur-xs">
              Preview
            </span>
          </div>

          {/* Size (Fit) */}
          <div className="flex flex-col gap-1">
            <label className="block text-[10px] font-medium text-slate-500">Size (Fit)</label>
            <div className="grid grid-cols-3 gap-1">
              {BG_SIZE_OPTIONS.map((opt) => {
                const isActive = currentSize === opt.value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`bg-size-${opt.id}`}
                    disabled={disabled}
                    onClick={() => onChange('backgroundSize', opt.value)}
                    className={`py-1 text-[10px] rounded border transition cursor-pointer text-center font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Position and Repeat in 2 columns */}
          <div className="grid grid-cols-2 gap-2">
            {/* Position */}
            <div className="flex flex-col gap-1">
              <label className="block text-[10px] font-medium text-slate-500">Position</label>
              <select
                data-testid="bg-position-select"
                value={currentPosition}
                disabled={disabled}
                onChange={(e) => onChange('backgroundPosition', e.target.value)}
                className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
              >
                {BG_POSITION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Repeat */}
            <div className="flex flex-col gap-1">
              <label className="block text-[10px] font-medium text-slate-500">Repeat</label>
              <select
                data-testid="bg-repeat-select"
                value={currentRepeat}
                disabled={disabled}
                onChange={(e) => onChange('backgroundRepeat', e.target.value)}
                className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
              >
                {BG_REPEAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Attachment (Scroll / Fixed Parallax) */}
          <div className="flex flex-col gap-1">
            <label className="block text-[10px] font-medium text-slate-500">Attachment</label>
            <div className="grid grid-cols-2 gap-1">
              {BG_ATTACHMENT_OPTIONS.map((opt) => {
                const isActive = currentAttachment === opt.value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`bg-attachment-${opt.id}`}
                    disabled={disabled}
                    onClick={() => onChange('backgroundAttachment', opt.value)}
                    className={`py-1 text-[10px] rounded border transition cursor-pointer text-center font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
