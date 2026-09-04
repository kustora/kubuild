import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PageDocument,
  ActionPipeline,
  ActionStep,
  ActionStepType,
  ActionTriggerType,
} from '@kubuild/schema';
import { findNodeById } from '@kubuild/core';
import { useEditorStore } from './store';
import { ActionStepForm } from './action-step-form';
import {
  Zap,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Globe,
  Bell,
  Navigation,
  Maximize2,
  Minimize2,
  Database,
  RotateCcw,
  Copy,
  Check,
  X,
  Sparkles,
  ChevronRight,
  Sliders,
  Search,
  CopyPlus,
  GitBranch,
  AlertOctagon,
} from 'lucide-react';

export interface ActionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId?: string | null;
  initialTrigger?: ActionTriggerType;
  document?: PageDocument;
}

export interface TriggerMeta {
  type: ActionTriggerType;
  label: string;
  description: string;
  badge: string;
}

export const TRIGGER_OPTIONS: TriggerMeta[] = [
  {
    type: 'click',
    label: 'On Click',
    description: 'Triggered when the user clicks or taps this element',
    badge: 'Click',
  },
  {
    type: 'submit',
    label: 'On Submit',
    description: 'Triggered when the form is submitted (validation passes)',
    badge: 'Submit',
  },
  {
    type: 'change',
    label: 'On Change',
    description: 'Triggered when the input or select value changes',
    badge: 'Change',
  },
  {
    type: 'blur',
    label: 'On Blur',
    description: 'Triggered when this element loses focus',
    badge: 'Blur',
  },
  {
    type: 'focus',
    label: 'On Focus',
    description: 'Triggered when this element receives focus',
    badge: 'Focus',
  },
  {
    type: 'load',
    label: 'On Load',
    description: 'Triggered automatically when the component mounts',
    badge: 'Load',
  },
];

export interface StepTypeMeta {
  type: ActionStepType;
  label: string;
  description: string;
  category: 'network' | 'ui' | 'navigation' | 'state' | 'utility';
  icon: React.ComponentType<{ className?: string }>;
  defaultPayload: Record<string, unknown>;
}

export const STEP_TYPE_OPTIONS: StepTypeMeta[] = [
  {
    type: 'api_request',
    label: 'API / Webhook Request',
    description: 'Send an HTTP REST or Webhook request (GET, POST, PUT, DELETE)',
    category: 'network',
    icon: Globe,
    defaultPayload: {
      url: 'https://api.example.com/endpoint',
      method: 'POST',
    },
  },
  {
    type: 'show_toast',
    label: 'Show Toast Notification',
    description: 'Display a floating alert toast (Success, Error, Info, Warning)',
    category: 'ui',
    icon: Bell,
    defaultPayload: {
      message: 'Operation completed successfully!',
      type: 'success',
      duration: 3000,
    },
  },
  {
    type: 'navigate',
    label: 'Navigate / Redirect',
    description: 'Redirect to external URL, open new tab, or scroll to section',
    category: 'navigation',
    icon: Navigation,
    defaultPayload: {
      url: 'https://example.com',
      target: '_self',
    },
  },
  {
    type: 'open_modal',
    label: 'Open Modal Dialog',
    description: 'Open and reveal a modal overlay component by Node ID',
    category: 'ui',
    icon: Maximize2,
    defaultPayload: {
      modalNodeId: 'modal-1',
    },
  },
  {
    type: 'close_modal',
    label: 'Close Modal Dialog',
    description: 'Dismiss an active modal overlay component',
    category: 'ui',
    icon: Minimize2,
    defaultPayload: {
      modalNodeId: 'modal-1',
    },
  },
  {
    type: 'set_state',
    label: 'Set State Variable',
    description: 'Save or update dynamic runtime/session variables',
    category: 'state',
    icon: Database,
    defaultPayload: {
      key: 'user_selection',
      value: '',
      scope: 'runtime',
    },
  },
  {
    type: 'reset_form',
    label: 'Reset Form',
    description: 'Clear all input fields and errors in the target form',
    category: 'state',
    icon: RotateCcw,
    defaultPayload: {},
  },
  {
    type: 'copy_clipboard',
    label: 'Copy to Clipboard',
    description: 'Copy static text or resolved dynamic variable to clipboard',
    category: 'utility',
    icon: Copy,
    defaultPayload: {
      text: 'Sample text to copy',
      notify: true,
      toastMessage: 'Copied to clipboard!',
    },
  },
  {
    type: 'custom_event',
    label: 'Dispatch Custom Event',
    description: 'Emit a custom DOM / Window event for third-party scripts',
    category: 'utility',
    icon: Zap,
    defaultPayload: {
      eventName: 'custom:element-action',
      bubbles: true,
    },
  },
];

