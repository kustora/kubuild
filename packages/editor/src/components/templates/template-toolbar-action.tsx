import React, { useCallback, useState } from 'react';
import type { PageDocument, TemplateRecord } from '@kubuild/schema';
import type { RuntimeContext } from '@kubuild/core';
import type { ComponentRegistry } from '@kubuild/components';
import { LayoutTemplate } from 'lucide-react';
import { useEditorStore } from '../../store';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { TemplatePickerDialog } from './template-picker';

export interface TemplateToolbarActionProps {
  templates: TemplateRecord[];
  registry: ComponentRegistry;
  context?: RuntimeContext;
  /** Fires after a template replaced the page (the replacement is undoable). */
  onApplyTemplate?: (template: TemplateRecord, doc: PageDocument) => void;
}

/**
 * Toolbar "Templates" button (STORA-536): opens the picker, confirms with an editor dialog,
 * then replaces the page through `applyTemplate` — a single undoable history entry.
 */
export const TemplateToolbarAction: React.FC<TemplateToolbarActionProps> = ({
  templates,
  registry,
  context,
  onApplyTemplate,
}) => {
  const applyTemplate = useEditorStore((s) => s.applyTemplate);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pending, setPending] = useState<TemplateRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelConfirm = useCallback(() => setPending(null), []);

  const confirmApply = () => {
    if (!pending) return;
    const result = applyTemplate(pending, { registry });
    if (result.success && result.document) {
      setError(null);
      setIsPickerOpen(false);
      onApplyTemplate?.(pending, result.document);
    } else {
      setError(result.error ?? 'Could not apply template.');
    }
    setPending(null);
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 flex items-center gap-1"
        >
          <span className="max-w-[240px] truncate" title={error}>
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 font-bold ml-1"
          >
            ×
          </button>
        </div>
      )}
      <button
        type="button"
        data-testid="toolbar-templates"
        title="Replace page with a template"
        onClick={() => setIsPickerOpen(true)}
        className="flex items-center gap-1.5 text-xs px-2 sm:px-2.5 py-1 rounded border border-slate-200 bg-white hover:border-blue-500 hover:text-blue-600 font-medium text-slate-700 transition cursor-pointer"
      >
        <LayoutTemplate className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
        <span className="hidden sm:inline">Templates</span>
      </button>

      <TemplatePickerDialog
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        title="Replace with template"
        templates={templates}
        registry={registry}
        context={context}
        applyLabel="Replace page"
        onApply={(template) => setPending(template)}
      />

      <ConfirmDialog
        isOpen={!!pending}
        title="Replace the current page?"
        description={
          <>
            The page content will be replaced with <strong>{pending?.name}</strong>. You can revert
            this with Undo (Ctrl/Cmd+Z).
          </>
        }
        confirmLabel="Replace page"
        danger
        onConfirm={confirmApply}
        onCancel={cancelConfirm}
      />
    </>
  );
};
