import React, { useState, useEffect, useMemo } from 'react';
import {
  ActionBinding,
  PageDocument,
} from '@kubuild/schema';
import { ComponentFieldDefinition } from '@kubuild/components';
import {
  Zap,
  Navigation,
  Maximize2,
  Minimize2,
  Bell,
  Globe,
  Copy,
  Database,
  RotateCcw,
  Edit2,
  Trash2,
  Code,
  ExternalLink,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  collectDocumentModals,
  collectDocumentForms,
} from '../../utils/document-scanner';
import { VariableAutocompleteInput } from '../ui/variable-autocomplete-input';

export interface ActionPropControlProps {
  nodeId: string;
  field: ComponentFieldDefinition;
  value: unknown;
  document?: PageDocument;
  onCommit: (field: ComponentFieldDefinition, value: unknown, isBlur: boolean) => void;
  onOpenActionBuilder?: () => void;
  setError?: (error: string | null) => void;
  className?: string;
}

export interface ActionTypeMeta {
  type: string;
  label: string;
  shortLabel: string;
  description: string;
  badgeClass: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultPayload: Record<string, unknown>;
}

export const ACTION_TYPES: ActionTypeMeta[] = [
  {
    type: 'navigate',
    label: 'Navigate / Link URL',
    shortLabel: 'Navigate',
    description: 'Redirect to external URL, page route, or anchor',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Navigation,
    defaultPayload: { url: '', target: '_self' },
  },
  {
    type: 'open_modal',
    label: 'Open Modal Dialog',
    shortLabel: 'Open Modal',
    description: 'Open a dialog or popup modal by Node ID',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Maximize2,
    defaultPayload: { modalNodeId: '' },
  },
  {
    type: 'close_modal',
    label: 'Close Modal Dialog',
    shortLabel: 'Close Modal',
    description: 'Dismiss an active modal dialog',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Minimize2,
    defaultPayload: { modalNodeId: '' },
  },
  {
    type: 'show_toast',
    label: 'Show Toast Notification',
    shortLabel: 'Toast',
    description: 'Display an alert toast (Success, Error, Info, Warning)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Bell,
    defaultPayload: { message: 'Operation completed successfully!', type: 'success', duration: 3000 },
  },
  {
    type: 'api_request',
    label: 'API / Webhook Request',
    shortLabel: 'API Request',
    description: 'Trigger an HTTP REST or Webhook request',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Globe,
    defaultPayload: { url: 'https://api.example.com', method: 'GET' },
  },
  {
    type: 'copy_clipboard',
    label: 'Copy to Clipboard',
    shortLabel: 'Copy Text',
    description: 'Copy text to clipboard with optional feedback',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: Copy,
    defaultPayload: { text: '', notify: true, toastMessage: 'Copied to clipboard!' },
  },
  {
    type: 'set_state',
    label: 'Set State Variable',
    shortLabel: 'Set State',
    description: 'Store or update dynamic runtime variables',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    icon: Database,
    defaultPayload: { key: '', value: '' },
  },
  {
    type: 'reset_form',
    label: 'Reset Form Fields',
    shortLabel: 'Reset Form',
    description: 'Clear input values and validation errors',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: RotateCcw,
    defaultPayload: { formId: '' },
  },
  {
    type: 'custom_event',
    label: 'Dispatch Custom Event',
    shortLabel: 'Custom Event',
    description: 'Emit a custom DOM event for custom scripts',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Zap,
    defaultPayload: { eventName: 'custom:action', bubbles: true },
  },
];

export function getActionTypeMeta(type: string): ActionTypeMeta {
  const found = ACTION_TYPES.find((a) => a.type === type);
  if (found) return found;
  return {
    type,
    label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    shortLabel: type,
    description: 'Custom action handler',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    icon: Zap,
    defaultPayload: {},
  };
}

