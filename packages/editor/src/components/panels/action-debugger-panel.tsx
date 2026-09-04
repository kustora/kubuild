import React, { useState } from 'react';
import { useEditorStore, ActionLogEntry, LiveFormState } from './store';
import {
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Sliders,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  FileCode,
} from 'lucide-react';

export interface ActionDebuggerPanelProps {
  className?: string;
  onClose?: () => void;
  onResetForm?: () => void;
  formState?: LiveFormState | null;
  logs?: ActionLogEntry[];
}

export const ActionDebuggerPanel: React.FC<ActionDebuggerPanelProps> = ({
  className,
  onClose,
  onResetForm,
  formState: propFormState,
  logs: propLogs,
}) => {
  const storeLogs = useEditorStore((s) => s.actionLogs);
  const clearActionLogs = useEditorStore((s) => s.clearActionLogs);
  const storeLiveFormState = useEditorStore((s) => s.liveFormState);
  const setLiveFormState = useEditorStore((s) => s.setLiveFormState);
  const setActionDebuggerOpen = useEditorStore((s) => s.setActionDebuggerOpen);

  const actionLogs = propLogs ?? storeLogs;
  const liveFormState = propFormState !== undefined ? propFormState : storeLiveFormState;

  const [activeTab, setActiveTab] = useState<'form' | 'logs'>('form');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  const handleCopy = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => {
      setCopiedSection(null);
    }, 1500);
  };

  const handleResetForm = () => {
    onResetForm?.();
    if (liveFormState) {
      setLiveFormState({
        ...liveFormState,
        values: {},
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: true,
        dirty: false,
      });
    }
  };

  const hasFormErrors = liveFormState && Object.keys(liveFormState.errors || {}).length > 0;
  const errorCount = liveFormState ? Object.keys(liveFormState.errors || {}).length : 0;

  return (
    <div
      data-testid="action-debugger-panel"
      className={`bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col transition-all duration-200 z-40 ${
        isMinimized ? 'h-11 w-80' : 'h-96 w-96 sm:w-[480px]'
      } ${className || ''}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono text-xs font-bold text-slate-200">LIVE DEBUGGER</span>
          </div>

          <div className="h-3 w-px bg-slate-700 mx-1" />

          {/* Tab Switcher */}
          {!isMinimized && (
            <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800">
              <button
                type="button"
                data-testid="debugger-tab-form"
                onClick={() => setActiveTab('form')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Form State</span>
                {hasFormErrors && (
                  <span className="px-1 py-0.2 text-[9px] bg-red-500 text-white rounded-full font-bold">
                    {errorCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                data-testid="debugger-tab-logs"
                onClick={() => setActiveTab('logs')}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition flex items-center gap-1 cursor-pointer ${
                  activeTab === 'logs'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Terminal className="w-3 h-3" />
                <span>Action Logs</span>
                {actionLogs.length > 0 && (
                  <span className="px-1 py-0.2 text-[9px] bg-slate-700 text-slate-200 rounded-full font-bold">
                    {actionLogs.length}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="debugger-minimize-btn"
            title={isMinimized ? 'Expand Debugger' : 'Minimize Debugger'}
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            data-testid="debugger-close-btn"
            title="Close Debugger"
            onClick={() => {
              setActionDebuggerOpen(false);
              onClose?.();
            }}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Area */}
      {!isMinimized && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-900">
          {activeTab === 'form' ? (
            /* Live Form State Tab */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 font-sans text-xs">
              {/* Form Status Banner */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                    {liveFormState?.isSubmitting ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <span className="animate-spin w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full" />
                        Submitting...
                      </span>
                    ) : liveFormState?.isValid === false || hasFormErrors ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        Invalid
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Valid / Ready
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-medium">Dirty:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        liveFormState?.dirty
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {liveFormState?.dirty ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="reset-form-btn"
                  onClick={handleResetForm}
                  className="px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Form</span>
                </button>
              </div>

              {/* Form Values Section */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <FileCode className="w-3.5 h-3.5 text-blue-400" />
                    <span>Live Form Values (JSON)</span>
                  </span>
                  <button
                    type="button"
                    data-testid="copy-values-btn"
                    onClick={() =>
                      handleCopy(
                        JSON.stringify(liveFormState?.values || {}, null, 2),
                        'values',
                      )
                    }
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                  >
                    {copiedSection === 'values' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <div
                  data-testid="form-values-json"
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 max-h-36 overflow-y-auto whitespace-pre leading-relaxed select-text"
                >
                  {JSON.stringify(liveFormState?.values || {}, null, 2)}
                </div>
              </div>

              {/* Form Errors Section */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>{`Validation Errors (${errorCount})`}</span>
                  </span>
                </div>
                {hasFormErrors ? (
                  <div
                    data-testid="form-errors-list"
                    className="flex flex-col gap-1.5 max-h-32 overflow-y-auto"
                  >
                    {Object.entries(liveFormState?.errors || {}).map(([field, err]) => (
                      <div
                        key={field}
                        className="flex items-start gap-2 p-2 rounded bg-red-950/40 border border-red-900/50 text-red-200 text-xs"
                      >
                        <span className="font-mono font-bold text-red-400 shrink-0">
                          {field}:
                        </span>
                        <span className="flex-1">{err}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    data-testid="no-errors-badge"
                    className="p-2 rounded bg-slate-950 border border-slate-800/80 text-slate-500 text-xs flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>No validation errors. Form passes all active rules.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Action Execution Logs Tab */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 font-sans text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Dispatched Actions ({actionLogs.length})
                </span>
                {actionLogs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="copy-logs-btn"
                      onClick={() => handleCopy(JSON.stringify(actionLogs, null, 2), 'logs')}
                      className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      {copiedSection === 'logs' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy All</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      data-testid="clear-logs-btn"
                      onClick={clearActionLogs}
                      className="text-[10px] text-slate-400 hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                )}
              </div>

              {actionLogs.length === 0 ? (
                <div
                  data-testid="empty-logs-state"
                  className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 gap-1.5"
                >
                  <Activity className="w-6 h-6 text-slate-600 animate-pulse" />
                  <span className="text-xs font-medium text-slate-400">No actions executed yet.</span>
                  <span className="text-[10px] text-slate-500 max-w-[280px]">
                    Interact with buttons, inputs, or form submissions in the preview canvas to watch live action dispatches.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2" data-testid="action-logs-list">
                  {actionLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const isSuccess = log.status === 'success';
                    const isError = log.status === 'error';

                    return (
                      <div
                        key={log.id}
                        data-testid={`action-log-entry-${log.id}`}
                        className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden text-xs transition"
                      >
                        {/* Log Item Header */}
                        <div
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="flex items-center justify-between p-2 hover:bg-slate-800/50 cursor-pointer select-none gap-2"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isSuccess ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : isError ? (
                              <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" />
                            )}
                            <span className="font-mono text-[11px] font-bold text-blue-400 truncate">
                              {log.actionType}
                            </span>
                            <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-slate-800 text-slate-300">
                              {log.trigger}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-slate-500">
                              {log.timestamp.slice(11, 19)}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Payload & Result Details */}
                        {isExpanded && (
                          <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/70 flex flex-col gap-2 font-mono text-[10px]">
                            {log.payload && (
                              <div>
                                <span className="text-slate-400 font-bold block mb-0.5">Payload:</span>
                                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 overflow-x-auto whitespace-pre">
                                  {JSON.stringify(log.payload, null, 2)}
                                </div>
                              </div>
                            )}

                            {log.output !== undefined && (
                              <div>
                                <span className="text-slate-400 font-bold block mb-0.5">Output / Result:</span>
                                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-blue-300 overflow-x-auto whitespace-pre">
                                  {JSON.stringify(log.output, null, 2)}
                                </div>
                              </div>
                            )}

                            {log.error && (
                              <div>
                                <span className="text-red-400 font-bold block mb-0.5">Error:</span>
                                <div className="p-1.5 rounded bg-red-950/50 border border-red-900/50 text-red-300 overflow-x-auto">
                                  {log.error}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
