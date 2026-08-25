import React, { useState } from 'react';
import { ComponentRegistry, ComponentCategory, ComponentDefinition } from '@kubuild/components';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';

export interface ComponentPanelProps {
  registry: ComponentRegistry;
  className?: string;
}

const CATEGORY_ORDER: ComponentCategory[] = ['layout', 'typography', 'media', 'interactive', 'data', 'custom'];

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: 'Layout',
  typography: 'Typography',
  media: 'Media',
  interactive: 'Interactive',
  data: 'Data',
  custom: 'Custom',
};

export const ComponentPanel: React.FC<ComponentPanelProps> = ({ registry, className }) => {
  const insertComponent = useEditorStore((s) => s.insertComponent);
  const [error, setError] = useState<string | null>(null);

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: registry.listByCategory(category),
  })).filter((group) => group.items.length > 0);

  const handleInsert = (definition: ComponentDefinition) => {
    const result = insertComponent(definition.type, registry);
    setError(result.success ? null : result.error ?? `Could not insert "${definition.label}".`);
  };

  return (
    <div className={`flex flex-col gap-4 p-3 overflow-y-auto ${className || ''}`}>
      {error && (
        <div
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1"
        >
          {error}
        </div>
      )}
      {groups.map(({ category, items }) => (
        <div key={category}>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[category]}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {items.map((definition) => (
              <button
                key={definition.type}
                type="button"
                onClick={() => handleInsert(definition)}
                title={definition.description}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 text-slate-700 text-xs font-medium text-left transition group shadow-sm"
              >
                <span className="shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors">
                  <ComponentIcon iconOrType={definition.icon ?? definition.type} size={15} />
                </span>
                <span className="truncate">{definition.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
