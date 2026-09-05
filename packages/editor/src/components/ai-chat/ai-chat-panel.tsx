import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PageDocument } from '@kubuild/schema';
import { findNodeById } from '@kubuild/core';
import { ComponentRegistry, createDefaultComponentRegistry } from '@kubuild/components';
import { useAiChat, useAiGenerator } from '@kubuild/ai/react';
import type { AiChatMessage } from '@kubuild/ai';
import type { AiClientOptions } from '@kubuild/ai/client';
import { useEditorStore } from '../../store';
import { ResolvedAiEditorConfig } from '../../config';
import { buildAiChatContext, resolveChatSendContext } from '../../utils/ai-context';
import {
  runEnhanceNode,
  diffEnhanceNode,
  applyEnhanceCandidate,
  type EnhanceCandidate,
} from '../../ai/enhance-node';
import {
  Bot,
  User,
  Loader2,
  AlertTriangle,
  RotateCw,
  Send,
  X,
  Square,
  PanelRight,
  PictureInPicture2,
  Sparkles,
  Wand2,
  Check,
} from 'lucide-react';

export interface AiChatPanelProps {
  /** Fully-resolved AI config (STORA-501) — panel must only ever be mounted when this is enabled. */
  aiConfig: ResolvedAiEditorConfig;
  /** `'hidden'` is handled by the caller not mounting this component at all. */
  mode: 'docked' | 'floating';
  onClose?: () => void;
  onToggleMode?: () => void;
  className?: string;
  /**
   * Seeds `useAiChat`'s message history (e.g. a persisted chat restored by the host, or a
   * fixture in tests). Passed straight through to `useAiChat({ initialMessages })`.
   */
  initialMessages?: AiChatMessage[];
  /**
   * Optional overrides for the document/selection this panel builds AI context from,
   * following the same prop-over-store precedence as `InspectorPanel`. Falls back to the
   * live editor store when omitted — real usage should always omit these.
   */
  document?: PageDocument;
  selectedNodeId?: string | null;
  /**
   * Component registry used to validate an AI enhance candidate's props before Apply
   * (STORA-514), the same registry manual editing (`InspectorPanel`) validates against.
   * Defaults to `createDefaultComponentRegistry()` so existing callers/tests that predate
   * STORA-512 keep compiling without passing one.
   */
  registry?: ComponentRegistry;
}

/**
 * Resolves the `AiEditorConfig.provider` union into `useAiChat`'s HTTP-endpoint options.
 *
 * `useAiChat` (via `KubuildAiClient`) only ever talks to an HTTP endpoint — that's the
 * recommended host-proxied pattern for paid providers (see PRD §4 NFR-4: API keys must
 * never live in client-side config). When a host instead passes a raw `AiProviderAdapter`
 * directly (no `endpoint`), there is no URL this panel can call: sending is short-circuited
 * client-side with a clear inline error instead of attempting a broken fetch.
 */
function resolveEndpointOptions(
  provider: ResolvedAiEditorConfig['provider'],
): Pick<AiClientOptions, 'endpoint' | 'headers'> | null {
  if (provider && typeof provider === 'object' && 'endpoint' in provider) {
    return { endpoint: provider.endpoint, headers: provider.headers };
  }
  return null;
}

const PROVIDER_NOT_CONFIGURED_ENDPOINT = '__kubuild_ai_provider_not_http_configured__';

/**
 * Compact, single-line rendering of one diff field's before/after value (STORA-513) — a
 * targeted line, never a full object dump. `undefined` renders as `(none)` so an added or
 * removed field is legible rather than blank.
 */
function stringifyDiffValue(value: unknown): string {
  if (value === undefined) return '(none)';
  if (typeof value === 'string') return value;
  try {
    const json = JSON.stringify(value);
    return json.length > 60 ? `${json.slice(0, 60)}…` : json;
  } catch {
    return String(value);
  }
}

/** Exported for isolated unit testing (STORA-505) — the loading/typing bubble. */
export function AiChatTypingIndicator() {
  return (
    <div className="flex items-center gap-2 self-start max-w-[85%]" data-testid="ai-chat-loading">
      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
        <Bot className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-xs">Thinking…</span>
      </div>
    </div>
  );
}

