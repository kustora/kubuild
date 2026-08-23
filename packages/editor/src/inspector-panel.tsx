import React, { useEffect, useState } from 'react';
import { ComponentRegistry, ComponentFieldDefinition } from '@kubuild/components';
import { findNodeById } from '@kubuild/core';
import { useEditorStore, Viewport } from './store';

export interface InspectorPanelProps {
  registry: ComponentRegistry;
  className?: string;
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

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ registry, className }) => {
  const { document, selectedNodeId, viewport, updateNodeProps, updateNodeStyle } = useEditorStore();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});

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

  const commitProp = (field: ComponentFieldDefinition, value: unknown) => {
    const result = updateNodeProps(node.id, { [field.name]: value }, registry);
    setError(`prop:${field.name}`, result.success ? null : result.error ?? 'Invalid value.');
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
            onChange={(e) => commitProp(field, e.target.checked)}
          />
        );
      case 'select':
        return (
          <select
            value={String(currentValue ?? '')}
            onChange={(e) => {
              const option = field.options?.find((o) => String(o.value) === e.target.value);
              commitProp(field, option ? option.value : e.target.value);
            }}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1"
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
            onChange={(e) => commitProp(field, e.target.value)}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            defaultValue={typeof currentValue === 'number' ? currentValue : ''}
            onBlur={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isNaN(parsed)) {
                setError(errorKey, 'Must be a number.');
                return;
              }
              commitProp(field, parsed);
            }}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1"
          />
        );
      case 'image':
      case 'action':
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
                return;
              }
              commitProp(field, parsed);
            }}
            rows={3}
            className="w-full text-xs font-mono border border-slate-200 rounded px-2 py-1"
          />
        );
      case 'string':
      default:
        return (
          <input
            type="text"
            defaultValue={typeof currentValue === 'string' ? currentValue : ''}
            onBlur={(e) => commitProp(field, e.target.value)}
            className="w-full text-xs border border-slate-200 rounded px-2 py-1"
          />
        );
    }
  };

  const activeBreakpoint = styleBreakpointFor(viewport);
  const activeLayer = (node.styles?.[activeBreakpoint] as Record<string, unknown> | undefined) ?? {};

  return (
    <div className={`flex flex-col gap-4 p-3 overflow-y-auto text-sm ${className || ''}`}>
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          {definition.label} Props
        </div>
        <div className="flex flex-col gap-3">
          {(definition.propFields ?? []).map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
              {renderPropControl(field)}
              <ErrorText message={fieldErrors[`prop:${field.name}`]} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Spacing ({activeBreakpoint === 'base' ? 'base' : `${activeBreakpoint} override`})
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SPACING_FIELDS.map((field) => {
            const errorKey = `style:${field.name}`;
            const currentValue = activeLayer[field.name];
            return (
              <div key={field.name}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{field.label}</label>
                <input
                  type="text"
                  defaultValue={typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : ''}
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') return;
                    const result = updateNodeStyle(node.id, { [field.name]: raw }, activeBreakpoint);
                    setError(errorKey, result.success ? null : result.error ?? 'Invalid value.');
                  }}
                  className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                />
                <ErrorText message={fieldErrors[errorKey]} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