export function formatActionSummary(action: ActionBinding): string {
  const payload = action.payload || {};
  switch (action.type) {
    case 'navigate': {
      const url = (payload.url as string) || '';
      const target = payload.target === '_blank' ? '(New tab)' : '';
      return url ? `Go to ${url} ${target}`.trim() : 'Navigate (URL not configured)';
    }
    case 'open_modal': {
      const id = (payload.modalNodeId as string) || (payload.modalId as string) || '';
      return id ? `Open #${id}` : 'Open Modal (ID not set)';
    }
    case 'close_modal': {
      const id = (payload.modalNodeId as string) || (payload.modalId as string) || '';
      return id ? `Close #${id}` : 'Close Modal';
    }
    case 'show_toast': {
      const type = (payload.type as string) || 'info';
      const msg = (payload.message as string) || '';
      return msg ? `[${type.toUpperCase()}] "${msg}"` : 'Show Toast';
    }
    case 'api_request': {
      const method = (payload.method as string) || 'GET';
      const url = (payload.url as string) || '';
      return url ? `${method} ${url}` : 'API Request';
    }
    case 'copy_clipboard': {
      const text = (payload.text as string) || '';
      return text ? `Copy "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}"` : 'Copy to Clipboard';
    }
    case 'set_state': {
      const key = (payload.key as string) || '';
      const val = payload.value !== undefined ? String(payload.value) : '';
      return key ? `Set ${key} = ${val}` : 'Set State';
    }
    case 'reset_form': {
      const formId = (payload.formId as string) || '';
      return formId ? `Reset #${formId}` : 'Reset Form';
    }
    case 'custom_event': {
      const name = (payload.eventName as string) || '';
      return name ? `Emit "${name}"` : 'Custom Event';
    }
    default:
      return JSON.stringify(payload);
  }
}

export function parseActionBinding(val: unknown): ActionBinding | null {
  if (!val || typeof val !== 'object') return null;
  const obj = val as Record<string, unknown>;
  if (typeof obj.type === 'string' && obj.type.trim().length > 0) {
    return {
      type: obj.type.trim(),
      payload: typeof obj.payload === 'object' && obj.payload !== null ? (obj.payload as Record<string, unknown>) : {},
    };
  }
  return null;
}

