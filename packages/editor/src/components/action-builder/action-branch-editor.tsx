import React, { useState } from 'react';
import {
  ActionStep,
  ActionStepType,
  PageDocument,
} from '@kubuild/schema';
import {
  CheckCircle2,
  AlertOctagon,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sliders,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import {
  STEP_TYPE_OPTIONS,
  getStepTypeMeta,
  formatStepSummary,
} from './action-builder-modal';
import { ActionStepForm } from './action-step-form';

export interface ActionBranchEditorProps {
  parentStep: ActionStep;
  document?: PageDocument;
  onUpdateSuccessSteps: (steps: ActionStep[]) => void;
  onUpdateErrorSteps: (steps: ActionStep[]) => void;
  className?: string;
}

export interface BranchLaneProps {
  branchType: 'success' | 'error';
  steps: ActionStep[];
  document?: PageDocument;
  onUpdateSteps: (steps: ActionStep[]) => void;
}

export const BranchLane: React.FC<BranchLaneProps> = ({
  branchType,
  steps,
  document,
  onUpdateSteps,
}) => {
  const isSuccess = branchType === 'success';
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [editingSubStepId, setEditingSubStepId] = useState<string | null>(null);

  const theme = isSuccess
    ? {
        title: 'On Success (HTTP 2xx)',
        description: 'Run these action steps when the request completes successfully',
        badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        cardBorder: 'border-emerald-900/60 hover:border-emerald-700/60',
        activeBorder: 'border-emerald-500 ring-1 ring-emerald-500/40',
        lineColor: 'border-emerald-500/30',
        stepNumberBg: 'bg-emerald-950 border-emerald-500/80 text-emerald-300',
        btnBg: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        icon: CheckCircle2,
        prefix: 'S',
      }
    : {
        title: 'On Error (HTTP 4xx / 5xx / Network Failure)',
        description: 'Run these action steps if the request fails or times out',
        badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        cardBorder: 'border-rose-900/60 hover:border-rose-700/60',
        activeBorder: 'border-rose-500 ring-1 ring-rose-500/40',
        lineColor: 'border-rose-500/30',
        stepNumberBg: 'bg-rose-950 border-rose-500/80 text-rose-300',
        btnBg: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30',
        icon: AlertOctagon,
        prefix: 'E',
      };

  const IconComponent = theme.icon;

  const handleAddStep = (type: ActionStepType) => {
    const meta = getStepTypeMeta(type);
    const newStepId = `substep-${branchType}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Customize default payload for success/error presets
    const payload = { ...meta.defaultPayload };
    if (type === 'show_toast') {
      payload.type = isSuccess ? 'success' : 'error';
      payload.variant = isSuccess ? 'success' : 'error';
      payload.message = isSuccess
        ? 'Request completed successfully!'
        : 'Request failed. Please try again.';
    }

    const newStep: ActionStep = {
      id: newStepId,
      type,
      label: `${meta.label} (${isSuccess ? 'Success' : 'Error'})`,
      payload,
    };

    const nextSteps = [...steps, newStep];
    onUpdateSteps(nextSteps);
    setIsAddMenuOpen(false);
    setEditingSubStepId(newStepId);
  };

  const handleRemoveStep = (stepId: string) => {
    const nextSteps = steps.filter((s) => s.id !== stepId);
    onUpdateSteps(nextSteps);
    if (editingSubStepId === stepId) {
      setEditingSubStepId(null);
    }
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const nextSteps = [...steps];
    const [moved] = nextSteps.splice(index, 1);
    nextSteps.splice(targetIndex, 0, moved);
    onUpdateSteps(nextSteps);
  };

  const handleUpdateSubStepPayload = (stepId: string, payload: Record<string, unknown>) => {
    const nextSteps = steps.map((s) => (s.id === stepId ? { ...s, payload } : s));
    onUpdateSteps(nextSteps);
  };

  const handleUpdateSubStepMeta = (
    stepId: string,
    meta: { label?: string; timeout?: number; continueOnError?: boolean },
  ) => {
    const nextSteps = steps.map((s) => (s.id === stepId ? { ...s, ...meta } : s));
    onUpdateSteps(nextSteps);
  };

  return (
    <div
      data-testid={`branch-lane-${branchType}`}
      className={`flex flex-col gap-3 p-3.5 rounded-xl bg-slate-950/70 border ${
        isSuccess ? 'border-emerald-950/80' : 'border-rose-950/80'
      }`}
    >
      {/* Branch Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md border ${theme.badgeBg}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">{theme.title}</span>
            <span className="text-[10px] text-slate-400 block">{theme.description}</span>
          </div>
        </div>

        {/* Add Step Button */}
        <div className="relative">
          <button
            type="button"
            data-testid={`add-${branchType}-step-btn`}
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className={`px-2 py-1 text-[11px] font-medium border rounded-md flex items-center gap-1 transition cursor-pointer ${theme.btnBg}`}
          >
            <Plus className="w-3 h-3" />
            <span>Add Step</span>
          </button>

          {isAddMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Action Step Type
              </div>
              {STEP_TYPE_OPTIONS.map((opt) => {
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleAddStep(opt.type)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    <OptIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[10px] text-slate-400 truncate">{opt.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sub-steps List */}
      {steps.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic py-3 text-center border border-dashed border-slate-800/80 rounded-lg bg-slate-900/20">
          {`No ${branchType} action steps configured yet`}
        </div>
      ) : (
        <div className={`flex flex-col gap-2.5 pl-2 relative border-l-2 ${theme.lineColor} ml-2`}>
          {steps.map((subStep, idx) => {
            const meta = getStepTypeMeta(subStep.type);
            const SubIcon = meta.icon;
            const summary = formatStepSummary(subStep);
            const isFirst = idx === 0;
            const isLast = idx === steps.length - 1;
            const isEditing = editingSubStepId === subStep.id;

            return (
              <div
                key={subStep.id}
                data-testid={`branch-step-card-${subStep.id}`}
                className={`flex flex-col p-3 rounded-lg bg-slate-900 border transition shadow-xs ${
                  isEditing ? theme.activeBorder : theme.cardBorder
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`w-5 h-5 rounded-full border text-[10px] font-mono font-bold flex items-center justify-center shrink-0 ${theme.stepNumberBg}`}
                    >
                      {`${theme.prefix}${idx + 1}`}
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <SubIcon className="w-2.5 h-2.5" />
                      <span>{meta.label}</span>
                    </span>
                    <span className="text-xs text-slate-200 truncate font-medium">
                      {subStep.label || summary}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      data-testid={`toggle-edit-substep-${subStep.id}`}
                      onClick={() => setEditingSubStepId(isEditing ? null : subStep.id)}
                      className={`p-1 rounded text-xs transition cursor-pointer ${
                        isEditing
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={isEditing ? 'Collapse' : 'Configure parameters'}
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveStep(idx, 'up')}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveStep(idx, 'down')}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(subStep.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      title="Delete step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Summary bar */}
                <div className="text-[11px] font-mono text-slate-400 bg-slate-950/60 rounded px-2 py-1 mt-1.5 truncate border border-slate-800/80">
                  {summary}
                </div>

                {/* Sub-step configuration form */}
                {isEditing && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <ActionStepForm
                      step={subStep}
                      document={document}
                      hideBranches={true}
                      onUpdatePayload={(newPayload) =>
                        handleUpdateSubStepPayload(subStep.id, newPayload)
                      }
                      onUpdateMeta={(meta) => handleUpdateSubStepMeta(subStep.id, meta)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ActionBranchEditor: React.FC<ActionBranchEditorProps> = ({
  parentStep,
  document,
  onUpdateSuccessSteps,
  onUpdateErrorSteps,
  className = '',
}) => {
  const successSteps = parentStep.onSuccess || [];
  const errorSteps = parentStep.onError || [];

  return (
    <div
      data-testid={`action-branch-editor-${parentStep.id}`}
      className={`flex flex-col gap-3.5 p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner ${className}`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <GitBranch className="w-4 h-4 text-blue-400" />
        <span>Response Branching Pipeline (Success / Error Execution)</span>
      </div>

      <div className="flex flex-col gap-3">
        {/* On Success Branch */}
        <BranchLane
          branchType="success"
          steps={successSteps}
          document={document}
          onUpdateSteps={onUpdateSuccessSteps}
        />

        {/* On Error Branch */}
        <BranchLane
          branchType="error"
          steps={errorSteps}
          document={document}
          onUpdateSteps={onUpdateErrorSteps}
        />
      </div>
    </div>
  );
};