export function getStepTypeMeta(type: ActionStepType): StepTypeMeta {
  const found = STEP_TYPE_OPTIONS.find((s) => s.type === type);
  if (found) return found;
  return {
    type,
    label: type.replace('_', ' ').toUpperCase(),
    description: 'Custom action operation',
    category: 'utility',
    icon: Zap,
    defaultPayload: {},
  };
}

export function getCategoryBadgeClass(category: 'network' | 'ui' | 'navigation' | 'state' | 'utility'): string {
  switch (category) {
    case 'network':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'ui':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'navigation':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'state':
      return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
    case 'utility':
    default:
      return 'bg-slate-800 text-slate-300 border-slate-700';
  }
}

export function formatStepSummary(step: ActionStep): string {
  const payload = step.payload || {};
  switch (step.type) {
    case 'api_request': {
      const method = (payload.method as string) || 'GET';
      const url = (payload.url as string) || '';
      return `${method} ${url}`;
    }
    case 'show_toast': {
      const type = (payload.type as string) || 'info';
      const msg = (payload.message as string) || '';
      return `[${type.toUpperCase()}] "${msg}"`;
    }
    case 'navigate': {
      const url = (payload.url as string) || '';
      const target = payload.target === '_blank' ? '(New tab)' : '';
      return `Go to ${url} ${target}`.trim();
    }
    case 'open_modal': {
      const targetId = (payload.modalNodeId as string) || (payload.modalId as string) || '';
      return `Open Modal #${targetId}`;
    }
    case 'close_modal': {
      const targetId = (payload.modalNodeId as string) || (payload.modalId as string) || '';
      return `Close Modal #${targetId}`;
    }
    case 'set_state': {
      const key = (payload.key as string) || '';
      return `Set ${key}`;
    }
    case 'reset_form': {
      const formId = (payload.formId as string) || '';
      return formId ? `Reset #${formId}` : 'Reset Form';
    }
    case 'copy_clipboard': {
      const text = (payload.text as string) || '';
      return `Copy "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`;
    }
    case 'custom_event': {
      const eventName = (payload.eventName as string) || '';
      return `Emit "${eventName}"`;
    }
    default:
      return JSON.stringify(payload);
  }
}

