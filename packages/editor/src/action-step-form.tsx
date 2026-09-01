import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActionStep,
  ActionStepType,
  PageDocument,
  Node,
} from '@kubuild/schema';
import {
  Globe,
  Bell,
  Navigation,
  Maximize2,
  Minimize2,
  Database,
  RotateCcw,
  Copy,
  Zap,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  Sliders,
  Sparkles,
} from 'lucide-react';

export interface ActionStepFormProps {
  step: ActionStep;
  document?: PageDocument;
  onUpdatePayload: (payload: Record<string, unknown>) => void;
  onUpdateMeta?: (meta: { label?: string; timeout?: number; continueOnError?: boolean }) => void;
  className?: string;
}

// ------------------------------------------------------------------------------------------------
// Document Node Scanners
// ------------------------------------------------------------------------------------------------

export function collectDocumentNodes(
  node: Node,
  predicate: (n: Node) => boolean,
  acc: Node[] = [],
): Node[] {
  if (predicate(node)) {
    acc.push(node);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectDocumentNodes(child, predicate, acc);
    }
  }
  return acc;
}

export function collectDocumentModals(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'modal' || n.type === 'dialog' || n.id.toLowerCase().includes('modal'),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.title as string) || (n.props?.label as string) || `<${n.type}> #${n.id}`,
  }));
}

export function collectDocumentForms(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'form' || n.id.toLowerCase().includes('form'),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.name as string) || (n.props?.ariaLabel as string) || `<${n.type}> #${n.id}`,
  }));
}

export function collectDocumentAnchors(doc?: PageDocument): Array<{ id: string; label: string }> {
  if (!doc?.document) return [];
  const nodes = collectDocumentNodes(
    doc.document,
    (n) => n.type === 'section' || n.type === 'container' || Boolean(n.props?.id),
  );
  return nodes.map((n) => ({
    id: n.id,
    label: (n.props?.title as string) || (n.props?.heading as string) || `#${n.id} (${n.type})`,
  }));
}

// ------------------------------------------------------------------------------------------------
// Key-Value Pair Editor (for Headers, Query Params, Details)
// ------------------------------------------------------------------------------------------------

