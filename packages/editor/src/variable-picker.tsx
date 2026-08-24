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

export function toBindingValue(key: string): VariableBinding {
  return { type: 'variable', key };
}

export interface VariableBindingControlProps {
  field: ComponentFieldDefinition;
  currentValue: unknown;
  catalog: VariableCatalog;
  onBind: (key: string) => void;
  onRevert: () => void;
}

export const VariableBindingControl: React.FC<VariableBindingControlProps> = ({
  field,
  currentValue,
  catalog,
  onBind,
  onRevert,
}) => {
  const compatibleEntries = getCompatibleCatalogEntries(field, catalog);

  if (isVariableBinding(currentValue)) {
    const bound = catalog.find((entry) => entry.key === currentValue.key);
    return (
      <div className="flex items-center gap-2 mt-1 text-xs">
        <span
          data-testid={`bound-chip-${field.name}`}
          className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
        >
          bound to <code>{currentValue.key}</code>
          {bound ? ` (sample: ${JSON.stringify(bound.sampleValue)})` : ''}
        </span>
        <button
          type="button"
          data-testid={`revert-${field.name}`}
          onClick={onRevert}
          className="text-slate-500 hover:text-slate-700 underline"
        >
          Revert to static
        </button>
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
        className="w-full text-xs border border-slate-200 rounded px-2 py-1 text-slate-500"
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