/** Exported for isolated unit testing (STORA-505) — a single user/assistant chat bubble. */
export function AiChatBubble({ message }: { message: AiChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div
      data-testid="ai-chat-bubble"
      data-role={message.role}
      className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'self-end flex-row-reverse' : 'self-start'}`}
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
          isUser ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>
      <div
        className={`rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

/**
 * Exported for isolated unit testing (STORA-505) — network/provider error bubble with a
 * Retry action, never a silent fail (PRD §4 NFR-5 graceful degradation).
 */
export function AiChatErrorBubble({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      data-testid="ai-chat-error"
      className="flex items-start gap-2 self-start max-w-[90%] bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs"
    >
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <div className="flex flex-col gap-1.5">
        <span>{message}</span>
        <button
          type="button"
          data-testid="ai-chat-retry"
          onClick={onRetry}
          className="self-start flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:text-red-900 underline"
        >
          <RotateCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    </div>
  );
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  aiConfig,
  mode,
  onClose,
  onToggleMode,
  className,
  initialMessages,
  document: propDocument,
  selectedNodeId: propSelectedNodeId,
  registry = createDefaultComponentRegistry(),
}) => {
  const storeState = useEditorStore();
  const document = propDocument ?? storeState.document;
  const selectedNodeId =
    propSelectedNodeId !== undefined ? propSelectedNodeId : storeState.selectedNodeId;
  const {
    updateNodeProps,
    updateNodeStyle,
    updateNodeStateStyle,
    replaceNodeSubtree,
    beginHistoryTransaction,
    endHistoryTransaction,
    aiChatFocusRequestId,
  } = storeState;

  const endpointOptions = useMemo(
    () => resolveEndpointOptions(aiConfig.provider),
    [aiConfig.provider],
  );

  const { messages, sendMessage, isLoading, error, cancel } = useAiChat({
    endpoint: endpointOptions?.endpoint ?? PROVIDER_NOT_CONFIGURED_ENDPOINT,
    headers: endpointOptions?.headers,
    initialMessages,
  });

  // STORA-512 — a separate network boundary from `useAiChat`: an "Enhance" instruction
  // is never sent as a chat message, it always goes through `refactorNode` so the result
  // can be validated and previewed as a candidate before touching the document.
  const { refactorNode, isGenerating: isEnhancing } = useAiGenerator({
    endpoint: endpointOptions?.endpoint ?? PROVIDER_NOT_CONFIGURED_ENDPOINT,
    headers: endpointOptions?.headers,
  });

  const [inputValue, setInputValue] = useState('');
  const [contextDismissed, setContextDismissed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  // STORA-513 — the validated enhance candidate awaiting Apply/Discard. Purely local
  // component state: nothing here has touched the document or the command engine yet.
  const [candidate, setCandidate] = useState<EnhanceCandidate | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-attach context automatically whenever the canvas selection itself changes
  // (STORA-506) — a dismissal only ever applies to the message it was dismissed for.
  useEffect(() => {
    setContextDismissed(false);
    setCandidate(null);
  }, [selectedNodeId]);

  // STORA-511 — "Ask AI about this component" bumps `aiChatFocusRequestId`; re-attach
  // context (in case it was previously dismissed for this same node) and focus the input.
  useEffect(() => {
    if (aiChatFocusRequestId === 0) return;
    setContextDismissed(false);
    inputRef.current?.focus();
    // Deliberately keyed only on the signal itself — it must fire once per focus
    // request, not on every re-render this effect's body would otherwise depend on.
  }, [aiChatFocusRequestId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isLoading, error, localError, candidate, enhanceError]);

  const selectedNode = selectedNodeId ? findNodeById(document.document, selectedNodeId) : null;
  const showContextChip = !!selectedNodeId && !contextDismissed;
  const canEnhance =
    aiConfig.features.enhance && !!selectedNode && !contextDismissed && !isLoading && !isEnhancing;

  const doSend = (content: string) => {
    if (!content.trim() || isLoading) return;

    if (!endpointOptions) {
      setLocalError(
        'This AI provider is not reachable from the browser (no HTTP endpoint configured). ' +
          'Supply `{ endpoint }` in `AiEditorConfig.provider`, proxied through `createAiHandler` on your backend.',
      );
      return;
    }

    setLocalError(null);
    const ctx = resolveChatSendContext(
      buildAiChatContext({ document, selectedNodeId }),
      contextDismissed,
    );
    void sendMessage(content, {
      currentDocument: ctx.currentDocument,
      selectedNodeId: ctx.selectedNodeId,
      systemPrompt: aiConfig.systemPromptPrefix,
    });
    // Dismissal only ever suppresses context for the message just sent (STORA-506 AC).
    setContextDismissed(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = inputValue;
    setInputValue('');
    doSend(content);
  };

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) doSend(lastUser.content);
  };

  /**
   * STORA-512 — the explicit "Enhance" action: distinct from `doSend`/chat entirely, so
   * an enhance instruction is never inferred from free text. Only ever enabled when a
   * node is attached as context (`canEnhance`). The result is validated (STORA-509's
   * pipeline, via `runEnhanceNode`) before ever being held as a candidate — the document
   * itself is untouched at this point.
   */
  const handleEnhance = async () => {
    const instruction = inputValue.trim();
    if (!instruction || !selectedNode || !canEnhance) return;

    if (!endpointOptions) {
      setLocalError(
        'This AI provider is not reachable from the browser (no HTTP endpoint configured). ' +
          'Supply `{ endpoint }` in `AiEditorConfig.provider`, proxied through `createAiHandler` on your backend.',
      );
      return;
    }

    setLocalError(null);
    setEnhanceError(null);
    setInputValue('');

    const outcome = await runEnhanceNode(refactorNode, { node: selectedNode, instruction });

    if (outcome.status === 'no-result') {
      setEnhanceError('AI enhancement request failed. Please try again.');
      return;
    }
    if (outcome.status === 'invalid') {
      setEnhanceError(`AI enhancement produced an invalid result: ${outcome.message}`);
      return;
    }

    setCandidate({
      originalNode: outcome.originalNode,
      candidateNode: outcome.candidateNode,
      diff: diffEnhanceNode(outcome.originalNode, outcome.candidateNode),
    });
  };

  /**
   * STORA-514 — Apply dispatches the candidate through the exact same store actions
   * manual editing already uses (`updateNodeProps`/`updateNodeStyle`, or `replaceNode`
   * only when the candidate's children changed structurally) — see `applyEnhanceCandidate`.
   */
  const handleApplyEnhance = () => {
    if (!candidate) return;
    const result = applyEnhanceCandidate(candidate, {
      updateNodeProps: (nodeId, props, merge) => updateNodeProps(nodeId, props, registry, merge),
      updateNodeStyle: (nodeId, styles, breakpoint, merge) =>
        updateNodeStyle(nodeId, styles, breakpoint, merge),
      updateNodeStateStyle: (nodeId, styles, state, merge) =>
        updateNodeStateStyle(nodeId, styles, state, merge),
      replaceNodeSubtree: (nodeId, node) => replaceNodeSubtree(nodeId, node, registry),
      beginHistoryTransaction,
      endHistoryTransaction,
    });

    if (!result.success) {
      setEnhanceError(result.error ?? 'Failed to apply the AI enhancement.');
      return;
    }

    setCandidate(null);
    setEnhanceError(null);
  };

  /**
   * STORA-513 — Discard leaves zero trace: the candidate only ever lived in local state
   * (`candidate`), never dispatched to the store, so clearing it is the entire operation.
   */
  const handleDiscardEnhance = () => {
    setCandidate(null);
    setEnhanceError(null);
  };

  const header = (
    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50 shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600" />
        <span className="font-bold text-xs text-slate-800">AI Assistant</span>
      </div>
      <div className="flex items-center gap-1">
        {onToggleMode && (
          <button
            type="button"
            data-testid="ai-chat-toggle-mode"
            title={mode === 'floating' ? 'Dock panel' : 'Float panel'}
            onClick={onToggleMode}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            {mode === 'floating' ? (
              <PanelRight className="w-3.5 h-3.5" />
            ) : (
              <PictureInPicture2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            data-testid="ai-chat-close"
            title="Close AI Chat"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  const body = (
    <>
      <div
        ref={scrollRef}
        data-testid="ai-chat-messages"
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-3 py-3"
      >
        {messages.length === 0 && !isLoading && (
          <p className="text-xs text-slate-400 text-center mt-6">
            Ask about your page, or request changes to the selected element.
          </p>
        )}
        {messages.map((message, idx) => (
          <AiChatBubble key={`${message.role}-${message.timestamp ?? idx}-${idx}`} message={message} />
        ))}
        {isLoading && <AiChatTypingIndicator />}
        {isEnhancing && (
          <div
            className="flex items-center gap-2 self-start max-w-[85%]"
            data-testid="ai-enhance-loading"
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Wand2 className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="bg-blue-50 text-blue-600 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Enhancing…</span>
            </div>
          </div>
        )}
        {(error || localError) && (
          <AiChatErrorBubble message={error?.message || localError || 'Something went wrong.'} onRetry={handleRetry} />
        )}
        {enhanceError && !candidate && (
          <AiChatErrorBubble message={enhanceError} onRetry={handleEnhance} />
        )}

        {/* STORA-513 — enhance diff preview: only props/styles/children fields that
            actually changed, never a full node dump, plus Apply/Discard. */}
        {candidate && (
          <div
            data-testid="ai-enhance-preview"
            className="self-stretch flex flex-col gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2.5 shadow-xs"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Wand2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Enhance preview — #{candidate.originalNode.type}:{candidate.originalNode.id}
              </span>
            </div>

            {candidate.diff.fields.length === 0 && !candidate.diff.childrenChanged ? (
              <p className="text-[11px] text-slate-500">AI did not change anything.</p>
            ) : (
              <div className="flex flex-col gap-1 max-h-40 overflow-y-auto" data-testid="ai-enhance-diff-fields">
                {candidate.diff.fields.map((field) => (
                  <div
                    key={field.path}
                    data-testid="ai-enhance-diff-field"
                    className="text-[11px] font-mono bg-slate-50 border border-slate-200 rounded px-1.5 py-1 break-words"
                  >
                    <span className="text-slate-500">{field.path}: </span>
                    <span className="text-red-600 line-through">{stringifyDiffValue(field.before)}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="text-green-700">{stringifyDiffValue(field.after)}</span>
                  </div>
                ))}
                {candidate.diff.childrenChanged && (
                  <div
                    data-testid="ai-enhance-diff-children"
                    className="text-[11px] font-mono bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-1"
                  >
                    Nested content changed
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 justify-end pt-1">
              <button
                type="button"
                data-testid="ai-enhance-discard"
                onClick={handleDiscardEnhance}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Discard
              </button>
              <button
                type="button"
                data-testid="ai-enhance-apply"
                onClick={handleApplyEnhance}
                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-2.5 shrink-0 flex flex-col gap-2">
        {showContextChip && (
          <div
            data-testid="ai-chat-context-chip"
            className="self-start flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-medium"
          >
            <span>
              membahas: #{selectedNode?.type ? `${selectedNode.type}:` : ''}
              {selectedNodeId}
            </span>
            <button
              type="button"
              data-testid="ai-chat-context-dismiss"
              title="Remove context for the next message"
              onClick={() => setContextDismissed(true)}
              className="p-0.5 rounded-full hover:bg-blue-100 text-blue-500 hover:text-blue-800 transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            data-testid="ai-chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI anything about this page…"
            className="flex-1 min-w-0 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          {/* STORA-512 — explicit, distinct action from Send: an enhance instruction is
              only ever triggered here, never inferred from the message text itself. Only
              enabled once a node is attached as context and an instruction is typed. */}
          {aiConfig.features.enhance && (
            <button
              type="button"
              data-testid="ai-chat-enhance"
              title={selectedNode ? 'Enhance selected component with AI' : 'Select a component first'}
              onClick={handleEnhance}
              disabled={!canEnhance || !inputValue.trim() || isEnhancing}
              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Wand2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isLoading ? (
            <button
              type="button"
              data-testid="ai-chat-cancel"
              onClick={cancel}
              title="Stop"
              className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              data-testid="ai-chat-send"
              disabled={!inputValue.trim()}
              title="Send"
              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>
    </>
  );

  if (mode === 'floating') {
    return (
      <div
        data-testid="ai-chat-panel"
        data-mode="floating"
        className={`fixed bottom-4 right-4 z-40 w-[360px] max-w-[92vw] h-[520px] max-h-[70vh] bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden ${className || ''}`}
      >
        {header}
        {body}
      </div>
    );
  }

  return (
    <div
      data-testid="ai-chat-panel"
      data-mode="docked"
      className={`flex flex-col h-full min-h-0 bg-white ${className || ''}`}
    >
      {header}
      {body}
    </div>
  );
};
