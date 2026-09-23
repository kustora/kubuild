import React, { useEffect, useState, useRef } from 'react';
import { ComponentRegistry, ComponentFieldDefinition, isBindableField } from '@kubuild/components';
import { findNodeById, findNodeLocation } from '@kubuild/core';
import { isVariableBinding, PageDocument, AnimationConfig, ActionPipeline } from '@kubuild/schema';
import type { PixelCredentialOption } from '@kubuild/schema';
import { useEditorStore, Viewport } from '../../store';
import { VariableBindingControl, toBindingValue } from '../ui/variable-picker';
import { AssetManagerModal } from '../modals/asset-manager-modal';
import { ActionBuilderModal } from '../action-builder/action-builder-modal';
import { TrackingSettingsModal } from '../modals/tracking-settings-modal';
import { TableSpreadsheetEditor } from '../table-editor/table-spreadsheet-editor';
import { BoxModelEditor } from '../style-manager/box-model-editor';
import { StyleManagerAccordion } from '../style-manager/style-manager-accordion';
import { TraitsPanel } from './traits-panel';
import { ActionPropControl } from './action-prop-control';
import { ComponentIcon } from '../ui/icons';
import { replayNodeAnimation } from '@kubuild/renderer';
import { AlertTriangle, Palette, Settings, Crosshair, Trash2, X, Zap, Sparkles, Radio, Upload, Image as ImageIcon, Link2 } from 'lucide-react';

import { StyleSectorId } from '../style-manager/style-manager-accordion';
import { EditorInspectorConfig, ResolvedAiEditorConfig } from '../../config';
import { useTranslation } from '../../i18n';
import { LanguageSwitcher } from '../ui/language-switcher';
import type { AssetProvider } from '@kubuild/core';


export interface InspectorPanelProps {
  registry: ComponentRegistry;
  className?: string;
  document?: PageDocument;
  selectedNodeId?: string | null;
  config?: EditorInspectorConfig;
  /**
   * Fully-resolved AI config (STORA-511). Gates the "Ask AI about this component" action
   * — omitted (or `features.enhance` false) means the action does not render at all,
   * matching every other AI feature's opt-in-only behavior.
   */
  aiConfig?: ResolvedAiEditorConfig;
  /** Saved pixel credentials for the account/workspace (fetched by the host app). */
  trackingCredentials?: PixelCredentialOption[];
  /** Opens the host app's credential management page (e.g. /dashboard/marketing). */
  onManageCredentials?: () => void;
  /** Host asset provider for direct uploads and asset management */
  assetProvider?: AssetProvider;
}

const SPACING_FIELDS: Array<{ name: string; label: string }> = [
  { name: 'marginTop', label: 'Margin Top' },
  { name: 'marginRight', label: 'Margin Right' },
  { name: 'marginBottom', label: 'Margin Bottom' },
  { name: 'marginLeft', label: 'Margin Left' },
  { name: 'paddingTop', label: 'Padding Top' },
  { name: 'paddingRight', label: 'Padding Right' },
  { name: 'paddingBottom', label: 'Padding Bottom' },
  { name: 'paddingLeft', label: 'Padding Left' },
];

const SPACING_UNITS = ['px', 'rem', '%', 'em', 'vh', 'vw', 'auto'] as const;
type SpacingUnit = (typeof SPACING_UNITS)[number];

function parseSpacingValue(val: unknown): { num: string; unit: SpacingUnit } {
  if (typeof val === 'number') {
    return { num: String(val), unit: 'px' };
  }
  if (typeof val !== 'string' || val.trim() === '') {
    return { num: '', unit: 'px' };
  }
  const str = val.trim();
  if (str.toLowerCase() === 'auto') {
    return { num: 'auto', unit: 'auto' };
  }
  const match = str.match(/^(-?\d*\.?\d+)\s*(px|rem|%|em|vh|vw)?$/i);
  if (match) {
    const unitMatch = (match[2]?.toLowerCase() || 'px') as SpacingUnit;
    return {
      num: match[1],
      unit: (SPACING_UNITS as readonly string[]).includes(unitMatch) ? unitMatch : 'px',
    };
  }
  return { num: str, unit: 'px' };
}

// Desktop edits target the 'base' style layer (every ComponentDefinition ships its
// baseline appearance under 'base'; nothing populates a distinct 'desktop' key today).
function styleBreakpointFor(viewport: Viewport): 'base' | 'tablet' | 'mobile' {
  return viewport === 'desktop' ? 'base' : viewport;
}

function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mt-1">
      {message}
    </div>
  );
}

interface StringPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const StringPropControl: React.FC<StringPropControlProps> = ({
  nodeId,
  field,
  value,
  onCommit,
  onKeyDown,
}) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'string' ? value : '');
    }
  }, [value, nodeId, field.name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setText(nextVal);
    onCommit(field, nextVal, false);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    onCommit(field, text, true);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    onCommit(field, text, false);
  };

  return (
    <input
      type="text"
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
};

function getAssetDisplayName(urlOrData: string): string {
  if (!urlOrData) return '';
  if (urlOrData.startsWith('data:image/')) return 'Local Image (Embedded)';
  if (urlOrData.startsWith('blob:')) return 'Local File (Blob)';
  try {
    const parsed = new URL(urlOrData);
    const pathname = parsed.pathname;
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      const decoded = decodeURIComponent(last);
      const cleanName = decoded.replace(/^(\d{10,14}|[a-f0-9-]{36})[-_]/, '');
      return cleanName || decoded;
    }
  } catch {
    const segments = urlOrData.split('/').filter(Boolean);
    return segments[segments.length - 1] || urlOrData;
  }
  return 'Image Asset';
}

