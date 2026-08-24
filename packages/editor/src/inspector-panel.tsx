import React, { useEffect, useState } from 'react';
import { ComponentRegistry, ComponentFieldDefinition, isBindableField } from '@kubuild/components';
import { findNodeById } from '@kubuild/core';
import { isVariableBinding } from '@kubuild/schema';
import { useEditorStore, Viewport } from './store';
import { VariableBindingControl, toBindingValue } from './variable-picker';

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

function normalizeSpacingValue(val: string): string {
  const trimmed = val.trim();
  if (trimmed === '') return '';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return `${trimmed}px`;
  }
  return trimmed;
}

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
  const valueStr = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const [text, setText] = useState(valueStr);

  useEffect(() => {
    setText(typeof value === 'string' || typeof value === 'number' ? String(value) : '');
  }, [value, nodeId, breakpoint]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    const normalized = normalizeSpacingValue(raw);
    onCommit(fieldName, normalized);
  };

  const handleBlur = () => {
    const normalized = normalizeSpacingValue(text);
    setText(normalized);
    onCommit(fieldName, normalized);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{fieldLabel}</label>
      <input
        type="text"
        value={text}
        placeholder="0px"
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      />
      <ErrorText message={error} />
    </div>
  );
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ registry, className }) => {
  const { document, selectedNodeId, viewport, updateNodeProps, updateNodeStyle, variableCatalog } =
    useEditorStore();
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
            onChange={(e) => commitProp(field, e.target.value)}
            className="w-full h-8 cursor-pointer rounded border border-slate-300 bg-white p-1"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={typeof currentValue === 'number' ? currentValue : ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                commitProp(field, undefined);
                return;
              }
              const parsed = Number(val);
              if (Number.isNaN(parsed)) {
                setError(errorKey, 'Must be a number.');
                return;
              }
              commitProp(field, parsed);
            }}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
              }
              commitProp(field, parsed);
            }}
            rows={3}
            className="w-full text-xs font-mono bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        );
      case 'string':
      default:
        return (
          <input
            type="text"
            value={typeof currentValue === 'string' ? currentValue : ''}
            onChange={(e) => commitProp(field, e.target.value)}
            className="w-full text-xs bg-white text-slate-900 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        );
    }
  };

  const activeBreakpoint = styleBreakpointFor(viewport);
  const activeLayer = (node.styles?.[activeBreakpoint] as Record<string, unknown> | undefined) ?? {};

  const handleCommitSpacing = (fieldName: string, value: string) => {
    const errorKey = `style:${fieldName}`;
    const result = updateNodeStyle(node.id, { [fieldName]: value }, activeBreakpoint);
    setError(errorKey, result.success ? null : result.error ?? 'Invalid value.');
  };

  return (
    <div className={`flex flex-col gap-4 p-3 overflow-y-auto text-sm text-slate-900 ${className || ''}`}>
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
                    onBind={(key) => commitProp(field, toBindingValue(key))}
                    onRevert={() => commitProp(field, field.defaultValue ?? '')}
                  />
                )}
                <ErrorText message={fieldErrors[`prop:${field.name}`]} />
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Spacing ({activeBreakpoint === 'base' ? 'base' : `${activeBreakpoint} override`})
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SPACING_FIELDS.map((field) => (
            <SpacingControl
              key={`${node.id}-${activeBreakpoint}-${field.name}`}
              nodeId={node.id}
              breakpoint={activeBreakpoint}
              fieldName={field.name}
              fieldLabel={field.label}
              value={activeLayer[field.name]}
              onCommit={handleCommitSpacing}
              error={fieldErrors[`style:${field.name}`]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
