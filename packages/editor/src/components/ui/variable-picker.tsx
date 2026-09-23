import React from 'react';
import { isVariableBinding, VariableBinding } from '@kubuild/schema';
import { ComponentFieldDefinition, primitiveTypeForField } from '@kubuild/components';
import { VariableCatalog, VariableDefinition } from '@kubuild/core';

/**
 * Filters a host catalog down to entries whose type is compatible with a given
 * bindable prop field — 'array'/'object' catalog entries are never offered onto
 * scalar-bindable fields (string/number/boolean), since resolvePropsForNode's
 * type check would reject them at render time anyway.
 */
export function getCompatibleCatalogEntries(
  field: ComponentFieldDefinition,
  catalog: VariableCatalog | undefined,
): VariableDefinition[] {
  const expectedType = primitiveTypeForField(field);
  if (!expectedType || !catalog) {
    return [];
  }
  return catalog.filter((entry) => entry.type === expectedType);
}

export function toBindingValue(key: string, fallback?: unknown): VariableBinding {
  return fallback !== undefined ? { type: 'variable', key, fallback } : { type: 'variable', key };
}

export interface VariableBindingControlProps {
  field: ComponentFieldDefinition;
  currentValue: unknown;
  catalog: VariableCatalog;
  onBind: (key: string) => void;
  onRevert: () => void;
  onUpdateFallback?: (fallback: string) => void;
}

export const VariableBindingControl: React.FC<VariableBindingControlProps> = ({
  field,
  currentValue,
  catalog,
  onBind,
  onRevert,
  onUpdateFallback,
}) => {
  const compatibleEntries = getCompatibleCatalogEntries(field, catalog);

  if (isVariableBinding(currentValue)) {
    const bound = catalog.find((entry) => entry.key === currentValue.key);
    return (
      <div className="mt-1 flex flex-col gap-1.5 text-xs">
        <div
          data-testid={`bound-chip-${field.name}`}
          className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-800 shadow-2xs"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-[11px] font-mono font-bold text-blue-500 shrink-0">{"{x}"}</span>
            <span className="truncate font-mono text-[11px] font-semibold text-blue-900" title={currentValue.key}>
              {currentValue.key}
            </span>
            {bound?.sampleValue !== undefined && (
              <span className="text-[10px] text-blue-500 truncate" title={`Sample: ${JSON.stringify(bound.sampleValue)}`}>
                ({JSON.stringify(bound.sampleValue)})
              </span>
            )}
          </div>
          <button
            type="button"
            data-testid={`revert-${field.name}`}
            onClick={onRevert}
            title="Revert to static value"
            className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 px-2 py-0.5 rounded transition cursor-pointer shrink-0 border border-blue-200/60 bg-white"
          >
            Revert
          </button>
        </div>
        {onUpdateFallback && (
          <div className="flex items-center gap-1.5 pl-0.5 mt-0.5">
            <label className="text-[10px] text-slate-500 shrink-0 font-medium">Fallback:</label>
            <input
              type="text"
              data-testid={`binding-fallback-${field.name}`}
              placeholder="Fallback URL if empty..."
              value={typeof currentValue.fallback === 'string' ? currentValue.fallback : ''}
              onChange={(e) => onUpdateFallback(e.target.value)}
              className="w-full text-[11px] bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none transition shadow-2xs"
            />
          </div>
        )}
      </div>
    );
  }

  if (compatibleEntries.length === 0) {
    return null;
  }

  return (
    <div className="mt-1">
      <select
        data-testid={`bind-variable-${field.name}`}
        value=""
        onChange={(e) => {
          if (e.target.value) onBind(e.target.value);
        }}
        className="w-full text-xs bg-white text-slate-700 border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">Bind variable…</option>
        {compatibleEntries.map((entry) => (
          <option key={entry.key} value={entry.key}>
            {entry.label} ({JSON.stringify(entry.sampleValue)})
          </option>
        ))}
      </select>
    </div>
  );
};
