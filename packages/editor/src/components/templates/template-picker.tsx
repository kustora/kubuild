import React, { useMemo, useState } from 'react';
import type { SafeThumbnail, TemplateRecord } from '@kubuild/schema';
import { isSafeThumbnailUrl } from '@kubuild/schema';
import type { RuntimeContext } from '@kubuild/core';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { KubuildRenderer } from '@kubuild/renderer';
import { AlertTriangle, LayoutTemplate, X } from 'lucide-react';
import { getMissingTemplateComponents } from '../../utils/template-requirements';

/**
 * Resolves a template thumbnail to a displayable URL, or `null`. Unsafe URLs are dropped
 * (templates are untrusted input); asset references only resolve through `fallbackUrl`.
 */
export function resolveTemplateThumbnailUrl(thumbnail: SafeThumbnail | undefined): string | null {
  if (!thumbnail) return null;
  const url =
    typeof thumbnail === 'string'
      ? thumbnail
      : 'url' in thumbnail
        ? thumbnail.url
        : thumbnail.fallbackUrl;
  return url && isSafeThumbnailUrl(url) ? url : null;
}

export interface TemplatePickerProps {
  templates: TemplateRecord[];
  /** Used for the preview and the required-components check. Defaults to the built-in registry. */
  registry?: ComponentRegistry;
  /** Runtime context for the read-only preview (variables, assets). */
  context?: RuntimeContext;
  /** Fires when the user confirms a template. Never fires for templates that can't be applied. */
  onApply?: (template: TemplateRecord) => void;
  /** Fires when the highlighted template changes. */
  onSelect?: (template: TemplateRecord | null) => void;
  applyLabel?: string;
  /** Show the read-only `KubuildRenderer` preview of the highlighted template. Default: true */
  showPreview?: boolean;
  className?: string;
}

const ALL_CATEGORIES = '__all__';

/**
 * Template gallery (STORA-536): thumbnail cards with name, description, category and tags,
 * a category filter, and a read-only preview. Usable inside the editor (see
 * `TemplatePickerDialog`) or standalone in a host's "new page from template" flow.
 * Templates whose required components aren't registered are flagged and can't be applied.
 */
export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  templates,
  registry: propRegistry,
  context,
  onApply,
  onSelect,
  applyLabel = 'Use template',
  showPreview = true,
  className,
}) => {
  const registry = useMemo(() => propRegistry ?? createDefaultComponentRegistry(), [propRegistry]);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => set.add(t.category || 'general'));
    return Array.from(set);
  }, [templates]);

  const missingById = useMemo(() => {
    const map = new Map<string, string[]>();
    templates.forEach((t) => map.set(t.id, getMissingTemplateComponents(t, registry)));
    return map;
  }, [templates, registry]);

  const visible = useMemo(
    () =>
      category === ALL_CATEGORIES
        ? templates
        : templates.filter((t) => (t.category || 'general') === category),
    [templates, category],
  );

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const selectedMissing = selected ? (missingById.get(selected.id) ?? []) : [];
  const canApply = !!selected && !!selected.document && selectedMissing.length === 0;

  const select = (template: TemplateRecord) => {
    setSelectedId(template.id);
    onSelect?.(template);
  };

  return (
    <div
      data-testid="template-picker"
      className={`flex flex-col md:flex-row gap-3 min-h-0 text-slate-800 ${className || ''}`}
    >
      <div className="flex flex-col min-h-0 md:w-1/2">
        {categories.length > 1 && (
          <div
            role="group"
            aria-label="Template categories"
            className="flex items-center gap-1 pb-2 overflow-x-auto no-scrollbar shrink-0"
          >
            {[ALL_CATEGORIES, ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                data-testid="template-category"
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                className={`px-2 py-1 rounded-full text-[11px] font-medium capitalize shrink-0 transition cursor-pointer ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === ALL_CATEGORIES ? 'All' : cat}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">No templates available.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto min-h-0 pr-1">
            {visible.map((template) => {
              const missing = missingById.get(template.id) ?? [];
              const thumbUrl = resolveTemplateThumbnailUrl(template.thumbnail);
              const isSelected = template.id === selectedId;
              return (
                <button
                  key={template.id}
                  type="button"
                  data-testid="template-card"
                  data-template-id={template.id}
                  data-missing-components={missing.length > 0 ? 'true' : undefined}
                  aria-pressed={isSelected}
                  onClick={() => select(template)}
                  onDoubleClick={() => {
                    if (missing.length === 0 && template.document) onApply?.(template);
                  }}
                  className={`flex flex-col text-left rounded-lg border bg-white p-2 transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-blue-300'
                  } ${missing.length > 0 ? 'opacity-70' : ''}`}
                >
                  <div className="w-full aspect-[16/10] mb-2 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <LayoutTemplate className="w-6 h-6 text-slate-300" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {template.name}
                  </span>
                  {template.description && (
                    <span className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {template.description}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-1 rounded">
                      {template.category || 'general'}
                    </span>
                    {(template.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] text-slate-500 bg-slate-100 px-1 rounded"
                      >
                        {`#${tag}`}
                      </span>
                    ))}
                  </div>
                  {missing.length > 0 && (
                    <span
                      data-testid="template-missing-components"
                      className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1"
                    >
                      <AlertTriangle className="w-3 h-3 shrink-0 mt-px" aria-hidden="true" />
                      <span>{`Missing components: ${missing.join(', ')}`}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col min-h-0 md:w-1/2 gap-2">
        {showPreview && (
          <div
            data-testid="template-preview"
            className="flex-1 min-h-[200px] rounded-lg border border-slate-200 bg-slate-50 overflow-auto"
          >
            {selected?.document ? (
              // Read-only: no pointer events, and the renderer runs in editor mode so
              // page-load actions and tracking never fire from a preview.
              <div
                className="pointer-events-none select-none bg-white"
                style={{ zoom: 0.5 }}
                aria-hidden="true"
              >
                <KubuildRenderer
                  document={selected.document}
                  registry={registry}
                  context={context}
                  mode="editor"
                  viewport="desktop"
                  showToastContainer={false}
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 p-6 text-center">
                {selected
                  ? 'This template has no inline document to preview.'
                  : 'Select a template to preview it.'}
              </div>
            )}
          </div>
        )}

        {onApply && (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-slate-500 truncate">
              {selected
                ? selectedMissing.length > 0
                  ? 'Register the missing components to use this template.'
                  : !selected.document
                    ? 'No inline document — cannot be applied here.'
                    : selected.name
                : ''}
            </span>
            <button
              type="button"
              data-testid="template-apply"
              disabled={!canApply}
              onClick={() => selected && canApply && onApply(selected)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
            >
              {applyLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export interface TemplatePickerDialogProps extends TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

/** `TemplatePicker` in a modal, as opened from the editor toolbar. */
export const TemplatePickerDialog: React.FC<TemplatePickerDialogProps> = ({
  isOpen,
  onClose,
  title = 'Templates',
  className,
  ...pickerProps
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kubuild-template-dialog-title"
        data-testid="template-picker-dialog"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[85vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col ${className || ''}`}
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
          <h2
            id="kubuild-template-dialog-title"
            className="text-sm font-bold text-slate-900 flex items-center gap-2"
          >
            <LayoutTemplate className="w-4 h-4 text-blue-600" aria-hidden="true" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <TemplatePicker {...pickerProps} className="flex-1 p-4 overflow-hidden" />
      </div>
    </div>
  );
};