export const ActionPropControl: React.FC<ActionPropControlProps> = ({
  nodeId,
  field,
  value,
  document,
  onCommit,
  onOpenActionBuilder,
  setError,
  className = '',
}) => {
  const action = useMemo(() => parseActionBinding(value), [value]);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isJsonMode, setIsJsonMode] = useState<boolean>(false);
  const [jsonInput, setJsonInput] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Available modal nodes and form nodes in document
  const availableModals = useMemo(() => collectDocumentModals(document), [document]);
  const availableForms = useMemo(() => collectDocumentForms(document), [document]);

  // Sync JSON text when switching to JSON mode or when value updates
  useEffect(() => {
    if (action) {
      setJsonInput(JSON.stringify(action, null, 2));
      setJsonError(null);
    } else {
      setJsonInput('');
      setJsonError(null);
    }
  }, [action]);

  const meta = action ? getActionTypeMeta(action.type) : null;
  const ActionIcon = meta?.icon ?? Zap;

  // Helper to update action payload immutably and commit
  const updatePayload = (partial: Record<string, unknown>) => {
    if (!action) return;
    const newPayload = { ...(action.payload || {}), ...partial };
    const updatedAction: ActionBinding = {
      type: action.type,
      payload: newPayload,
    };
    onCommit(field, updatedAction, true);
    setError?.(null);
  };

  // Helper to change action type
  const handleTypeChange = (newType: string) => {
    const targetMeta = getActionTypeMeta(newType);
    const updatedAction: ActionBinding = {
      type: newType,
      payload: { ...targetMeta.defaultPayload },
    };
    onCommit(field, updatedAction, true);
    setError?.(null);
  };

  // Clear action
  const handleClear = () => {
    onCommit(field, undefined, true);
    setIsExpanded(false);
    setIsJsonMode(false);
    setError?.(null);
  };

  // Initialize new action
  const handleInitialize = () => {
    const defaultAction: ActionBinding = {
      type: 'navigate',
      payload: { url: '', target: '_self' },
    };
    onCommit(field, defaultAction, true);
    setIsExpanded(true);
    setIsJsonMode(false);
  };

  // JSON Mode commit
  const handleJsonBlur = () => {
    if (!jsonInput.trim()) {
      handleClear();
      return;
    }
    try {
      const parsed = JSON.parse(jsonInput);
      if (typeof parsed !== 'object' || parsed === null || typeof parsed.type !== 'string' || !parsed.type) {
        setJsonError('Action JSON must include a non-empty "type" property.');
        setError?.('Invalid action JSON: missing "type".');
        return;
      }
      setJsonError(null);
      setError?.(null);
      onCommit(field, parsed, true);
    } catch {
      setJsonError('Invalid JSON format.');
      setError?.('Invalid JSON format.');
    }
  };

  // ==============================================================================================
  // 1. EMPTY STATE (No action configured)
  // ==============================================================================================
  if (!action && !isExpanded && !isJsonMode) {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <button
          type="button"
          data-testid="configure-action-btn"
          onClick={handleInitialize}
          className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-blue-400 bg-white hover:bg-blue-50/40 rounded-lg flex items-center justify-between text-xs font-medium text-slate-600 hover:text-blue-600 transition cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-slate-100 group-hover:bg-blue-100 text-slate-400 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition">
              <Zap className="w-3 h-3" />
            </div>
            <span className="truncate">Add Interactive Action</span>
          </div>
          <span className="text-[11px] text-blue-600 font-semibold px-2 py-0.5 bg-blue-50 group-hover:bg-blue-100 rounded transition shrink-0">
            + Configure
          </span>
        </button>
      </div>
    );
  }

  // ==============================================================================================
  // 2. RAW JSON MODE
  // ==============================================================================================
  if (isJsonMode) {
    return (
      <div className={`flex flex-col gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs ${className}`}>
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            <Code className="w-3.5 h-3.5 text-blue-600" />
            <span>Raw Action JSON</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsJsonMode(false)}
              className="px-2 py-0.5 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition cursor-pointer"
            >
              Visual UI
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="Remove action"
              className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => {
            setJsonInput(e.target.value);
            setJsonError(null);
          }}
          onBlur={handleJsonBlur}
          rows={4}
          className="w-full text-xs font-mono bg-white text-slate-900 border border-slate-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          placeholder='{"type": "navigate", "payload": {"url": "/docs"}}'
        />

        {jsonError && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{jsonError}</span>
          </div>
        )}
      </div>
    );
  }

  // ==============================================================================================
  // 3. EXPANDED VISUAL CONFIGURATOR
  // ==============================================================================================
  if (isExpanded && action) {
    const payload = action.payload || {};

    return (
      <div className={`flex flex-col gap-2.5 p-2.5 bg-slate-50 border border-blue-200 rounded-lg text-xs shadow-2xs ${className}`}>
        {/* Header toolbar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-1.5">
            <div className={`w-5 h-5 rounded flex items-center justify-center border ${meta?.badgeClass || 'bg-slate-100 text-slate-700'}`}>
              <ActionIcon className="w-3 h-3" />
            </div>
            <span className="font-semibold text-slate-800">Action Settings</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsJsonMode(true)}
              title="Edit raw JSON"
              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              title="Remove action"
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-2 py-0.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded transition cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Action Type Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            Action Type
          </label>
          <select
            value={action.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            {ACTION_TYPES.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] text-slate-500">{meta?.description}</span>
        </div>

        {/* Dynamic Fields per Action Type */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
          {/* NAVIGATE */}
          {action.type === 'navigate' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">Target URL / Route</label>
                <VariableAutocompleteInput
                  value={(payload.url as string) || ''}
                  onChange={(url) => updatePayload({ url })}
                  placeholder="https://example.com or /docs"
                  document={document}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={payload.target === '_blank'}
                  onChange={(e) => updatePayload({ target: e.target.checked ? '_blank' : '_self' })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 flex items-center gap-1">
                  <span>Open in new window / tab</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </span>
              </label>
            </>
          )}

          {/* OPEN MODAL / CLOSE MODAL */}
          {(action.type === 'open_modal' || action.type === 'close_modal') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-slate-700">Modal Node ID</label>
              {availableModals.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <select
                    value={(payload.modalNodeId as string) || (payload.modalId as string) || ''}
                    onChange={(e) => updatePayload({ modalNodeId: e.target.value })}
                    className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">— Select a Modal —</option>
                    {availableModals.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} ({m.id})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={(payload.modalNodeId as string) || (payload.modalId as string) || ''}
                    onChange={(e) => updatePayload({ modalNodeId: e.target.value })}
                    placeholder="Or type custom Modal ID..."
                    className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={(payload.modalNodeId as string) || (payload.modalId as string) || ''}
                  onChange={(e) => updatePayload({ modalNodeId: e.target.value })}
                  placeholder="e.g. modal-contact, modal-1"
                  className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          )}

          {/* SHOW TOAST */}
          {action.type === 'show_toast' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">Notification Message</label>
                <VariableAutocompleteInput
                  value={(payload.message as string) || ''}
                  onChange={(message) => updatePayload({ message })}
                  placeholder="e.g. Operation completed successfully!"
                  document={document}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">Variant</label>
                  <select
                    value={(payload.type as string) || 'success'}
                    onChange={(e) => updatePayload({ type: e.target.value })}
                    className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="success">Success (Green)</option>
                    <option value="info">Info (Blue)</option>
                    <option value="warning">Warning (Amber)</option>
                    <option value="error">Error (Red)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">Duration (ms)</label>
                  <input
                    type="number"
                    value={typeof payload.duration === 'number' ? payload.duration : 3000}
                    onChange={(e) => updatePayload({ duration: Number(e.target.value) || 3000 })}
                    placeholder="3000"
                    className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </>
          )}

          {/* API REQUEST */}
          {action.type === 'api_request' && (
            <>
              <div className="flex gap-1.5">
                <div className="w-24 shrink-0 flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">Method</label>
                  <select
                    value={(payload.method as string) || 'GET'}
                    onChange={(e) => updatePayload({ method: e.target.value })}
                    className="w-full text-xs font-semibold bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <label className="text-[11px] font-medium text-slate-700">Endpoint URL</label>
                  <VariableAutocompleteInput
                    value={(payload.url as string) || ''}
                    onChange={(url) => updatePayload({ url })}
                    placeholder="https://api.example.com/v1/..."
                    document={document}
                    className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </>
          )}

          {/* COPY CLIPBOARD */}
          {action.type === 'copy_clipboard' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">Text to Copy</label>
                <VariableAutocompleteInput
                  value={(payload.text as string) || ''}
                  onChange={(text) => updatePayload({ text })}
                  placeholder="Text to copy (or {{variables.code}})..."
                  document={document}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={payload.notify !== false}
                  onChange={(e) => updatePayload({ notify: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700">Show toast notification on copy</span>
              </label>
            </>
          )}

          {/* SET STATE */}
          {action.type === 'set_state' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">Variable Key</label>
                <input
                  type="text"
                  value={(payload.key as string) || ''}
                  onChange={(e) => updatePayload({ key: e.target.value })}
                  placeholder="e.g. activeTab"
                  className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-700">Value</label>
                <VariableAutocompleteInput
                  value={payload.value !== undefined ? String(payload.value) : ''}
                  onChange={(val) => updatePayload({ value: val })}
                  placeholder="value"
                  document={document}
                  className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 font-mono text-[11px]"
                />
              </div>
            </div>
          )}

          {/* RESET FORM */}
          {action.type === 'reset_form' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-700">Target Form ID</label>
              {availableForms.length > 0 ? (
                <select
                  value={(payload.formId as string) || ''}
                  onChange={(e) => updatePayload({ formId: e.target.value })}
                  className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Auto (Enclosing Form) —</option>
                  {availableForms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} ({f.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={(payload.formId as string) || ''}
                  onChange={(e) => updatePayload({ formId: e.target.value })}
                  placeholder="Leave empty for parent form or enter #form-id"
                  className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
            </div>
          )}

          {/* CUSTOM EVENT */}
          {action.type === 'custom_event' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-700">Event Name</label>
              <input
                type="text"
                value={(payload.eventName as string) || ''}
                onChange={(e) => updatePayload({ eventName: e.target.value })}
                placeholder="e.g. app:user-signup"
                className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
            </div>
          )}
        </div>

        {/* Multi-step Visual Action Builder link callout */}
        {onOpenActionBuilder && (
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onOpenActionBuilder}
              className="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-700 rounded-md text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Open Visual Action Builder (Multi-step pipelines)</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // ==============================================================================================
  // 4. COMPACT SUMMARY CARD (Default configured state)
  // ==============================================================================================
  const summaryText = action ? formatActionSummary(action) : '';

  return (
    <div
      data-testid="action-summary-card"
      className={`p-2 bg-white border border-slate-200 hover:border-slate-300 rounded-lg flex flex-col gap-1.5 transition shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
              meta?.badgeClass || 'bg-slate-100 text-slate-700'
            }`}
          >
            <ActionIcon className="w-3 h-3" />
            <span>{meta?.shortLabel || action?.type}</span>
          </span>
          <span className="text-xs font-medium text-slate-800 truncate" title={summaryText}>
            {summaryText}
          </span>
        </div>

        {/* Actions toolbar */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            data-testid="edit-action-btn"
            onClick={() => setIsExpanded(true)}
            title="Configure Action"
            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="toggle-json-btn"
            onClick={() => setIsJsonMode(true)}
            title="View Raw JSON"
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="clear-action-btn"
            onClick={handleClear}
            title="Remove Action"
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
