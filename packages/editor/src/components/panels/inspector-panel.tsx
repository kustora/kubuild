import React, { useEffect, useState, useRef } from 'react';
import { ComponentRegistry, ComponentFieldDefinition, isBindableField } from '@kubuild/components';
import { findNodeById, findNodeLocation } from '@kubuild/core';
import { isVariableBinding, PageDocument, AnimationConfig } from '@kubuild/schema';
import { useEditorStore, Viewport } from '../../store';
import { VariableBindingControl, toBindingValue } from '../ui/variable-picker';
import { AssetManagerModal } from '../modals/asset-manager-modal';
import { ActionBuilderModal } from '../action-builder/action-builder-modal';
import { TableSpreadsheetEditor } from '../table-editor/table-spreadsheet-editor';
import { BoxModelEditor } from '../style-manager/box-model-editor';
import { StyleManagerAccordion } from '../style-manager/style-manager-accordion';
import { TraitsPanel } from './traits-panel';
import { ActionPropControl } from './action-prop-control';
import { ComponentIcon } from '../ui/icons';
import { replayNodeAnimation } from '@kubuild/renderer';
import { AlertTriangle, Palette, Settings, Crosshair, Trash2, X, Zap } from 'lucide-react';

import { StyleSectorId } from '../style-manager/style-manager-accordion';
import { EditorInspectorConfig } from '../../config';

export interface InspectorPanelProps {
  registry: ComponentRegistry;
  className?: string;
  document?: PageDocument;
  selectedNodeId?: string | null;
  config?: EditorInspectorConfig;
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

interface MediaSrcPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  onOpenAssetPicker: () => void;
}

const MediaSrcPropControl: React.FC<MediaSrcPropControlProps> = ({
  nodeId,
  field,
  value,
  onCommit,
  onOpenAssetPicker,
}) => {
  const valueStr = typeof value === 'string' ? value : '';
  const [text, setText] = useState(valueStr);
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setText(dataUrl);
      onCommit(field, dataUrl, true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClear = () => {
    setText('');
    onCommit(field, '', true);
  };

  const isLocalFilePath = text.trim().startsWith('file:') || /^[a-zA-Z]:\\/.test(text.trim());
  const isDataUrl = text.startsWith('data:image/');
  const hasPreview = text.trim().length > 0 && (isDataUrl || text.startsWith('http://') || text.startsWith('https://') || text.startsWith('blob:'));

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif, image/avif"
        className="hidden"
      />
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="https://... or upload local image"
          className="flex-1 min-w-0 text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono text-[11px]"
        />
        <button
          type="button"
          title="Upload local image from device"
          aria-label="Upload local image from device"
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-[11px]">Upload</span>
        </button>
        <button
          type="button"
          title="Browse Asset Gallery"
          aria-label="Browse Asset Gallery"
          onClick={onOpenAssetPicker}
          className="shrink-0 p-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/50 transition cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {hasPreview && (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-1.5">
          <img
            src={text}
            alt="Preview"
            className="w-8 h-8 object-cover rounded border border-slate-300 bg-white"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="text-[11px] font-medium text-slate-700 truncate">
              {isDataUrl ? 'Local Image (Embedded)' : text}
            </span>
            <span className="text-[10px] text-slate-400">
              {isDataUrl ? 'Base64 image data' : 'URL / Asset'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            title="Clear image"
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer text-xs"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {isLocalFilePath && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 leading-tight">
          Browsers cannot open direct local paths (<code className="font-mono">file://</code>). Click <strong>Upload</strong> above to select and load the local image directly.
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
export const StateEditingBadge: React.FC<{ state: string }> = ({ state }) => (
  <div
    data-testid="state-editing-badge"
    className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-800 text-xs font-medium"
  >
    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
    <span>Editing {state} State</span>
  </div>
);

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  registry,
  className,
  document: propDocument,
  selectedNodeId: propSelectedNodeId,
  config,
}) => {
  const storeState = useEditorStore((s) => s);
  const document = propDocument ?? storeState.document;
  const selectedNodeId =
    propSelectedNodeId !== undefined ? propSelectedNodeId : storeState.selectedNodeId;
  const {
    viewport,
    updateNodeProps,
    updateNodeStyle,
    updateNodeStateStyle,
    updateNodeAnimation,
    updateNodeFormConfig,
    variableCatalog,
    insertComponent,
    deleteComponent,
    selectNode,
    tableSpreadsheetMode,
    setTableSpreadsheetMode,
  } = storeState;

  const showProps = config?.showProps !== false;
  const showTraits = config?.showTraits !== false;
  const showStyles = config?.showStyles !== false;
  const showStateSelector = config?.showStateSelector !== false;
  const allowedStyleSectors = config?.allowedStyleSectors;

  const initialTab = !showStyles && showTraits ? 'traits' : 'style';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [activeTab, setActiveTab] = useState<'style' | 'traits'>(initialTab);
  // STORA-250 — asset manager modal state (open + which prop field it targets).
  const [assetPickerField, setAssetPickerField] = useState<string | null>(null);
  // STORA-340 — Visual Action Builder modal state
  const [isActionBuilderOpen, setIsActionBuilderOpen] = useState<boolean>(false);
  // Active pseudo-state layer for the style manager — STORA-221.
  const [activeState, setActiveState] = useState<string>('default');

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
            {(field.options ?? []).map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
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
      {/* Tab bar: Style / Traits — STORA-211 */}
      {showStyles && showTraits && (
        <div className="flex shrink-0 border-b border-slate-200 bg-slate-50">
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
            <span>Style</span>
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
            <span>Traits</span>
          </button>
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
          {showProps && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {definition.label} Props
              </div>
              <div className="flex flex-col gap-3">
                {(definition.propFields ?? []).map((field) => {
                  const currentValue = node.props?.[field.name];
                  const bound = isVariableBinding(currentValue);
                  return (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
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
                    State
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
                    <option value="default">Default</option>
                    <option value=":hover">:hover</option>
                    <option value=":active">:active</option>
                    <option value=":focus">:focus</option>
                  </select>
                </div>
              )}
              <StyleManagerAccordion
                key={`${node.id}-${activeBreakpoint}-${activeState}`}
                styles={activeLayer}
                animation={node.animation}
                allowedSectors={allowedStyleSectors}
                onCommitStyle={handleCommitSpacing}
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
        />
      )}
      </div>
    </div>
  );
};