export interface KeyValueEditorProps {
  title: string;
  entries: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  title,
  entries = {},
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value (e.g. {{form.email}})',
  emptyLabel = 'No entries configured',
}) => {
  const [rows, setRows] = useState<Array<{ id: string; key: string; value: string }>>(() => {
    return Object.entries(entries).map(([k, v], idx) => ({
      id: `row-${idx}-${k}`,
      key: k,
      value: typeof v === 'string' ? v : String(v ?? ''),
    }));
  });

  useEffect(() => {
    const currentKeys = Object.keys(entries);
    const rowKeys = rows.map((r) => r.key);
    // Sync only when external keys actually differ
    const keysDiffer =
      currentKeys.length !== rowKeys.length ||
      currentKeys.some((k) => entries[k] !== rows.find((r) => r.key === k)?.value);

    if (keysDiffer) {
      setRows(
        Object.entries(entries).map(([k, v], idx) => ({
          id: `row-${idx}-${k}`,
          key: k,
          value: typeof v === 'string' ? v : String(v ?? ''),
        })),
      );
    }
  }, [entries]);

  const commitRows = (newRows: Array<{ id: string; key: string; value: string }>) => {
    setRows(newRows);
    const record: Record<string, string> = {};
    for (const r of newRows) {
      if (r.key.trim()) {
        record[r.key.trim()] = r.value;
      }
    }
    onChange(record);
  };

  const handleAddRow = () => {
    const newRows = [...rows, { id: `row-${Date.now()}-${Math.random()}`, key: '', value: '' }];
    commitRows(newRows);
  };

  const handleRemoveRow = (id: string) => {
    const newRows = rows.filter((r) => r.id !== id);
    commitRows(newRows);
  };

  const handleUpdateRow = (id: string, field: 'key' | 'value', val: string) => {
    const newRows = rows.map((r) => (r.id === id ? { ...r, [field]: val } : r));
    commitRows(newRows);
  };

  return (
    <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{title}</span>
        <button
          type="button"
          onClick={handleAddRow}
          className="px-2 py-0.5 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded flex items-center gap-1 transition cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Add</span>
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic py-1 text-center">{emptyLabel}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <input
                type="text"
                value={row.key}
                onChange={(e) => handleUpdateRow(row.id, 'key', e.target.value)}
                placeholder={keyPlaceholder}
                className="w-1/3 text-xs bg-slate-900 text-slate-200 border border-slate-700/80 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
              <input
                type="text"
                value={row.value}
                onChange={(e) => handleUpdateRow(row.id, 'value', e.target.value)}
                placeholder={valuePlaceholder}
                className="flex-1 text-xs bg-slate-900 text-slate-200 border border-slate-700/80 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px]"
              />
              <button
                type="button"
                onClick={() => handleRemoveRow(row.id)}
                title="Remove entry"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 1. API Request Step Form
// ------------------------------------------------------------------------------------------------

export const ApiRequestStepForm: React.FC<{
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, onChange }) => {
  const method = (payload.method as string) || 'GET';
  const url = (payload.url as string) || '';
  const bodyFormat = (payload.bodyFormat as string) || (payload.bodyType as string) || 'json';
  const timeout = typeof payload.timeout === 'number' ? payload.timeout : '';
  const headers = (payload.headers as Record<string, string>) || {};
  const queryParams = (payload.queryParams as Record<string, string>) || {};

  const bodyStr = useMemo(() => {
    if (payload.body === undefined || payload.body === null) return '';
    if (typeof payload.body === 'string') return payload.body;
    try {
      return JSON.stringify(payload.body, null, 2);
    } catch {
      return String(payload.body);
    }
  }, [payload.body]);

  const [rawBody, setRawBody] = useState<string>(bodyStr);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    setRawBody(bodyStr);
  }, [bodyStr]);

  const handleMethodChange = (m: string) => {
    onChange({ ...payload, method: m });
  };

  const handleUrlChange = (u: string) => {
    onChange({ ...payload, url: u });
  };

  const handleBodyFormatChange = (fmt: string) => {
    onChange({ ...payload, bodyFormat: fmt, bodyType: fmt });
  };

  const handleBodyChange = (txt: string) => {
    setRawBody(txt);
    if (!txt.trim()) {
      setJsonError(null);
      onChange({ ...payload, body: undefined });
      return;
    }

    if (bodyFormat === 'json') {
      try {
        const parsed = JSON.parse(txt);
        setJsonError(null);
        onChange({ ...payload, body: parsed });
      } catch {
        setJsonError('Invalid JSON format');
        // Still save string payload
        onChange({ ...payload, body: txt });
      }
    } else {
      setJsonError(null);
      onChange({ ...payload, body: txt });
    }
  };

  const handleTimeoutChange = (t: string) => {
    const num = Number(t);
    onChange({ ...payload, timeout: !isNaN(num) && num > 0 ? num : undefined });
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      {/* Endpoint Bar: Method + URL */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
          HTTP Method &amp; Endpoint URL
        </label>
        <div className="flex items-center gap-2">
          <select
            value={method}
            onChange={(e) => handleMethodChange(e.target.value)}
            className="shrink-0 text-xs font-bold bg-slate-900 text-blue-400 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="HEAD">HEAD</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>

          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://api.example.com/endpoint or {{form.webhookUrl}}"
              className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
            />
          </div>
        </div>
        <span className="text-[10px] text-slate-500 mt-1 block">
          Tip: You can interpolate form fields like <code className="font-mono text-slate-400">{'{{form.email}}'}</code> or runtime variables in the URL.
        </span>
      </div>

      {/* Headers Key-Value Editor */}
      <KeyValueEditor
        title="HTTP Headers"
        entries={headers}
        onChange={(hdrs) => onChange({ ...payload, headers: hdrs })}
        keyPlaceholder="Header (e.g. Authorization)"
        valuePlaceholder="Value (e.g. Bearer {{variables.token}})"
        emptyLabel="No custom headers (default Content-Type: application/json applies)"
      />

      {/* Query Params Key-Value Editor */}
      <KeyValueEditor
        title="Query Parameters"
        entries={queryParams}
        onChange={(qp) => onChange({ ...payload, queryParams: qp })}
        keyPlaceholder="Param Name"
        valuePlaceholder="Value"
        emptyLabel="No query parameters configured"
      />

      {/* Body Payload Section (for POST/PUT/PATCH/DELETE) */}
      {method !== 'GET' && method !== 'HEAD' && (
        <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Request Body Payload</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-400 mr-1">Format:</span>
              <select
                value={bodyFormat}
                onChange={(e) => handleBodyFormatChange(e.target.value)}
                className="text-[11px] bg-slate-900 text-slate-200 border border-slate-700 rounded px-2 py-1 focus:outline-none"
              >
                <option value="json">JSON</option>
                <option value="formData">FormData</option>
                <option value="urlencoded">URL-Encoded</option>
                <option value="raw">Raw Text</option>
              </select>
            </div>
          </div>

          <textarea
            value={rawBody}
            onChange={(e) => handleBodyChange(e.target.value)}
            rows={5}
            placeholder={
              bodyFormat === 'json'
                ? '{\n  "email": "{{form.email}}",\n  "name": "{{form.name}}"\n}'
                : 'key1=value1&key2=value2'
            }
            className="w-full text-xs font-mono bg-slate-900 text-slate-200 border border-slate-700/90 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
          />

          {jsonError && (
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{jsonError}</span>
            </div>
          )}
        </div>
      )}

      {/* Timeout setting */}
      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
        <div>
          <span className="text-xs font-medium text-slate-200 block">Request Timeout</span>
          <span className="text-[10px] text-slate-400">Abort request if no response within ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={timeout}
            onChange={(e) => handleTimeoutChange(e.target.value)}
            placeholder="10000"
            className="w-24 text-xs font-mono bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1 text-right focus:outline-none"
          />
          <span className="text-xs text-slate-400">ms</span>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 2. Show Toast Step Form
// ------------------------------------------------------------------------------------------------

export const ShowToastStepForm: React.FC<{
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, onChange }) => {
  const type = (payload.type as string) || (payload.variant as string) || 'success';
  const message = (payload.message as string) || '';
  const title = (payload.title as string) || '';
  const duration = typeof payload.duration === 'number' ? payload.duration : 3000;
  const position = (payload.position as string) || 'bottom-right';

  const TOAST_TYPES: Array<{ id: string; label: string; colorClass: string }> = [
    { id: 'success', label: 'Success', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { id: 'error', label: 'Error', colorClass: 'bg-red-500/20 text-red-300 border-red-500/40' },
    { id: 'warning', label: 'Warning', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { id: 'info', label: 'Info', colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  ];

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      {/* Toast Type Badges */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Notification Type</label>
        <div className="grid grid-cols-4 gap-2">
          {TOAST_TYPES.map((t) => {
            const isSelected = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange({ ...payload, type: t.id, variant: t.id })}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  isSelected
                    ? `${t.colorClass} ring-2 ring-blue-500/50 shadow-xs`
                    : 'bg-slate-900 text-slate-400 border-slate-700/80 hover:text-slate-200'
                }`}
              >
                {isSelected && <Check className="w-3 h-3" />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message input */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Toast Message <span className="text-red-400">*</span>
        </label>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => onChange({ ...payload, message: e.target.value })}
          placeholder="e.g. Your submission was received successfully!"
          className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Optional Title input */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Title (Optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onChange({ ...payload, title: e.target.value || undefined })}
          placeholder="e.g. Success"
          className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Duration slider & Position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">Duration</label>
            <span className="text-[11px] font-mono text-blue-400">
              {duration === 0 ? 'Persistent' : `${duration} ms`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10000}
            step={500}
            value={duration}
            onChange={(e) => onChange({ ...payload, duration: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Screen Position</label>
          <select
            value={position}
            onChange={(e) => onChange({ ...payload, position: e.target.value })}
            className="w-full text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="bottom-center">Bottom Center</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
            <option value="top-center">Top Center</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 3. Navigate Step Form
// ------------------------------------------------------------------------------------------------

export const NavigateStepForm: React.FC<{
  payload: Record<string, unknown>;
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
  const url = (payload.url as string) || '';
  const target = (payload.target as string) || '_self';
  const scroll = Boolean(payload.scroll);
  const behavior = (payload.behavior as string) || 'smooth';
  const replace = Boolean(payload.replace);

  const availableAnchors = useMemo(() => collectDocumentAnchors(document), [document]);

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      {/* Target URL */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Target Destination URL or Route <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => onChange({ ...payload, url: e.target.value })}
            placeholder="https://example.com, /dashboard, or #section-id"
            className="flex-1 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Anchor Quick Selector if sections available */}
      {availableAnchors.length > 0 && (
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <label className="block text-[11px] font-medium text-slate-400 mb-1">
            Or select document section to scroll:
          </label>
          <select
            value={url.startsWith('#') ? url : ''}
            onChange={(e) => {
              if (e.target.value) {
                onChange({ ...payload, url: e.target.value, scroll: true });
              }
            }}
            className="w-full text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="">— Select Section Anchor —</option>
            {availableAnchors.map((anc) => (
              <option key={anc.id} value={`#${anc.id}`}>
                {anc.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation Options */}
      <div className="flex flex-col gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Open in New Tab</span>
          <input
            type="checkbox"
            checked={target === '_blank'}
            onChange={(e) => onChange({ ...payload, target: e.target.checked ? '_blank' : '_self' })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Smooth Scroll into View</span>
          <input
            type="checkbox"
            checked={scroll}
            onChange={(e) => onChange({ ...payload, scroll: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Replace History Entry</span>
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => onChange({ ...payload, replace: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 4. Modal Step Form (Open / Close Modal)
// ------------------------------------------------------------------------------------------------

export const ModalStepForm: React.FC<{
  payload: Record<string, unknown>;
  isOpenAction: boolean;
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, isOpenAction, document, onChange }) => {
  const modalNodeId = (payload.modalNodeId as string) || (payload.modalId as string) || '';
  const detectedModals = useMemo(() => collectDocumentModals(document), [document]);

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Target Modal Node ID <span className="text-red-400">*</span>
        </label>

        {detectedModals.length > 0 && (
          <select
            value={modalNodeId}
            onChange={(e) =>
              onChange({ ...payload, modalNodeId: e.target.value, modalId: e.target.value })
            }
            className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">— Select Detected Modal —</option>
            {detectedModals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (#{m.id})
                {`${m.label} (#${m.id})`}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={modalNodeId}
          onChange={(e) =>
            onChange({ ...payload, modalNodeId: e.target.value, modalId: e.target.value })
          }
          placeholder="e.g. modal-contact-us or modal-1"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-[10px] text-slate-500 mt-1 block">
          Specify the unique Node ID of the modal component to {isOpenAction ? 'open' : 'close'}.
        </span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 5. Set State Step Form
// ------------------------------------------------------------------------------------------------

export const SetStateStepForm: React.FC<{
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, onChange }) => {
  const key = (payload.key as string) || '';
  const value = payload.value !== undefined ? String(payload.value) : '';
  const scope = (payload.scope as string) || 'runtime';

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          State Variable Key <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={key}
          onChange={(e) => onChange({ ...payload, key: e.target.value })}
          placeholder="e.g. selectedProduct, isLoggedIn, cartCount"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Value Expression</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange({ ...payload, value: e.target.value })}
          placeholder="e.g. true, 42, {{form.name}}, active"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Storage Scope</label>
        <select
          value={scope}
          onChange={(e) => onChange({ ...payload, scope: e.target.value })}
          className="w-full text-xs bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
        >
          <option value="runtime">Runtime (Current page view memory)</option>
          <option value="session">Session (Browser sessionStorage)</option>
          <option value="local">Local (Browser localStorage)</option>
          <option value="document">Document (Portable document state)</option>
        </select>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 6. Reset Form Step Form
// ------------------------------------------------------------------------------------------------

export const ResetFormStepForm: React.FC<{
  payload: Record<string, unknown>;
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
  const formId = (payload.formId as string) || '';
  const detectedForms = useMemo(() => collectDocumentForms(document), [document]);

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Target Form</label>

        {detectedForms.length > 0 && (
          <select
            value={formId}
            onChange={(e) => onChange({ ...payload, formId: e.target.value || undefined })}
            className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 mb-2 focus:outline-none cursor-pointer"
          >
            <option value="">— Parent Form / Active Form Container —</option>
            {detectedForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} (#{f.id})
                {`${f.label} (#${f.id})`}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          value={formId}
          onChange={(e) => onChange({ ...payload, formId: e.target.value || undefined })}
          placeholder="Optional: explicit form ID (e.g. contact-form)"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-[10px] text-slate-500 mt-1 block">
          Leave blank to automatically target the enclosing parent form.
        </span>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 7. Copy Clipboard Step Form
// ------------------------------------------------------------------------------------------------

export const CopyClipboardStepForm: React.FC<{
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, onChange }) => {
  const text = (payload.text as string) || '';
  const notify = payload.notify !== false;
  const toastMessage = (payload.toastMessage as string) || 'Copied to clipboard!';

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Text / Value to Copy <span className="text-red-400">*</span>
        </label>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => onChange({ ...payload, text: e.target.value })}
          placeholder="Static text or {{variables.discountCode}} or {{form.referral}}"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Show Toast Notification on Copy</span>
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => onChange({ ...payload, notify: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
        </label>

        {notify && (
          <div className="mt-1">
            <label className="block text-[11px] text-slate-400 mb-1">Feedback Message</label>
            <input
              type="text"
              value={toastMessage}
              onChange={(e) => onChange({ ...payload, toastMessage: e.target.value })}
              placeholder="Copied to clipboard!"
              className="w-full text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded px-2.5 py-1.5 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// 8. Custom Event Step Form
// ------------------------------------------------------------------------------------------------

export const CustomEventStepForm: React.FC<{
  payload: Record<string, unknown>;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, onChange }) => {
  const eventName = (payload.eventName as string) || '';
  const bubbles = payload.bubbles !== false;
  const cancelable = payload.cancelable !== false;
  const detail = (payload.detail as Record<string, unknown>) || {};

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Custom Event Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={eventName}
          onChange={(e) => onChange({ ...payload, eventName: e.target.value })}
          placeholder="e.g. analytics:purchase or app:user-registered"
          className="w-full text-xs font-mono bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-[10px] text-slate-500 mt-1 block">
          Dispatches <code className="font-mono text-slate-400">new CustomEvent(name, detail)</code> on the window.
        </span>
      </div>

      <KeyValueEditor
        title="Event Detail Payload"
        entries={detail}
        onChange={(det) => onChange({ ...payload, detail: det })}
        keyPlaceholder="Key"
        valuePlaceholder="Value (e.g. {{form.email}})"
        emptyLabel="No custom detail properties configured"
      />

      <div className="flex items-center gap-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={bubbles}
            onChange={(e) => onChange({ ...payload, bubbles: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span className="text-xs text-slate-300">Bubbles</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={cancelable}
            onChange={(e) => onChange({ ...payload, cancelable: e.target.checked })}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span className="text-xs text-slate-300">Cancelable</span>
        </label>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Master Step Form Container
// ------------------------------------------------------------------------------------------------

export const ActionStepForm: React.FC<ActionStepFormProps> = ({
  step,
  document,
  onUpdatePayload,
  onUpdateMeta,
  className = '',
}) => {
  const [label, setLabel] = useState<string>(step.label || '');
  const [continueOnError, setContinueOnError] = useState<boolean>(Boolean(step.continueOnError));

  useEffect(() => {
    setLabel(step.label || '');
    setContinueOnError(Boolean(step.continueOnError));
  }, [step.id, step.label, step.continueOnError]);

  const handleLabelChange = (val: string) => {
    setLabel(val);
    onUpdateMeta?.({ label: val });
  };

  const handleContinueOnErrorChange = (checked: boolean) => {
    setContinueOnError(checked);
    onUpdateMeta?.({ continueOnError: checked });
  };

  const renderTypeForm = () => {
    const payload = step.payload || {};
    switch (step.type) {
      case 'api_request':
        return <ApiRequestStepForm payload={payload} onChange={onUpdatePayload} />;
      case 'show_toast':
        return <ShowToastStepForm payload={payload} onChange={onUpdatePayload} />;
      case 'navigate':
        return <NavigateStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'open_modal':
        return (
          <ModalStepForm
            payload={payload}
            isOpenAction={true}
            document={document}
            onChange={onUpdatePayload}
          />
        );
      case 'close_modal':
        return (
          <ModalStepForm
            payload={payload}
            isOpenAction={false}
            document={document}
            onChange={onUpdatePayload}
          />
        );
      case 'set_state':
        return <SetStateStepForm payload={payload} onChange={onUpdatePayload} />;
      case 'reset_form':
        return <ResetFormStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'copy_clipboard':
        return <CopyClipboardStepForm payload={payload} onChange={onUpdatePayload} />;
      case 'custom_event':
        return <CustomEventStepForm payload={payload} onChange={onUpdatePayload} />;
      default:
        return (
          <div className="text-xs text-slate-400 italic p-3 bg-slate-950 rounded">
            No specialized configuration available for step type: {step.type}
          </div>
        );
    }
  };

  return (
    <div
      data-testid={`action-step-form-${step.id}`}
      className={`flex flex-col gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-inner ${className}`}
    >
      {/* Step Label Meta Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
          Step Description / Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={`Describe this ${step.type} step`}
          className="w-full text-xs font-medium bg-slate-950 text-slate-100 border border-slate-700/80 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Dynamic Type-specific Form */}
      <div className="pt-2 border-t border-slate-800/80">{renderTypeForm()}</div>

      {/* Advanced Error Policy Options */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={continueOnError}
            onChange={(e) => handleContinueOnErrorChange(e.target.checked)}
            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 cursor-pointer"
          />
          <span className="text-xs text-slate-400 hover:text-slate-300 transition">
            Continue pipeline execution if this step fails (Ignore Error)
          </span>
        </label>
      </div>
    </div>
  );
};
