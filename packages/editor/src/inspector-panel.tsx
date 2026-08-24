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
