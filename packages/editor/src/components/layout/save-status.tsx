import React from 'react';
import { CircleAlert, CircleCheck, LoaderCircle, Save } from 'lucide-react';
import type { EditorSaveState } from './save-controller';

export interface SaveStatusButtonProps {
  saveState: EditorSaveState;
  isDirty: boolean;
  onSave: () => void;
  className?: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'Save failed';
}

/** Save button + `saving` / `saved` / `error` / unsaved-changes status (STORA-537). */
export const SaveStatusButton: React.FC<SaveStatusButtonProps> = ({
  saveState,
  isDirty,
  onSave,
  className,
}) => {
  const { status, error } = saveState;
  const saving = status === 'saving';

  let label: string;
  let icon: React.ReactNode;
  let tone: string;
  if (saving) {
    label = 'Saving…';
    icon = <LoaderCircle className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />;
    tone = 'text-slate-500';
  } else if (status === 'error') {
    label = 'Save failed';
    icon = <CircleAlert className="w-3.5 h-3.5" aria-hidden="true" />;
    tone = 'text-red-600';
  } else if (isDirty) {
    label = 'Unsaved changes';
    icon = <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />;
    tone = 'text-amber-700';
  } else if (status === 'saved') {
    label = 'Saved';
    icon = <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" />;
    tone = 'text-emerald-600';
  } else {
    label = 'No changes';
    icon = null;
    tone = 'text-slate-400';
  }

  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className || ''}`}>
      <span
        role="status"
        aria-live="polite"
        data-testid="save-status"
        data-status={saving ? 'saving' : status === 'error' ? 'error' : isDirty ? 'dirty' : status}
        title={status === 'error' ? errorMessage(error) : undefined}
        className={`hidden md:flex items-center gap-1 text-[11px] font-medium ${tone}`}
      >
        {icon}
        <span>{label}</span>
      </span>
      <button
        type="button"
        data-testid="toolbar-save"
        disabled={saving}
        onClick={onSave}
        title="Save (Ctrl/Cmd+S)"
        aria-label="Save (Ctrl/Cmd+S)"
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-blue-600 bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-60 transition shadow-xs cursor-pointer"
      >
        <Save className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Save</span>
      </button>
    </div>
  );
};
