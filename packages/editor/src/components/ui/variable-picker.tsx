import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isVariableBinding, VariableBinding } from '@kubuild/schema';
import { ComponentFieldDefinition, primitiveTypeForField } from '@kubuild/components';
import {
  getVariableGroup,
  groupVariableCatalog,
  VariableCatalog,
  VariableCatalogGroup,
  VariableDefinition,
} from '@kubuild/core';

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

/**
 * Narrows catalog entries to those matching `query` (case-insensitive, against label, key,
 * description and group), then buckets them by group. Groups with no match are dropped.
 */
export function searchCatalogGroups(entries: VariableDefinition[], query: string): VariableCatalogGroup[] {
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? entries.filter((entry) =>
        [entry.label, entry.key, entry.description ?? '', getVariableGroup(entry)].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : entries;
  return groupVariableCatalog(matches);
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

  return <VariableSearchPicker fieldName={field.name} entries={compatibleEntries} onBind={onBind} />;
};

interface VariableSearchPickerProps {
  fieldName: string;
  entries: VariableDefinition[];
  onBind: (key: string) => void;
}

const VariableSearchPicker: React.FC<VariableSearchPickerProps> = ({ fieldName, entries, onBind }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => searchCatalogGroups(entries, query), [entries, query]);

  const close = () => {
    setIsOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  const pick = (key: string) => {
    onBind(key);
    close();
  };

  return (
    <div ref={containerRef} className="mt-1">
      <button
        type="button"
        data-testid={`bind-variable-${fieldName}`}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className="w-full text-left text-xs bg-white text-slate-500 border border-slate-300 rounded px-2 py-1.5 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
      >
        <span className="font-mono font-bold text-blue-500 mr-1.5">{"{x}"}</span>
        Bind variable…
      </button>

      {isOpen && (
        <div
          data-testid={`variable-search-${fieldName}`}
          className="mt-1 border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden"
        >
          <input
            type="text"
            autoFocus
            data-testid={`variable-search-input-${fieldName}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const first = groups[0]?.entries[0];
                if (first) pick(first.key);
              }
            }}
            placeholder="Search variables…"
            className="w-full text-xs px-2.5 py-1.5 border-b border-slate-200 text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto py-1">
            {groups.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-slate-400 italic text-center">No matching variables</div>
            ) : (
              groups.map(({ group, entries: groupEntries }) => (
                <div key={group} data-testid={`variable-group-${group}`}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {group}
                  </div>
                  {groupEntries.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      data-testid={`variable-option-${entry.key}`}
                      onClick={() => pick(entry.key)}
                      title={entry.description ?? entry.key}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1 text-left text-xs text-slate-700 hover:bg-blue-50 cursor-pointer"
                    >
                      <span className="truncate">{entry.label}</span>
                      <span className="truncate text-[10px] text-slate-400 max-w-[50%]">
                        {JSON.stringify(entry.sampleValue)}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
