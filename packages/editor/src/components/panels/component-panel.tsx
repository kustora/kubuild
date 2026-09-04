import React, { useState } from 'react';
import { ComponentRegistry, ComponentCategory, ComponentDefinition } from '@kubuild/components';
import { useEditorStore } from './store';
import { ComponentIcon } from './icons';

export interface ComponentPanelProps {
  registry: ComponentRegistry;
  className?: string;
}

const CATEGORY_ORDER: ComponentCategory[] = [
  'layout',
  'typography',
  'media',
  'form',
  'interactive',
  'data',
  'custom',
];

const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  layout: 'Layout',
  typography: 'Typography',
  media: 'Media',
  form: 'Forms',
  interactive: 'Interactive',
  data: 'Data',
  custom: 'Custom',
};

export const ComponentPanel: React.FC<ComponentPanelProps> = ({ registry, className }) => {
  const insertComponent = useEditorStore((s) => s.insertComponent);
  const setDragPayload = useEditorStore((s) => s.setDragPayload);
  const [error, setError] = useState<string | null>(null);

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: registry.listByCategory(category),
  })).filter((group) => group.items.length > 0);

  const handleInsert = (definition: ComponentDefinition) => {
    const result = insertComponent(definition.type, registry);
    setError(result.success ? null : (result.error ?? `Could not insert "${definition.label}".`));
  };

  const handleDragStart = (e: React.DragEvent, definition: ComponentDefinition) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', `component:${definition.type}`);
    e.dataTransfer.setData('application/kubuild-drag-type', 'component');
    e.dataTransfer.setData('application/kubuild-component-type', definition.type);
    setDragPayload({ type: 'component', componentType: definition.type });
  };

  const handleDragEnd = () => {
    setDragPayload(null);
  };

  return (
    <div className={`flex flex-col gap-4 p-3 overflow-y-auto h-full min-h-0 ${className || ''}`}>
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
                draggable={true}
                onDragStart={(e) => handleDragStart(e, definition)}
                onDragEnd={handleDragEnd}
                onClick={() => handleInsert(definition)}
                data-testid={`component-item-${definition.type}`}
                title={
                  definition.description || `Click to insert or drag to canvas: ${definition.label}`
                }
                className="flex flex-col items-center justify-center p-2.5 min-h-[74px] rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 hover:shadow text-slate-700 transition group cursor-grab active:cursor-grabbing text-center select-none"
              >
                <span className="mb-1.5 text-slate-500 group-hover:text-blue-600 transition-colors pointer-events-none">
                  <ComponentIcon iconOrType={definition.icon ?? definition.type} size={22} />
                </span>
                <span className="text-[11px] font-medium text-slate-700 group-hover:text-blue-600 text-center leading-tight break-words w-full pointer-events-none">
                  {definition.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
