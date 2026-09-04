import React, { useState, useEffect, useMemo } from 'react';
import {
  ActionStep,
  PageDocument,
  Node,
} from '@kubuild/schema';
import {
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { ActionBranchEditor } from './action-branch-editor';
import {
  VariableAutocompleteInput,
  VariableAutocompleteTextarea,
} from '../ui/variable-autocomplete-input';
import {
  collectDocumentNodes,
  collectDocumentModals,
  collectDocumentForms,
  collectDocumentAnchors,
  collectDocumentFormFields,
} from '../../utils/document-scanner';


export interface ActionStepFormProps {
  step: ActionStep;
  document?: PageDocument;
  onUpdatePayload: (payload: Record<string, unknown>) => void;
  onUpdateMeta?: (meta: { label?: string; timeout?: number; continueOnError?: boolean }) => void;
  onUpdateBranches?: (branches: { onSuccess?: ActionStep[]; onError?: ActionStep[] }) => void;
  className?: string;
  hideBranches?: boolean;
}

// ------------------------------------------------------------------------------------------------
// Key-Value Pair Editor (for Headers, Query Params, Details)
// ------------------------------------------------------------------------------------------------

export interface KeyValueEditorProps {
  title: string;
  entries: Record<string, unknown> | undefined;
  onChange: (updated: Record<string, string>) => void;
  document?: PageDocument;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  title,
  entries = {},
  onChange,
  document,
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
                style={{ color: '#f1f5f9' }}
                className="w-1/3 text-xs bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px] shadow-inner"
              />
              <div className="flex-1 min-w-0">
                <VariableAutocompleteInput
                  value={row.value}
                  document={document}
                  onChange={(val) => handleUpdateRow(row.id, 'value', val)}
                  placeholder={valuePlaceholder}
                  className="py-1.5"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRow(row.id)}
                title="Remove entry"
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer shrink-0"
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
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
  const method = (payload.method as string) || 'GET';
  const url = (payload.url as string) || '';
  const bodyFormat = (payload.bodyFormat as string) || (payload.bodyType as string) || 'json';
  const timeout = typeof payload.timeout === 'number' ? payload.timeout : '';
  const headers = (payload.headers as Record<string, string>) || {};
  const queryParams = (payload.queryParams as Record<string, string>) || {};

  // Convert payload.body to string for Raw mode
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

  // Determine initial body mode: 'fields' (form inputs) by default unless it's raw text or non-object string
  const initialMode = useMemo<'fields' | 'raw'>(() => {
    if (bodyFormat === 'raw' || bodyFormat === 'text') return 'raw';
    if (typeof payload.body === 'string' && payload.body.trim()) {
      try {
        const parsed = JSON.parse(payload.body);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return 'fields';
        }
        return 'raw';
      } catch {
        return 'raw';
      }
    }
    return 'fields';
  }, [bodyFormat, payload.body]);

  const [bodyMode, setBodyMode] = useState<'fields' | 'raw'>(initialMode);

  // Key-value rows for Form mode
  const [bodyRows, setBodyRows] = useState<Array<{ id: string; key: string; value: string }>>(() => {
    if (typeof payload.body === 'object' && payload.body !== null && !Array.isArray(payload.body)) {
      return Object.entries(payload.body).map(([k, v], idx) => ({
        id: `brow-${idx}-${k}`,
        key: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
      }));
    }
    if (typeof payload.body === 'string' && payload.body.trim()) {
      try {
        const parsed = JSON.parse(payload.body);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return Object.entries(parsed).map(([k, v], idx) => ({
            id: `brow-${idx}-${k}`,
            key: k,
            value: typeof v === 'string' ? v : JSON.stringify(v),
          }));
        }
      } catch {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    setRawBody(bodyStr);
  }, [bodyStr]);

  // Sync rows if payload.body changes externally in fields mode
  useEffect(() => {
    if (bodyMode === 'fields' && typeof payload.body === 'object' && payload.body !== null && !Array.isArray(payload.body)) {
      const currentKeys = Object.keys(payload.body);
      const rowKeys = bodyRows.map((r) => r.key);
      const differs =
        currentKeys.length !== rowKeys.length ||
        currentKeys.some((k) => (payload.body as Record<string, unknown>)[k] !== bodyRows.find((r) => r.key === k)?.value);

      if (differs) {
        setBodyRows(
          Object.entries(payload.body).map(([k, v], idx) => ({
            id: `brow-${idx}-${k}`,
            key: k,
            value: typeof v === 'string' ? v : JSON.stringify(v),
          })),
        );
      }
    }
  }, [payload.body, bodyMode]);

  const commitBodyRows = (newRows: Array<{ id: string; key: string; value: string }>) => {
    setBodyRows(newRows);
    const record: Record<string, string> = {};
    for (const r of newRows) {
      if (r.key.trim()) {
        record[r.key.trim()] = r.value;
      }
    }
    const hasKeys = Object.keys(record).length > 0;
    onChange({ ...payload, body: hasKeys ? record : undefined });
    setRawBody(hasKeys ? JSON.stringify(record, null, 2) : '');
    setJsonError(null);
  };

  const handleAddBodyRow = () => {
    const newRows = [...bodyRows, { id: `brow-${Date.now()}-${Math.random()}`, key: '', value: '' }];
    commitBodyRows(newRows);
  };

  const handleRemoveBodyRow = (id: string) => {
    const newRows = bodyRows.filter((r) => r.id !== id);
    commitBodyRows(newRows);
  };

  const handleUpdateBodyRow = (id: string, field: 'key' | 'value', val: string) => {
    const newRows = bodyRows.map((r) => (r.id === id ? { ...r, [field]: val } : r));
    commitBodyRows(newRows);
  };

  const detectedFormFields = useMemo(() => {
    return collectDocumentFormFields(document);
  }, [document]);

  const handleAutoFillFormFields = () => {
    const existingKeys = new Set(bodyRows.map((r) => r.key.trim().toLowerCase()));
    const newRows = [...bodyRows];

    for (const field of detectedFormFields) {
      if (!existingKeys.has(field.toLowerCase())) {
        newRows.push({
          id: `brow-auto-${Date.now()}-${field}`,
          key: field,
          value: `{{form.${field}}}`,
        });
        existingKeys.add(field.toLowerCase());
      }
    }

    commitBodyRows(newRows);
  };

  const handleSetBodyMode = (mode: 'fields' | 'raw') => {
    if (mode === 'fields') {
      if (rawBody.trim()) {
        try {
          const parsed = JSON.parse(rawBody);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const parsedRows = Object.entries(parsed).map(([k, v], idx) => ({
              id: `brow-${idx}-${k}`,
              key: k,
              value: typeof v === 'string' ? v : JSON.stringify(v),
            }));
            setBodyRows(parsedRows);
            commitBodyRows(parsedRows);
            setJsonError(null);
            setBodyMode('fields');
          } else {
            setJsonError('Cannot switch to form fields: JSON root must be an object { "key": "value" }');
          }
        } catch {
          setJsonError('Cannot switch to form fields: please fix invalid JSON syntax first');
        }
      } else {
        setBodyRows([]);
        setJsonError(null);
        setBodyMode('fields');
      }
    } else {
      const record: Record<string, string> = {};
      for (const r of bodyRows) {
        if (r.key.trim()) {
          record[r.key.trim()] = r.value;
        }
      }
      setRawBody(Object.keys(record).length > 0 ? JSON.stringify(record, null, 2) : '');
      setJsonError(null);
      setBodyMode('raw');
    }
  };

  const handleMethodChange = (m: string) => {
    onChange({ ...payload, method: m });
  };

  const handleUrlChange = (u: string) => {
    onChange({ ...payload, url: u });
  };

  const handleBodyFormatChange = (fmt: string) => {
    onChange({ ...payload, bodyFormat: fmt, bodyType: fmt });
    if (fmt === 'raw' || fmt === 'text') {
      setBodyMode('raw');
    }
  };

  const handleRawBodyChange = (txt: string) => {
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
            style={{ color: '#60a5fa' }}
            className="shrink-0 text-xs font-bold bg-slate-950 text-blue-400 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs"
          >
            <option value="GET" className="bg-slate-900 text-slate-100">GET</option>
            <option value="POST" className="bg-slate-900 text-slate-100">POST</option>
            <option value="PUT" className="bg-slate-900 text-slate-100">PUT</option>
            <option value="DELETE" className="bg-slate-900 text-slate-100">DELETE</option>
            <option value="PATCH" className="bg-slate-900 text-slate-100">PATCH</option>
            <option value="HEAD" className="bg-slate-900 text-slate-100">HEAD</option>
            <option value="OPTIONS" className="bg-slate-900 text-slate-100">OPTIONS</option>
          </select>

          <div className="relative flex-1 min-w-0">
            <VariableAutocompleteInput
              value={url}
              document={document}
              onChange={handleUrlChange}
              placeholder="https://api.example.com/endpoint or {{form.webhookUrl}}"
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
        document={document}
        onChange={(hdrs) => onChange({ ...payload, headers: hdrs })}
        keyPlaceholder="Header (e.g. Authorization)"
        valuePlaceholder="Value (e.g. Bearer {{variables.token}})"
        emptyLabel="No custom headers (default Content-Type: application/json applies)"
      />

      {/* Query Params Key-Value Editor */}
      <KeyValueEditor
        title="Query Parameters"
        entries={queryParams}
        document={document}
        onChange={(qp) => onChange({ ...payload, queryParams: qp })}
        keyPlaceholder="Param Name"
        valuePlaceholder="Value"
        emptyLabel="No query parameters configured"
      />

      {/* Body Payload Section (for POST/PUT/PATCH/DELETE) */}
      {method !== 'GET' && method !== 'HEAD' && (
        <div className="flex flex-col gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">Request Body Payload</span>
              {/* Mode Switch Tabs: Form Inputs vs Raw Code */}
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700/80 text-[11px]">
                <button
                  type="button"
                  data-testid="body-mode-fields-btn"
                  onClick={() => handleSetBodyMode('fields')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                    bodyMode === 'fields'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Form Inputs
                </button>
                <button
                  type="button"
                  data-testid="body-mode-raw-btn"
                  onClick={() => handleSetBodyMode('raw')}
                  className={`px-2.5 py-0.5 rounded-md font-medium transition cursor-pointer ${
                    bodyMode === 'raw'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Raw Code
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Format:</span>
              <select
                value={bodyFormat}
                onChange={(e) => handleBodyFormatChange(e.target.value)}
                style={{ color: '#e2e8f0' }}
                className="text-[11px] font-medium bg-slate-950 text-slate-200 border border-slate-700 rounded-md px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="json" className="bg-slate-900 text-slate-100">JSON</option>
                <option value="formData" className="bg-slate-900 text-slate-100">FormData</option>
                <option value="urlencoded" className="bg-slate-900 text-slate-100">URL-Encoded</option>
                <option value="raw" className="bg-slate-900 text-slate-100">Raw Text</option>
              </select>
            </div>
          </div>

          {bodyMode === 'fields' ? (
            /* Form Inputs Mode (Key-Value Builder with Variable Autocomplete) */
            <div className="flex flex-col gap-2">
              {bodyRows.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic py-2.5 text-center bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
                  No payload fields configured. Click &quot;Add Field&quot; or auto-fill from form fields on the page.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {bodyRows.map((row) => (
                    <div key={row.id} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={row.key}
                        onChange={(e) => handleUpdateBodyRow(row.id, 'key', e.target.value)}
                        placeholder="Field Key (e.g. email)"
                        style={{ color: '#f1f5f9' }}
                        className="w-1/3 text-xs bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-[11px] shadow-inner"
                      />
                      <div className="flex-1 min-w-0">
                        <VariableAutocompleteInput
                          value={row.value}
                          document={document}
                          onChange={(val) => handleUpdateBodyRow(row.id, 'value', val)}
                          placeholder="Field Value (e.g. {{form.email}})"
                          className="py-1.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBodyRow(row.id)}
                        title="Remove field"
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Controls for Form Mode */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="add-body-field-btn"
                    onClick={handleAddBodyRow}
                    className="px-2.5 py-1 text-[11px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Field</span>
                  </button>

                  {detectedFormFields.length > 0 && (
                    <button
                      type="button"
                      data-testid="autofill-body-fields-btn"
                      onClick={handleAutoFillFormFields}
                      title="Automatically populate fields from form elements on this page"
                      className="px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>Auto-fill from Form ({detectedFormFields.length})</span>
                    </button>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {bodyFormat === 'formData'
                    ? 'multipart/form-data'
                    : bodyFormat === 'urlencoded'
                    ? 'application/x-www-form-urlencoded'
                    : 'application/json'}
                </span>
              </div>
            </div>
          ) : (
            /* Raw Code Editor Mode */
            <div className="flex flex-col gap-2">
              <VariableAutocompleteTextarea
                value={rawBody}
                document={document}
                onChange={handleRawBodyChange}
                rows={5}
                placeholder={
                  bodyFormat === 'json'
                    ? '{\n  "email": "{{form.email}}",\n  "name": "{{form.name}}"\n}'
                    : 'key1=value1&key2=value2'
                }
              />

              {jsonError && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{jsonError}</span>
                </div>
              )}
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
            style={{ color: '#f1f5f9' }}
            className="w-24 text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
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
        <VariableAutocompleteTextarea
          rows={2}
          value={message}
          document={document}
          onChange={(val) => onChange({ ...payload, message: val })}
          placeholder="e.g. Your submission was received successfully!"
        />
      </div>

      {/* Optional Title input */}
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Title (Optional)</label>
        <VariableAutocompleteInput
          value={title}
          document={document}
          onChange={(val) => onChange({ ...payload, title: val || undefined })}
          placeholder="e.g. Success"
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
            style={{ color: '#e2e8f0' }}
            className="w-full text-xs bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="bottom-right" className="bg-slate-900 text-slate-100">Bottom Right</option>
            <option value="bottom-left" className="bg-slate-900 text-slate-100">Bottom Left</option>
            <option value="bottom-center" className="bg-slate-900 text-slate-100">Bottom Center</option>
            <option value="top-right" className="bg-slate-900 text-slate-100">Top Right</option>
            <option value="top-left" className="bg-slate-900 text-slate-100">Top Left</option>
            <option value="top-center" className="bg-slate-900 text-slate-100">Top Center</option>
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
          <VariableAutocompleteInput
            value={url}
            document={document}
            onChange={(val) => onChange({ ...payload, url: val })}
            placeholder="https://example.com, /dashboard, or #section-id"
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
            style={{ color: '#e2e8f0' }}
            className="w-full text-xs bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-100">— Select Section Anchor —</option>
            {availableAnchors.map((anc) => (
              <option key={anc.id} value={`#${anc.id}`} className="bg-slate-900 text-slate-100">
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
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Smooth Scroll into View</span>
          <input
            type="checkbox"
            checked={scroll}
            onChange={(e) => onChange({ ...payload, scroll: e.target.checked })}
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Replace History Entry</span>
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => onChange({ ...payload, replace: e.target.checked })}
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
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
            style={{ color: '#f1f5f9' }}
            className="w-full text-xs bg-slate-950 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-100">— Select Detected Modal —</option>
            {detectedModals.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
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
          style={{ color: '#f1f5f9' }}
          className="w-full text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
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
          style={{ color: '#f1f5f9' }}
          className="w-full text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Value Expression</label>
        <VariableAutocompleteInput
          value={value}
          document={document}
          onChange={(val) => onChange({ ...payload, value: val })}
          placeholder="e.g. true, 42, {{form.name}}, active"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">Storage Scope</label>
        <select
          value={scope}
          onChange={(e) => onChange({ ...payload, scope: e.target.value })}
          style={{ color: '#e2e8f0' }}
          className="w-full text-xs bg-slate-950 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none cursor-pointer"
        >
          <option value="runtime" className="bg-slate-900 text-slate-100">Runtime (Current page view memory)</option>
          <option value="session" className="bg-slate-900 text-slate-100">Session (Browser sessionStorage)</option>
          <option value="local" className="bg-slate-900 text-slate-100">Local (Browser localStorage)</option>
          <option value="document" className="bg-slate-900 text-slate-100">Document (Portable document state)</option>
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
            style={{ color: '#f1f5f9' }}
            className="w-full text-xs bg-slate-950 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 mb-2 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="" className="bg-slate-900 text-slate-100">— Parent Form / Active Form Container —</option>
            {detectedForms.map((f) => (
              <option key={f.id} value={f.id} className="bg-slate-900 text-slate-100">
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
          style={{ color: '#f1f5f9' }}
          className="w-full text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
  const text = (payload.text as string) || '';
  const notify = payload.notify !== false;
  const toastMessage = (payload.toastMessage as string) || 'Copied to clipboard!';

  return (
    <div className="flex flex-col gap-3.5 text-xs">
      <div>
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          Text / Value to Copy <span className="text-red-400">*</span>
        </label>
        <VariableAutocompleteTextarea
          rows={2}
          value={text}
          document={document}
          onChange={(val) => onChange({ ...payload, text: val })}
          placeholder="Static text or {{variables.discountCode}} or {{form.referral}}"
        />
      </div>

      <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-slate-200">Show Toast Notification on Copy</span>
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => onChange({ ...payload, notify: e.target.checked })}
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
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
              style={{ color: '#f1f5f9' }}
              className="w-full text-xs bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
  document?: PageDocument;
  onChange: (payload: Record<string, unknown>) => void;
}> = ({ payload, document, onChange }) => {
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
          style={{ color: '#f1f5f9' }}
          className="w-full text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-[10px] text-slate-500 mt-1 block">
          Dispatches <code className="font-mono text-slate-400">new CustomEvent(name, detail)</code> on the window.
        </span>
      </div>

      <KeyValueEditor
        title="Event Detail Payload"
        entries={detail}
        document={document}
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
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-300">Bubbles</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={cancelable}
            onChange={(e) => onChange({ ...payload, cancelable: e.target.checked })}
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
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
  onUpdateBranches,
  className = '',
  hideBranches = false,
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
        return <ApiRequestStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'show_toast':
        return <ShowToastStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
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
        return <SetStateStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'reset_form':
        return <ResetFormStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'copy_clipboard':
        return <CopyClipboardStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
      case 'custom_event':
        return <CustomEventStepForm payload={payload} document={document} onChange={onUpdatePayload} />;
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
      className={`flex flex-col gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-inner text-slate-100 ${className}`}
    >
      {/* Step Label Meta Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
          Step Description / Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={`Describe this ${step.type} step`}
          style={{ color: '#f1f5f9' }}
          className="w-full text-xs font-medium bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700/80 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner"
        />
      </div>

      {/* Dynamic Type-specific Form */}
      <div className="pt-2 border-t border-slate-800/80">{renderTypeForm()}</div>

      {/* Branching Editor (for API Request steps) */}
      {step.type === 'api_request' && !hideBranches && onUpdateBranches && (
        <div className="pt-2 border-t border-slate-800/80">
          <ActionBranchEditor
            parentStep={step}
            document={document}
            onUpdateSuccessSteps={(successSteps) =>
              onUpdateBranches({ onSuccess: successSteps, onError: step.onError })
            }
            onUpdateErrorSteps={(errorSteps) =>
              onUpdateBranches({ onSuccess: step.onSuccess, onError: errorSteps })
            }
          />
        </div>
      )}

      {/* Advanced Error Policy Options */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={continueOnError}
            onChange={(e) => handleContinueOnErrorChange(e.target.checked)}
            className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-400 hover:text-slate-300 transition">
            Continue pipeline execution if this step fails (Ignore Error)
          </span>
        </label>
      </div>
    </div>
  );
};