interface MediaSrcPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  onOpenAssetPicker: () => void;
  assetProvider?: AssetProvider;
}

const MediaSrcPropControl: React.FC<MediaSrcPropControlProps> = ({
  nodeId,
  field,
  value,
  onCommit,
  onOpenAssetPicker,
  assetProvider,
}) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'string' ? value : '');
    }
  }, [value, nodeId, field.name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setText(nextVal);
    onCommit(field, nextVal, false);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    onCommit(field, text, true);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    onCommit(field, text, false);
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
        setText(info.url);
        onCommit(field, info.url, true);
        setShowUrlInput(false);
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
        setText(dataUrl);
        onCommit(field, dataUrl, true);
        setShowUrlInput(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = () => {
    setText('');
    onCommit(field, '', true);
    setShowUrlInput(false);
  };

  const isDataUrl = text.startsWith('data:image/');
  const hasPreview = text.trim().length > 0 && (isDataUrl || text.startsWith('http://') || text.startsWith('https://') || text.startsWith('blob:'));
  const isLocalFilePath = text.trim().startsWith('file:') || /^[a-zA-Z]:\\/.test(text.trim());
  const displayName = getAssetDisplayName(text);

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif, image/avif"
        className="hidden"
        disabled={isUploading}
      />

      {hasPreview ? (
        <div className="flex flex-col gap-1.5">
          {/* Preview Card without showing ugly raw URL */}
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-2">
            <div className="w-10 h-10 rounded border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center">
              <img
                src={text}
                alt="Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-semibold text-slate-800 truncate" title={displayName}>
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400">
                {isDataUrl ? 'Local Image' : 'Image Asset'}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                title={isUploading ? 'Uploading image...' : 'Ganti gambar dari perangkat'}
                aria-label="Ganti gambar"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-700 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 font-medium cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span className="text-[11px]">{isUploading ? 'Uploading...' : 'Ganti'}</span>
              </button>
              <button
                type="button"
                title="Browse Asset Gallery"
                aria-label="Browse Asset Gallery"
                disabled={isUploading}
                onClick={onOpenAssetPicker}
                className="p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer shadow-2xs disabled:opacity-50"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClear}
                title="Hapus gambar"
                aria-label="Hapus gambar"
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 bg-white transition cursor-pointer shadow-2xs"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Optional toggle for manual URL if needed */}
          {showUrlInput ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="text"
                value={text}
                disabled={isUploading}
                onFocus={handleFocus}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="https://..."
                className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
                title="Sembunyikan URL"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-[10px] text-slate-400 hover:text-slate-600 self-start flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Link2 className="w-3 h-3" />
              <span>Gunakan URL manual</span>
            </button>
          )}
        </div>
      ) : (
        /* When NO image is selected yet */
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title={isUploading ? 'Uploading image...' : 'Upload image from device'}
              aria-label="Upload local image from device"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/30 hover:border-blue-400 text-slate-600 hover:text-blue-600 transition flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              {isUploading ? (
                <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploading ? 'Mengunggah...' : 'Unggah Gambar'}</span>
            </button>
            <button
              type="button"
              title="Browse Asset Gallery"
              aria-label="Browse Asset Gallery"
              disabled={isUploading}
              onClick={onOpenAssetPicker}
              className="py-2 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 text-xs font-medium cursor-pointer shadow-2xs"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="text-[11px]">Galeri</span>
            </button>
          </div>

          {showUrlInput ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                type="text"
                value={text}
                disabled={isUploading}
                onFocus={handleFocus}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="https://..."
                className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => setShowUrlInput(false)}
                className="p-1 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              className="text-[10px] text-slate-400 hover:text-slate-600 self-start flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Link2 className="w-3 h-3" />
              <span>Gunakan URL manual</span>
            </button>
          )}
        </div>
      )}

      {uploadError && (
        <span className="text-[10px] text-red-500 font-medium">{uploadError}</span>
      )}

      {isLocalFilePath && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 leading-tight">
          Browsers cannot open direct local paths (<code className="font-mono">file://</code>). Click <strong>Ganti</strong> above to select and load the local image directly.
        </div>
      )}
    </div>
  );
};


interface TextAreaPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const TextAreaPropControl: React.FC<TextAreaPropControlProps> = ({
  nodeId,
  field,
  value,
  onCommit,
  onKeyDown,
}) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'string' ? value : '');
    }
  }, [value, nodeId, field.name]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setText(nextVal);
    onCommit(field, nextVal, false);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    onCommit(field, text, true);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    onCommit(field, text, false);
  };

  return (
    <textarea
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      rows={3}
      placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
      className="w-full text-xs font-mono bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
};

interface NumberPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  setError: (error: string | null) => void;
}

const NumberPropControl: React.FC<NumberPropControlProps> = ({
  nodeId,
  field,
  value,
  onCommit,
  setError,
}) => {
  const valueStr = typeof value === 'number' ? String(value) : '';
  const [text, setText] = useState(valueStr);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(typeof value === 'number' ? String(value) : '');
    }
  }, [value, nodeId, field.name]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    if (val === '' || val === '-') {
      setError(null);
      return;
    }
    const parsed = Number(val);
    if (Number.isNaN(parsed)) {
      setError('Must be a number.');
      return;
    }
    setError(null);
    onCommit(field, parsed, false);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (text === '') {
      onCommit(field, undefined, true);
      return;
    }
    const parsed = Number(text);
    if (Number.isNaN(parsed)) {
      setError('Must be a number.');
      return;
    }
    onCommit(field, parsed, true);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    setError(null);
  };

  return (
    <input
      type="number"
      value={text}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={field.defaultValue !== undefined ? String(field.defaultValue) : ''}
      className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
};

