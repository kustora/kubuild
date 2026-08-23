import React, { useState } from 'react';
import { ComponentRegistry, ComponentCategory, ComponentDefinition } from '@kubuild/components';
import { useEditorStore } from './store';

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
                className="text-xs px-2 py-2 rounded border border-slate-200 bg-white hover:border-blue-400 hover:text-blue-600 text-slate-700 text-left transition"
              >
                {definition.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