export const ActionBuilderModal: React.FC<ActionBuilderModalProps> = ({
  isOpen,
  onClose,
  nodeId: propNodeId,
  initialTrigger = 'click',
  document: customDoc,
}) => {
  const storeState = useEditorStore((s) => s);
  const document = customDoc ?? storeState.document;
  const activeNodeId = propNodeId ?? storeState.selectedNodeId;
  const node = activeNodeId ? findNodeById(document.document, activeNodeId) : null;
  const updateNodeActions = storeState.updateNodeActions;

  // Selected trigger tab
  const [selectedTrigger, setSelectedTrigger] = useState<ActionTriggerType>(initialTrigger);
  const [isAddStepMenuOpen, setIsAddStepMenuOpen] = useState<boolean>(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [stepSearchQuery, setStepSearchQuery] = useState<string>('');

  const filteredStepTypes = useMemo(() => {
    if (!stepSearchQuery.trim()) return STEP_TYPE_OPTIONS;
    const q = stepSearchQuery.toLowerCase();
    return STEP_TYPE_OPTIONS.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.description.toLowerCase().includes(q) ||
        opt.type.toLowerCase().includes(q) ||
        opt.category.toLowerCase().includes(q),
    );
  }, [stepSearchQuery]);

  // Synchronize initial trigger
  useEffect(() => {
    if (initialTrigger) {
      setSelectedTrigger(initialTrigger);
    }
  }, [initialTrigger]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract action pipelines from active node
  const pipelines: ActionPipeline[] = useMemo(() => {
    if (!node || !Array.isArray(node.actions)) return [];
    return node.actions;
  }, [node]);

  // Find or determine active pipeline for currently selected trigger
  const currentPipeline = useMemo(() => {
    return pipelines.find((p) => p.trigger === selectedTrigger) || null;
  }, [pipelines, selectedTrigger]);

  // Count active triggers
  const triggerPipelineMap = useMemo(() => {
    const map = new Map<ActionTriggerType, ActionPipeline>();
    for (const p of pipelines) {
      map.set(p.trigger, p);
    }
    return map;
  }, [pipelines]);

  // Helper to commit new pipelines array to the node
  const commitPipelines = useCallback(
    (newPipelines: ActionPipeline[]) => {
      if (!node) return;
      updateNodeActions(node.id, newPipelines.length > 0 ? newPipelines : null);
    },
    [node, updateNodeActions],
  );

  // Add new step to current trigger's pipeline
  const handleAddStep = (stepType: ActionStepType) => {
    if (!node) return;
    const typeMeta = getStepTypeMeta(stepType);
    const newStepId = `step-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const newStep: ActionStep = {
      id: newStepId,
      type: stepType,
      label: typeMeta.label,
      payload: { ...typeMeta.defaultPayload },
    };

    let updatedPipelines: ActionPipeline[];

    if (currentPipeline) {
      // Append step to existing pipeline
      updatedPipelines = pipelines.map((p) => {
        if (p.id === currentPipeline.id) {
          return {
            ...p,
            steps: [...p.steps, newStep],
          };
        }
        return p;
      });
    } else {
      // Create new pipeline with this step
      const newPipeline: ActionPipeline = {
        id: `pipeline-${selectedTrigger}-${Date.now().toString(36)}`,
        trigger: selectedTrigger,
        label: `${TRIGGER_OPTIONS.find((t) => t.type === selectedTrigger)?.label || selectedTrigger} Pipeline`,
        enabled: true,
        steps: [newStep],
      };
      updatedPipelines = [...pipelines, newPipeline];
    }

    commitPipelines(updatedPipelines);
    setIsAddStepMenuOpen(false);
    setEditingStepId(newStepId);
  };

  // Remove a step
  const handleRemoveStep = (stepId: string) => {
    if (!currentPipeline) return;
    const nextSteps = currentPipeline.steps.filter((s) => s.id !== stepId);
    let updatedPipelines: ActionPipeline[];
    if (nextSteps.length === 0) {
      // If no steps left, remove the pipeline entirely
      updatedPipelines = pipelines.filter((p) => p.id !== currentPipeline.id);
    } else {
      updatedPipelines = pipelines.map((p) => {
        if (p.id === currentPipeline.id) {
          return { ...p, steps: nextSteps };
        }
        return p;
      });
    }
    commitPipelines(updatedPipelines);
    if (editingStepId === stepId) {
      setEditingStepId(null);
    }
  };

  // Reorder steps (move up / down)
  const handleMoveStep = (stepIndex: number, direction: 'up' | 'down') => {
    if (!currentPipeline) return;
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentPipeline.steps.length) return;

    const newSteps = [...currentPipeline.steps];
    const [moved] = newSteps.splice(stepIndex, 1);
    newSteps.splice(targetIndex, 0, moved);

    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return { ...p, steps: newSteps };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Toggle pipeline enabled
  const handleTogglePipelineEnabled = () => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return { ...p, enabled: p.enabled === false ? true : false };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Update pipeline preventDuplicate
  const handleTogglePreventDuplicate = () => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return { ...p, preventDuplicate: !p.preventDuplicate };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Update step payload
  const handleUpdateStepPayload = (stepId: string, payload: Record<string, unknown>) => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return {
          ...p,
          steps: p.steps.map((s) => (s.id === stepId ? { ...s, payload } : s)),
        };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Update step metadata (label, timeout, continueOnError)
  const handleUpdateStepMeta = (
    stepId: string,
    meta: { label?: string; timeout?: number; continueOnError?: boolean },
  ) => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return {
          ...p,
          steps: p.steps.map((s) => (s.id === stepId ? { ...s, ...meta } : s)),
        };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Update step branching (onSuccess, onError)
  const handleUpdateStepBranches = (
    stepId: string,
    branches: { onSuccess?: ActionStep[]; onError?: ActionStep[] },
  ) => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.map((p) => {
      if (p.id === currentPipeline.id) {
        return {
          ...p,
          steps: p.steps.map((s) => {
            if (s.id === stepId) {
              const updated = { ...s };
              if (branches.onSuccess !== undefined) {
                if (branches.onSuccess.length === 0) delete updated.onSuccess;
                else updated.onSuccess = branches.onSuccess;
              }
              if (branches.onError !== undefined) {
                if (branches.onError.length === 0) delete updated.onError;
                else updated.onError = branches.onError;
              }
              return updated;
            }
            return s;
          }),
        };
      }
      return p;
    });
    commitPipelines(updatedPipelines);
  };

  // Delete entire current pipeline
  const handleDeletePipeline = () => {
    if (!currentPipeline) return;
    const updatedPipelines = pipelines.filter((p) => p.id !== currentPipeline.id);
    commitPipelines(updatedPipelines);
    setEditingStepId(null);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-builder-title"
      data-testid="action-builder-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-semibold shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="action-builder-title" className="text-base font-semibold text-white tracking-tight">
                  Visual Action Builder
                </h2>
                {node && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {`<${node.type}> #${node.id}`}
                  </span>
                )}
                {pipelines.length > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {`${pipelines.reduce((sum, p) => sum + p.steps.length, 0)} Total Steps`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Configure event triggers, asynchronous workflows, and UI feedback for this element
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close modal (Esc)"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Trigger Selector Bar */}
        <div className="flex items-center px-6 py-2.5 border-b border-slate-800 bg-slate-900/60 shrink-0 overflow-x-auto gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-1.5 min-w-max">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Event Trigger:</span>
            </span>
            {TRIGGER_OPTIONS.map((trig) => {
              const activeForTrig = triggerPipelineMap.get(trig.type);
              const isSelected = selectedTrigger === trig.type;
              const stepCount = activeForTrig?.steps.length ?? 0;

              return (
                <button
                  key={trig.type}
                  type="button"
                  data-testid={`trigger-tab-${trig.type}`}
                  onClick={() => {
                    setSelectedTrigger(trig.type);
                    setIsAddStepMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-400/30'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>{trig.label}</span>
                  {stepCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isSelected
                          ? 'bg-blue-800 text-blue-100'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {stepCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area: Action Timeline & Step List */}
        <div className="flex-1 min-h-0 bg-slate-950 overflow-y-auto p-6 select-text flex flex-col gap-4">
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
            {/* Active Trigger Info Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800/90 text-xs text-slate-300">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/30 shrink-0">
                  {selectedTrigger.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {TRIGGER_OPTIONS.find((t) => t.type === selectedTrigger)?.label}
                    </span>
                    {currentPipeline ? (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <Check className="w-3 h-3" />
                        <span>{`${currentPipeline.steps.length} step(s) configured`}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">No action steps yet</span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px] truncate block mt-0.5">
                    {TRIGGER_OPTIONS.find((t) => t.type === selectedTrigger)?.description}
                  </span>
                </div>
              </div>

              {currentPipeline && (
                <div className="flex items-center gap-3.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800 text-xs text-slate-300">
                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition select-none">
                    <input
                      type="checkbox"
                      checked={currentPipeline.enabled !== false}
                      onChange={handleTogglePipelineEnabled}
                      className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Active</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(currentPipeline.preventDuplicate)}
                      onChange={handleTogglePreventDuplicate}
                      className="rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-0 accent-blue-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Prevent Double Clicks</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleDeletePipeline}
                    title="Delete this trigger pipeline"
                    className="p-1 px-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700/60 hover:border-red-500/30 transition flex items-center gap-1 cursor-pointer ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px]">Clear</span>
                  </button>
                </div>
              )}
            </div>

            {/* Timeline View */}
            {currentPipeline && currentPipeline.steps.length > 0 ? (
              <div className="flex flex-col gap-3 relative before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-0.5 before:bg-slate-800">
                {currentPipeline.steps.map((step, idx) => {
                  const typeMeta = getStepTypeMeta(step.type);
                  const Icon = typeMeta.icon;
                  const summary = formatStepSummary(step);
                  const isFirst = idx === 0;
                  const isLast = idx === currentPipeline.steps.length - 1;
                  const isExpanded = editingStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      data-testid={`action-step-card-${step.id}`}
                      className={`relative flex flex-col p-4 rounded-xl bg-slate-900/90 border transition shadow-sm ${
                        isExpanded
                          ? 'border-blue-500/80 ring-1 ring-blue-500/40 bg-slate-900'
                          : 'border-slate-800 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Step Indicator Node */}
                        <div
                          onClick={() => setEditingStepId(isExpanded ? null : step.id)}
                          className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 shadow-sm cursor-pointer transition ${
                            isExpanded
                              ? 'bg-blue-600 border-2 border-blue-300 text-white'
                              : 'bg-slate-800 border-2 border-blue-500 text-blue-400'
                          }`}
                        >
                          {idx + 1}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div
                              onClick={() => setEditingStepId(isExpanded ? null : step.id)}
                              className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 flex-wrap"
                            >
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${getCategoryBadgeClass(typeMeta.category)}`}>
                                <Icon className="w-3 h-3" />
                                <span>{typeMeta.label}</span>
                              </span>
                              {step.label && (
                                <span className="text-xs font-medium text-slate-200 truncate">
                                  {step.label}
                                </span>
                              )}

                              {/* Status Badges */}
                              {step.continueOnError && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  Continues on Error
                                </span>
                              )}
                              {(Boolean(step.onSuccess?.length) || Boolean(step.onError?.length)) && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <GitBranch className="w-2.5 h-2.5" />
                                  <span>{`Branches (${(step.onSuccess?.length || 0) + (step.onError?.length || 0)})`}</span>
                                </span>
                              )}
                              {step.condition && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                  Conditional
                                </span>
                              )}
                              {step.timeout && step.timeout > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                  {`${step.timeout}ms`}
                                </span>
                              )}
                            </div>

                            {/* Reorder, Configure and Delete Controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                data-testid={`toggle-edit-step-${step.id}`}
                                onClick={() => setEditingStepId(isExpanded ? null : step.id)}
                                title={isExpanded ? 'Collapse config' : 'Edit step parameters'}
                                className={`px-2 py-1 text-[11px] font-medium rounded flex items-center gap-1 transition cursor-pointer ${
                                  isExpanded
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                                }`}
                              >
                                <Sliders className="w-3 h-3" />
                                <span>{isExpanded ? 'Collapse' : 'Configure'}</span>
                              </button>

                              <button
                                type="button"
                                disabled={isFirst}
                                onClick={() => handleMoveStep(idx, 'up')}
                                title="Move step up"
                                aria-label="Move step up"
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isLast}
                                onClick={() => handleMoveStep(idx, 'down')}
                                title="Move step down"
                                aria-label="Move step down"
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveStep(step.id)}
                                title="Delete step"
                                aria-label="Delete step"
                                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition ml-1 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Summary / Description */}
                          <div
                            onClick={() => setEditingStepId(isExpanded ? null : step.id)}
                            className="text-xs font-mono text-slate-400 bg-slate-950/70 rounded px-2.5 py-1.5 border border-slate-800/80 truncate cursor-pointer hover:border-slate-700 transition"
                          >
                            {summary}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Action Step Configuration Form */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-top-1 duration-150">
                          <ActionStepForm
                            step={step}
                            document={document}
                            onUpdatePayload={(newPayload) =>
                              handleUpdateStepPayload(step.id, newPayload)
                            }
                            onUpdateMeta={(meta) => handleUpdateStepMeta(step.id, meta)}
                            onUpdateBranches={(branches) =>
                              handleUpdateStepBranches(step.id, branches)
                            }
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mb-1">
                  <Zap className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-sm font-semibold text-slate-200">
                  No Action Steps for {TRIGGER_OPTIONS.find((t) => t.type === selectedTrigger)?.label}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Add steps like API requests, toast feedback, modal triggers, or navigation to make this element interactive.
                </p>
              </div>
            )}

            {/* Add Action Step Controls */}
            <div className="relative mt-2">
              <button
                type="button"
                data-testid="add-action-step-btn"
                onClick={() => {
                  setIsAddStepMenuOpen(!isAddStepMenuOpen);
                  setStepSearchQuery('');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 font-medium text-xs transition cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Action Step</span>
              </button>

              {/* Step Type Dropdown Menu with Search */}
              {isAddStepMenuOpen && (
                <div
                  data-testid="step-type-menu"
                  className="absolute left-0 right-0 top-full mt-2 z-20 flex flex-col p-2 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 gap-2 max-h-80 overflow-y-auto"
                >
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950 rounded-lg border border-slate-800 text-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      data-testid="step-type-search-input"
                      value={stepSearchQuery}
                      onChange={(e) => setStepSearchQuery(e.target.value)}
                      placeholder="Search action types (e.g. toast, api, modal)..."
                      style={{ color: '#f1f5f9' }}
                      className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-xs"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {filteredStepTypes.map((option) => {
                      const Icon = option.icon;
                      const catBadge = getCategoryBadgeClass(option.category);
                      return (
                        <button
                          key={option.type}
                          type="button"
                          data-testid={`add-step-option-${option.type}`}
                          onClick={() => {
                            handleAddStep(option.type);
                            setStepSearchQuery('');
                          }}
                          className="flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-slate-800/90 transition text-slate-200 hover:text-white cursor-pointer group border border-slate-800 hover:border-slate-700"
                        >
                          <div className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 transition ${catBadge}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-100 group-hover:text-blue-300 flex items-center gap-1.5">
                              <span>{option.label}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 leading-tight truncate">
                              {option.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer info & Done button */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-900 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-3">
            <span>
              Target: <strong className="text-slate-200">#{node?.id || activeNodeId}</strong>
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-700" />
            <span>
              Active Triggers:{' '}
              <strong className="text-slate-200">{pipelines.length}</strong>
            </span>
          </div>

          <button
            type="button"
            data-testid="action-builder-done-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