interface SpacingControlProps {
  nodeId: string;
  breakpoint: 'base' | 'tablet' | 'mobile';
  fieldName: string;
  fieldLabel: string;
  value: unknown;
  onCommit: (fieldName: string, value: string) => void;
  error?: string | null;
}

const SpacingControl: React.FC<SpacingControlProps> = ({
  nodeId,
  breakpoint,
  fieldName,
  fieldLabel,
  value,
  onCommit,
  error,
}) => {
  const parsed = parseSpacingValue(value);
  const [num, setNum] = useState(parsed.num);
  const [unit, setUnit] = useState<SpacingUnit>(parsed.unit);

  useEffect(() => {
    const next = parseSpacingValue(value);
    setNum(next.num);
    setUnit(next.unit);
  }, [value, nodeId, breakpoint]);

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawNum = e.target.value;
    setNum(rawNum);
    if (rawNum.trim() === '') {
      onCommit(fieldName, '');
      return;
    }
    if (unit === 'auto') {
      onCommit(fieldName, 'auto');
      return;
    }
    onCommit(fieldName, `${rawNum.trim()}${unit}`);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextUnit = e.target.value as SpacingUnit;
    setUnit(nextUnit);
    if (nextUnit === 'auto') {
      setNum('auto');
      onCommit(fieldName, 'auto');
      return;
    }
    if (num === 'auto') {
      setNum('');
      onCommit(fieldName, '');
      return;
    }
    if (num.trim() !== '') {
      onCommit(fieldName, `${num.trim()}${nextUnit}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const isMargin = fieldName.startsWith('margin');

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{fieldLabel}</label>
      <div className="flex items-center rounded border border-slate-300 bg-white focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 overflow-hidden shadow-xs">
        <input
          type={unit === 'auto' ? 'text' : 'number'}
          value={num}
          placeholder="0"
          disabled={unit === 'auto'}
          onChange={handleNumChange}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 text-xs bg-white text-slate-900 px-2 py-1.5 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
        />
        <select
          value={unit}
          onChange={handleUnitChange}
          aria-label={`${fieldLabel} Unit`}
          className="shrink-0 text-xs bg-slate-100 text-slate-700 font-medium px-1.5 py-1.5 border-l border-slate-200 focus:outline-none cursor-pointer hover:bg-slate-200 transition"
        >
          <option value="px">px</option>
          <option value="rem">rem</option>
          <option value="%">%</option>
          <option value="em">em</option>
          <option value="vh">vh</option>
          <option value="vw">vw</option>
          {isMargin && <option value="auto">auto</option>}
        </select>
      </div>
      <ErrorText message={error} />
    </div>
  );
};

/**
 * Amber warning badge shown above the style manager while editing a
 * non-default pseudo-state layer (e.g. `:hover`) — STORA-223.
 */
export const StateEditingBadge: React.FC<{ state: string }> = ({ state }) => {
  const { t } = useTranslation();
  const friendly =
    state === ':hover'
      ? t.hover
      : state === ':active'
      ? t.pressed
      : state === ':focus'
      ? t.focused
      : state;

  return (
    <div
      data-testid="state-editing-badge"
      className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium"
    >
      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
      <span>{t.editingStateBadge(friendly, state)}</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NodePixelEventSection — inline pixel event config per element
// Reads/writes a specially-labelled ActionPipeline (label = '_kubuild_pixel')
// so the existing handleClick → executeNodeActions in renderer fires it.
// ─────────────────────────────────────────────────────────────────────────────

const PIXEL_PIPELINE_LABEL = '_kubuild_pixel';

const META_STANDARD_EVENTS_LIST = [
  'PageView','Purchase','Lead','AddToCart','InitiateCheckout',
  'ViewContent','Search','AddPaymentInfo','CompleteRegistration',
  'Contact','Donate','FindLocation','Schedule','Subscribe',
];

interface NodePixelEventSectionProps {
  nodeId: string;
  actions?: ActionPipeline[];
  onUpdateActions: (actions: ActionPipeline[]) => void;
}

const NodePixelEventSection: React.FC<NodePixelEventSectionProps> = ({ nodeId, actions = [], onUpdateActions }) => {
  const existing = actions.find((p) => p.label === PIXEL_PIPELINE_LABEL);
  const existingPayload = existing?.steps?.[0]?.type === 'track_event'
    ? (existing.steps[0].payload as { eventName?: string; eventType?: string; provider?: string })
    : undefined;

  const [eventName, setEventName] = useState(existingPayload?.eventName ?? '');
  const [eventType, setEventType] = useState<'standard' | 'custom'>(
    existingPayload?.eventType === 'custom' ? 'custom' : 'standard',
  );
  const [provider, setProvider] = useState(existingPayload?.provider ?? 'all');
  const [isExpanded, setIsExpanded] = useState(!!existing);

  useEffect(() => {
    const p = actions.find((a) => a.label === PIXEL_PIPELINE_LABEL);
    const pay = p?.steps?.[0]?.type === 'track_event'
      ? (p.steps[0].payload as { eventName?: string; eventType?: string; provider?: string })
      : undefined;
    setEventName(pay?.eventName ?? '');
    setEventType(pay?.eventType === 'custom' ? 'custom' : 'standard');
    setProvider(pay?.provider ?? 'all');
    setIsExpanded(!!p);
  }, [nodeId]);

  const handleSave = () => {
    if (!eventName.trim()) return;
    const pixelPipeline: ActionPipeline = {
      id: existing?.id ?? `pixel-${nodeId}`,
      label: PIXEL_PIPELINE_LABEL,
      trigger: 'click',
      enabled: true,
      steps: [{
        id: `pixel-step-${nodeId}`,
        type: 'track_event',
        payload: { eventName: eventName.trim(), eventType, provider, delivery: 'client_only', enabled: true, params: {}, userData: {} },
      }],
    };
    onUpdateActions([...actions.filter((p) => p.label !== PIXEL_PIPELINE_LABEL), pixelPipeline]);
  };

  const handleRemove = () => {
    onUpdateActions(actions.filter((p) => p.label !== PIXEL_PIPELINE_LABEL));
    setEventName(''); setEventType('standard'); setProvider('all'); setIsExpanded(false);
  };

  const isConfigured = !!existing && !!existingPayload?.eventName;

  return (
    <div className="pb-3 border-b border-slate-200">
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs transition-colors">
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-50/70 hover:bg-slate-100/70 transition cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-500 shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold text-slate-700 truncate">Event Pixel</span>
            {isConfigured && (
              <span
                title={`Event: ${existingPayload!.eventName}`}
                className="px-1.5 py-0.2 text-[9px] font-bold bg-purple-100 text-purple-700 rounded-full border border-purple-200 leading-none truncate max-w-[120px]"
              >
                {existingPayload!.eventName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {isConfigured && (
              <button
                type="button"
                title="Hapus Event Pixel"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
              >
                <ComponentIcon iconOrType="reset" size={11} />
              </button>
            )}
            <span
              className={`text-slate-400 transform transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : 'rotate-0'
              }`}
            >
              <ComponentIcon iconOrType="chevron-down" size={13} />
            </span>
          </div>
        </button>

        {isExpanded && (
          <div className="p-3 border-t border-slate-100 bg-white flex flex-col gap-3 animate-fadeIn">
            {/* Type toggle */}
            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-medium text-slate-600">Tipe Event</label>
              <div className="flex rounded border border-slate-300 bg-slate-100 p-0.5 shadow-2xs">
                {(['standard', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setEventType(t); setEventName(''); }}
                    className={`flex-1 py-1 px-2 text-xs font-medium rounded transition flex items-center justify-center cursor-pointer ${
                      eventType === t
                        ? 'bg-white text-purple-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'standard' ? 'Standard' : 'Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Event Name */}
            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-medium text-slate-600">Nama Event</label>
              {eventType === 'standard' ? (
                <select
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-900 shadow-2xs cursor-pointer"
                >
                  <option value="">— Pilih event standard —</option>
                  {META_STANDARD_EVENTS_LIST.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Contoh: ButtonClick, WhatsAppClick"
                  className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-900 shadow-2xs"
                />
              )}
            </div>

            {/* Platform */}
            <div className="flex flex-col gap-1">
              <label className="block text-[11px] font-medium text-slate-600">Platform Target</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-slate-900 shadow-2xs cursor-pointer"
              >
                <option value="all">Semua Platform</option>
                <option value="meta">Meta (Facebook) Pixel</option>
                <option value="google">Google Analytics (GA4)</option>
                <option value="tiktok">TikTok Pixel</option>
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSave}
                disabled={!eventName.trim()}
                className="flex-1 py-1.5 px-3 text-xs font-medium bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded transition shadow-2xs cursor-pointer"
              >
                Simpan Event
              </button>
              {isConfigured && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>

            {isConfigured && (
              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2 rounded border border-slate-200">
                Event <code className="text-purple-600 font-mono font-semibold">{existingPayload!.eventName}</code> dikirim ke{' '}
                <span className="font-medium text-slate-700">{existingPayload!.provider === 'all' ? 'semua platform' : existingPayload!.provider}</span> saat elemen ini diklik.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  registry,
  className,
  document: propDocument,
  selectedNodeId: propSelectedNodeId,
  config,
  aiConfig,
  trackingCredentials,
  onManageCredentials,
  assetProvider,
}) => {
  const storeState = useEditorStore((s) => s);
  const document = propDocument ?? storeState.document;
  const selectedNodeId =
    propSelectedNodeId !== undefined ? propSelectedNodeId : storeState.selectedNodeId;
  const {
    viewport,
    updateNodeProps,
    updateNodeStyle,
    resetNodeStyleProperty,
    resetNodeViewportStyles,
    updateNodeStateStyle,
    updateNodeAnimation,
    updateNodeFormConfig,
    updateNodeActions,
    variableCatalog,
    insertComponent,
    deleteComponent,
    selectNode,
    tableSpreadsheetMode,
    setTableSpreadsheetMode,
    aiChatMode,
    toggleAiChat,
    requestAiChatFocus,
  } = storeState;

  const showProps = config?.showProps !== false;
  const showTraits = config?.showTraits !== false;
  const showStyles = config?.showStyles !== false;
  const showStateSelector = config?.showStateSelector !== false;
  const allowedStyleSectors = config?.allowedStyleSectors;

  const { t } = useTranslation();

  const initialTab = !showStyles && showTraits ? 'traits' : 'style';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [activeTab, setActiveTab] = useState<'style' | 'traits'>(initialTab);
  // STORA-250 — asset manager modal state (open + which prop field it targets).
  const [assetPickerField, setAssetPickerField] = useState<string | null>(null);
  // STORA-340 — Visual Action Builder modal state
  const [isActionBuilderOpen, setIsActionBuilderOpen] = useState<boolean>(false);
  // Pixel Tracking modal — opened from the inspector's Pixel Tracking card
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);
  // Active pseudo-state layer for the style manager — STORA-221.
  const [activeState, setActiveState] = useState<string>('default');
  // Component props accordion open state
  const [isPropsOpen, setIsPropsOpen] = useState<boolean>(true);

  useEffect(() => {
    if (!showStyles && showTraits && activeTab !== 'traits') {
      setActiveTab('traits');
    } else if (!showTraits && showStyles && activeTab !== 'style') {
      setActiveTab('style');
    }
  }, [showStyles, showTraits, activeTab]);

  const node = selectedNodeId ? findNodeById(document.document, selectedNodeId) : null;
  const definition = node ? registry.get(node.type) : undefined;

  useEffect(() => {
    setFieldErrors({});
    setIsPropsOpen(true);
  }, [node?.id]);

  if (!node || !definition) {
    return (
      <div className={`p-3 text-xs text-slate-500 ${className || ''}`}>No element selected.</div>
    );
  }

  const setError = (key: string, error: string | null) => {
    setFieldErrors((prev) => ({ ...prev, [key]: error }));
  };

  const commitProp = (field: ComponentFieldDefinition, value: unknown, isBlur = true) => {
    const errorKey = `prop:${field.name}`;
    if (!isBlur) {
      // While typing / focused: allow temporary empty state without showing red error banner
      if (typeof value === 'string' && value.trim() === '') {
        setError(errorKey, null);
        return;
      }
      const result = updateNodeProps(node.id, { [field.name]: value }, registry);
      if (result.success) {
        setError(errorKey, null);
      }
      return;
    }

    // On blur: validate and commit final value
    const result = updateNodeProps(node.id, { [field.name]: value }, registry);
    setError(errorKey, result.success ? null : result.error ?? 'Invalid value.');
  };

  const renderPropControl = (field: ComponentFieldDefinition) => {
    const currentValue = node.props?.[field.name];
    const errorKey = `prop:${field.name}`;

    switch (field.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={Boolean(currentValue)}
            onChange={(e) => commitProp(field, e.target.checked, true)}
          />
        );
      case 'select':
        return (
          <select
            value={String(currentValue ?? '')}
            onChange={(e) => {
              const option = field.options?.find((o) => String(o.value) === e.target.value);
              commitProp(field, option ? option.value : e.target.value, true);
            }}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {(field.options ?? []).map((opt) => {
              let optLabel = opt.label;
              if (definition?.type === 'heading' && field.name === 'level') {
                const lvlKey = `h${opt.value}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
                if (t[lvlKey]) {
                  optLabel = t[lvlKey];
                }
              }
              return (
                <option key={String(opt.value)} value={String(opt.value)}>
                  {optLabel}
                </option>
              );
            })}
          </select>
        );
      case 'color':
        return (
          <input
            type="color"
            value={typeof currentValue === 'string' ? currentValue : '#000000'}
            onChange={(e) => commitProp(field, e.target.value, true)}
            className="w-full h-8 cursor-pointer rounded border border-slate-300 bg-white p-1"
          />
        );
      case 'number':
        return (
          <NumberPropControl
            nodeId={node.id}
            field={field}
            value={currentValue}
            onCommit={commitProp}
            setError={(err) => setError(errorKey, err)}
          />
        );
      case 'action':
        return (
          <ActionPropControl
            nodeId={node.id}
            field={field}
            value={currentValue}
            document={document}
            onCommit={commitProp}
            onOpenActionBuilder={() => setIsActionBuilderOpen(true)}
            setError={(err) => setError(errorKey, err)}
          />
        );
      case 'image':
      case 'json':
        return (
          <textarea
            defaultValue={JSON.stringify(currentValue ?? null, null, 2)}
            onBlur={(e) => {
              let parsed: unknown;
              try {
                parsed = JSON.parse(e.target.value);
              } catch {
                setError(errorKey, 'Invalid JSON.');
              }
              commitProp(field, parsed, true);
            }}
            rows={3}
            className="w-full text-xs font-mono bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'textarea':
        return (
          <TextAreaPropControl
            nodeId={node.id}
            field={field}
            value={currentValue}
            onCommit={commitProp}
          />
        );
      case 'string':
      default: {
        const isMediaSrcField = field.name === 'src' || field.name === 'poster';
        if (isMediaSrcField) {
          return (
            <MediaSrcPropControl
              nodeId={node.id}
              field={field}
              value={currentValue}
              onCommit={commitProp}
              onOpenAssetPicker={() => setAssetPickerField(field.name)}
              assetProvider={assetProvider}
            />
          );
        }
        return (
          <StringPropControl
            nodeId={node.id}
            field={field}
            value={currentValue}
            onCommit={commitProp}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && node.type === 'list-item' && field.name === 'text') {
                e.preventDefault();
                const location = findNodeLocation(document.document, node.id);
                if (location && location.parent && location.parent.type === 'list') {
                  insertComponent('list-item', registry, location.parent.id);
                }
              }
            }}
          />
        );
      }
    }
  };

  const activeBreakpoint = styleBreakpointFor(viewport);
  const activeLayer =
    activeState === 'default'
      ? ((node.styles?.[activeBreakpoint] as Record<string, unknown> | undefined) ?? {})
      : ((node.styles?.states?.[activeState] as Record<string, unknown> | undefined) ?? {});

  const nodeLocation = findNodeLocation(document.document, node.id);
  const parentNode = nodeLocation?.parent;
  const isParentGrid = Boolean(
    parentNode &&
    (parentNode.type === 'grid' ||
     (parentNode.styles?.base as Record<string, unknown> | undefined)?.display === 'grid' ||
     (parentNode.styles?.base as Record<string, unknown> | undefined)?.display === 'inline-grid')
  );

  const handleCommitSpacing = (fieldName: string, value: string) => {
    const errorKey = `style:${fieldName}`;
    const result =
      activeState === 'default'
        ? updateNodeStyle(node.id, { [fieldName]: value }, activeBreakpoint)
        : updateNodeStateStyle(node.id, { [fieldName]: value }, activeState);
    setError(errorKey, result.success ? null : result.error ?? 'Invalid value.');
  };

  const handleResetStyles = (properties?: string[]) => {
    if (!node) return;
    const targetProps = properties && properties.length > 0 ? properties : Object.keys(activeLayer);
    const resetMap = targetProps.reduce<Record<string, string>>((acc, p) => {
      acc[p] = '';
      return acc;
    }, {});
    if (activeState === 'default') {
      updateNodeStyle(node.id, resetMap, activeBreakpoint);
    } else {
      updateNodeStateStyle(node.id, resetMap, activeState);
    }
  };

  const handleAddListItem = (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    const result = insertComponent('list-item', registry, node.id);
    if (result.success && result.nodeId) {
      setTimeout(() => {
        const el = window.document.getElementById(`list-item-input-${result.nodeId}`);
        if (el) {
          (el as HTMLInputElement).focus();
          (el as HTMLInputElement).select();
        }
      }, 50);
    }
  };

  const handleCommitTrait = (traitName: string, value: unknown) => {
    const result = updateNodeProps(node.id, { [traitName]: value }, registry);
    setError(`trait:${traitName}`, result.success ? null : result.error ?? 'Invalid value.');
  };

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden text-sm text-slate-900 ${className || ''}`}>
      {/* STORA-250 — Asset Manager Modal: picking an asset updates the target prop instantly. */}
      {assetPickerField && (
        <AssetManagerModal
          isOpen
          onClose={() => setAssetPickerField(null)}
          onSelect={(url) => {
            const result = updateNodeProps(node.id, { [assetPickerField]: url }, registry);
            setError(`prop:${assetPickerField}`, result.success ? null : result.error ?? 'Invalid value.');
          }}
          assetProvider={assetProvider}
        />
      )}
      {/* STORA-340 — Action Builder Modal */}
      {isActionBuilderOpen && (
        <ActionBuilderModal
          isOpen
          onClose={() => setIsActionBuilderOpen(false)}
          nodeId={node.id}
        />
      )}
      {/* Pixel Tracking Modal — opened from the inspector Pixel section */}
      {isTrackingModalOpen && (
        <TrackingSettingsModal
          isOpen
          onClose={() => setIsTrackingModalOpen(false)}
          credentials={trackingCredentials}
          onManageCredentials={onManageCredentials}
        />
      )}
      {/* Tab bar: Style / Traits — STORA-211 */}
      {showStyles && showTraits ? (
        <div className="flex shrink-0 border-b border-slate-200 bg-slate-50 items-center justify-between">
          <div className="flex flex-1">
            <button
              type="button"
              onClick={() => setActiveTab('style')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'style'
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.styleTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('traits')}
              className={`flex-1 px-3 py-2 text-xs font-medium transition border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === 'traits'
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.settingsTab}</span>
            </button>
          </div>
          <div className="px-2">
            <LanguageSwitcher />
          </div>
        </div>
      ) : (
        <div className="flex shrink-0 justify-end border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <LanguageSwitcher />
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-4 p-3 min-w-0">
      {/* STORA-340 — Interactivity & Action Builder Card */}
      <div className="pb-3 border-b border-slate-200">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-300 transition">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-700 leading-tight">Interactivity &amp; Actions</span>
              <span className="text-[10px] text-slate-500 truncate">
                {node.actions && node.actions.length > 0
                  ? `${node.actions.reduce((sum, p) => sum + p.steps.length, 0)} step(s) across ${node.actions.length} trigger(s)`
                  : 'No actions configured'}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="open-action-builder-btn"
            onClick={() => setIsActionBuilderOpen(true)}
            className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
          >
            <Zap className="w-3 h-3" />
            <span>Actions</span>
            {node.actions && node.actions.length > 0 && (
              <span className="ml-0.5 px-1 py-0.2 text-[9px] font-bold bg-blue-600 text-white rounded-full">
                {node.actions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Pixel Tracking section — separate from action events ───────── */}
      <div className="pb-3 border-b border-slate-200">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 hover:border-purple-300 transition">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-700 leading-tight">Pixel Tracking</span>
              <span className="text-[10px] text-slate-500 truncate">
                {document?.tracking?.enabled === false
                  ? 'Tracking dinonaktifkan'
                  : (() => {
                      const p = document?.tracking?.providers;
                      if (!p) return 'Belum ada pixel dikonfigurasi';
                      const active = [
                        p.meta?.enabled !== false && p.meta?.pixelId,
                        p.google?.enabled !== false && p.google?.measurementId,
                        p.gtm?.enabled !== false && p.gtm?.containerId,
                        p.tiktok?.enabled !== false && p.tiktok?.pixelId,
                      ].filter(Boolean).length;
                      return active > 0 ? `${active} provider aktif` : 'Belum ada pixel dikonfigurasi';
                    })()}
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="open-pixel-tracking-btn"
            onClick={() => setIsTrackingModalOpen(true)}
            className="px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
          >
            <Radio className="w-3 h-3" />
            <span>Pixel</span>
            {document?.tracking?.enabled !== false &&
              (() => {
                const p = document?.tracking?.providers;
                const active = p ? [
                  p.meta?.enabled !== false && p.meta?.pixelId,
                  p.google?.enabled !== false && p.google?.measurementId,
                  p.gtm?.enabled !== false && p.gtm?.containerId,
                  p.tiktok?.enabled !== false && p.tiktok?.pixelId,
                ].filter(Boolean).length : 0;
                return active > 0 ? (
                  <span className="ml-0.5 px-1 py-0.2 text-[9px] font-bold bg-purple-600 text-white rounded-full">
                    {active}
                  </span>
                ) : null;
              })()}
          </button>
        </div>
      </div>

      {/* ── Per-element pixel event — fires on click via executeNodeActions ── */}
      <NodePixelEventSection
        nodeId={node.id}
        actions={node.actions}
        onUpdateActions={(actions) => updateNodeActions(node.id, actions)}
      />

      {/* STORA-511 — "Ask AI about this component": opens the AI Chat Panel (if hidden)
          with this node already attached as context, and focuses its input. Only ever
          rendered when a node is selected (guaranteed here) and `features.enhance` is on. */}
      {aiConfig?.enabled && aiConfig.features.enhance && (
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50/60 border border-blue-200 hover:border-blue-300 transition">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-slate-700 leading-tight">Ask AI</span>
                <span className="text-[10px] text-slate-500 truncate">
                  Discuss or enhance this component with AI
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="ask-ai-about-component-btn"
              onClick={() => {
                if (aiChatMode === 'hidden') toggleAiChat();
                requestAiChatFocus();
              }}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-white hover:bg-blue-100 border border-blue-200 rounded-md transition flex items-center gap-1 cursor-pointer shrink-0 shadow-2xs"
            >
              <Sparkles className="w-3 h-3" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      )}

      {node.type === 'list' && (
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              List Items ({node.children?.length ?? 0})
            </div>
            <button
              type="button"
              onClick={handleAddListItem}
              className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
            >
              + Add Item
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {(!node.children || node.children.length === 0) && (
              <div className="text-xs text-slate-400 italic">No items yet. Click "+ Add Item" or press Enter.</div>
            )}
            {node.children?.map((child, idx) => (
              <div
                key={child.id}
                className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded border border-slate-200"
              >
                <span className="text-[11px] font-mono text-slate-400 w-4 text-center">{idx + 1}.</span>
                <input
                  id={`list-item-input-${child.id}`}
                  type="text"
                  value={typeof child.props?.text === 'string' ? child.props.text : ''}
                  onChange={(e) => updateNodeProps(child.id, { text: e.target.value }, registry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddListItem(e);
                    }
                  }}
                  placeholder={`Item ${idx + 1}`}
                  className="flex-1 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  title="Select Item"
                  onClick={() => selectNode(child.id)}
                  className="p-1 text-slate-400 hover:text-blue-600 rounded flex items-center justify-center"
                >
                  <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="Delete Item"
                  onClick={() => deleteComponent(child.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.type === 'table' && (
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Spreadsheet Grid
            </div>
            <div className="flex items-center gap-1">
              {tableSpreadsheetMode === 'docked' ? (
                <button
                  type="button"
                  onClick={() => setTableSpreadsheetMode('floating')}
                  className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
                  title="Pop out to floating window"
                >
                  Pop out (Float)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTableSpreadsheetMode('docked')}
                  className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
                  title="Dock grid into inspector"
                >
                  Dock Grid Here
                </button>
              )}
            </div>
          </div>

          {tableSpreadsheetMode === 'docked' ? (
            <div className="mb-2">
              <TableSpreadsheetEditor
                registry={registry}
                tableNode={node}
                mode="docked"
                onToggleMode={() => setTableSpreadsheetMode('floating')}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 mb-2">
              <div className="flex items-center justify-between p-2 bg-blue-50/70 border border-blue-200 rounded text-xs text-blue-800">
                <span className="font-medium flex items-center gap-1.5">
                  <ComponentIcon iconOrType="table" size={13} />
                  <span>
                    {tableSpreadsheetMode === 'floating'
                      ? 'Grid is Floating on Canvas'
                      : 'Grid is Hidden'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTableSpreadsheetMode(
                      tableSpreadsheetMode === 'floating' ? 'docked' : 'floating',
                    )
                  }
                  className="px-2 py-0.5 text-xs font-medium bg-white text-blue-700 hover:bg-blue-100 rounded border border-blue-300 transition"
                >
                  {tableSpreadsheetMode === 'floating' ? 'Dock Here' : 'Open Float Grid'}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2 mt-3">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Table Rows ({node.children?.length ?? 0})
            </div>
            <button
              type="button"
              onClick={() => {
                const cellCount = node.children?.[0]?.children?.length || 2;
                const result = insertComponent('table-row', registry, node.id);
                if (result.success && result.nodeId) {
                  for (let i = 0; i < cellCount; i++) {
                    insertComponent('table-cell', registry, result.nodeId);
                  }
                }
              }}
              className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
            >
              + Add Row
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {(!node.children || node.children.length === 0) && (
              <div className="text-xs text-slate-400 italic">No rows yet. Click "+ Add Row" to add one.</div>
            )}
            {node.children?.map((row, idx) => (
              <div
                key={row.id}
                className="flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded border border-slate-200 text-xs"
              >
                <span className="font-medium text-slate-700">
                  Row {idx + 1} ({row.children?.length ?? 0} cells)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => insertComponent('table-cell', registry, row.id)}
                    className="px-1.5 py-0.5 text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                    title="Add Cell to Row"
                  >
                    + Cell
                  </button>
                  <button
                    type="button"
                    title="Select Row"
                    onClick={() => selectNode(row.id)}
                    className="p-1 text-slate-400 hover:text-blue-600 rounded flex items-center justify-center"
                  >
                    <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Delete Row"
                    onClick={() => deleteComponent(row.id)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded flex items-center justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {node.type === 'table-row' && (
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Row Cells ({node.children?.length ?? 0})
            </div>
            <button
              type="button"
              onClick={() => insertComponent('table-cell', registry, node.id)}
              className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition"
            >
              + Add Cell
            </button>
          </div>
        </div>
      )}

      {activeTab === 'style' && (
        <>
          {showProps && definition.propFields && definition.propFields.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs transition-colors mb-3">
              <button
                type="button"
                onClick={() => setIsPropsOpen((v) => !v)}
                aria-expanded={isPropsOpen}
                className="w-full flex items-center justify-between px-3 py-2 text-left bg-slate-50/70 hover:bg-slate-100/70 transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-500 shrink-0">
                    <ComponentIcon iconOrType={definition.icon || 'settings'} size={14} />
                  </span>
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {definition.type === 'heading'
                      ? t.textSettings
                      : t.componentSettings(definition.label)}
                  </span>
                </div>
                <span
                  className={`text-slate-400 transform transition-transform duration-200 ${
                    isPropsOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                >
                  <ComponentIcon iconOrType="chevron-down" size={13} />
                </span>
              </button>

              {isPropsOpen && (
                <div className="p-3 border-t border-slate-100 bg-white flex flex-col gap-3 animate-fadeIn">
                  {definition.propFields.map((field) => {
                    const currentValue = node.props?.[field.name];
                    const bound = isVariableBinding(currentValue);
                    const fieldLabel =
                      definition.type === 'heading' && field.name === 'level'
                        ? t.titleSize
                        : field.label;
                    return (
                      <div key={field.name}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{fieldLabel}</label>
                        {!bound && renderPropControl(field)}
                        {isBindableField(field) && (
                          <VariableBindingControl
                            field={field}
                            currentValue={currentValue}
                            catalog={variableCatalog}
                            onBind={(key) => commitProp(field, toBindingValue(key), true)}
                            onRevert={() => commitProp(field, field.defaultValue ?? '', true)}
                          />
                        )}
                        <ErrorText message={fieldErrors[`prop:${field.name}`]} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showStyles && (
            <div className="pt-2 border-t border-slate-200 min-w-0 max-w-full">
              {/* Active state warning badge — STORA-223 */}
              {activeState !== 'default' && <StateEditingBadge state={activeState} />}
              {/* Pseudo-state selector — STORA-221 */}
              {showStateSelector && (
                <div className="flex items-center gap-2 mb-2">
                  <label
                    htmlFor="style-state-selector"
                    className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0"
                  >
                    {t.stateLabel}
                  </label>
                  <select
                    id="style-state-selector"
                    value={activeState}
                    onChange={(e) => setActiveState(e.target.value)}
                    className={`flex-1 text-xs rounded px-2 py-1.5 border focus:outline-none focus:ring-1 transition cursor-pointer ${
                      activeState !== 'default'
                        ? 'bg-amber-50 text-amber-900 border-amber-400 focus:ring-amber-400 focus:border-amber-400'
                        : 'bg-white text-slate-900 border-slate-300 hover:border-slate-400 focus:ring-blue-500 focus:border-blue-500 shadow-xs'
                    }`}
                  >
                    <option value="default">{t.normal}</option>
                    <option value=":hover">{t.hover}</option>
                    <option value=":active">{t.pressed}</option>
                    <option value=":focus">{t.focused}</option>
                  </select>
                </div>
              )}
              <StyleManagerAccordion
                key={`${node.id}-${activeBreakpoint}-${activeState}`}
                styles={activeLayer}
                baseStyles={(node.styles?.base as Record<string, unknown> | undefined) ?? {}}
                animation={node.animation}
                allowedSectors={allowedStyleSectors}
                nodeType={node.type}
                isParentGrid={isParentGrid}
                onCommitStyle={handleCommitSpacing}
                onResetProperty={(prop) => {
                  if (activeBreakpoint !== 'base') {
                    resetNodeStyleProperty(node.id, prop, activeBreakpoint);
                  }
                }}
                onResetAllOverrides={() => {
                  if (activeBreakpoint !== 'base') {
                    resetNodeViewportStyles(node.id, activeBreakpoint);
                  }
                }}
                onCommitAnimation={(anim) => {
                  const result = updateNodeAnimation(node.id, anim);
                  if (!result.success && result.error) {
                    setError('animation', result.error);
                  }
                }}
                onResetAnimation={() => {
                  updateNodeAnimation(node.id, null);
                }}
                onReplayAnimation={() => {
                  if (node?.id) {
                    replayNodeAnimation(node.id);
                  }
                }}
                errors={fieldErrors}
                breakpoint={activeBreakpoint}
                assetProvider={assetProvider}
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'traits' && showTraits && (
        <TraitsPanel
          registry={registry}
          document={document}
          selectedNodeId={node.id}
          onCommitTrait={handleCommitTrait}
          onUpdateFormConfig={(cfg) => {
            const result = updateNodeFormConfig(node.id, cfg);
            if (!result.success && result.error) {
              setError('formConfig', result.error);
            }
          }}
          className="p-0"
          assetProvider={assetProvider}
        />
      )}
      </div>
    </div>
  );
};
