import { useCallback, useRef, useState } from 'react';
import type { PageDocument } from '@kubuild/schema';
import type { AgentOpRecord, AiAgentRunResult, AiChatMessage } from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

/** One entry in the live run timeline the panel renders while the agent works. */
export interface AgentTimelineEntry {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: 'running' | 'ok' | 'failed';
  summary?: string;
}

export interface UseAiAgentOptions extends AiClientOptions {
  onComplete?: (result: AiAgentRunResult) => void;
  onError?: (error: Error) => void;
}

export interface RunAgentParams {
  /** The instruction for this turn. Appended to `history` as the last user message. */
  instruction: string;
  document: PageDocument;
  selectedNodeId?: string;
  /** Prior turns of the same conversation, so follow-ups like "tambahkan juga…" work. */
  history?: AiChatMessage[];
  stylePreference?: string;
  maxSteps?: number;
  /**
   * Extra instructions appended after the agent's built-in system prompt (never replacing
   * its tool/safety rules). Subject to the handler's `allowClientInstructions` cap.
   */
  instructions?: string;
}

/**
 * React binding for agent mode (STORA-530).
 *
 * Owns only the transport and the live run state — it deliberately does NOT apply anything
 * to a document. The resulting `ops` are handed to the caller (the editor's AI panel),
 * which reviews them with the user and then replays them through the editor store, so the
 * whole run lands as a single undoable edit.
 */
export function useAiAgent(options: UseAiAgentOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(0);
  const [timeline, setTimeline] = useState<AgentTimelineEntry[]>([]);
  const [ops, setOps] = useState<AgentOpRecord[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [result, setResult] = useState<AiAgentRunResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<KubuildAiClient>(createAiClient(options));
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reset = useCallback(() => {
    setTimeline([]);
    setOps([]);
    setSummary('');
    setResult(null);
    setError(null);
    setStep(0);
    setMaxSteps(0);
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsRunning(false);
  }, []);

  const run = useCallback(
    async (params: RunAgentParams): Promise<AiAgentRunResult | null> => {
      // A second run while one is in flight would interleave timeline entries from two
      // different conversations — cancel the old one first.
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      reset();
      setIsRunning(true);

      const messages: AiChatMessage[] = [
        ...(params.history ?? []),
        { role: 'user', content: params.instruction, timestamp: Date.now() },
      ];

      try {
        const runResult = await clientRef.current.runAgent(
          {
            messages,
            document: params.document,
            selectedNodeId: params.selectedNodeId,
            stylePreference: params.stylePreference,
            maxSteps: params.maxSteps,
            instructions: params.instructions,
          },
          {
            onAgentStep: (currentStep, limit) => {
              setStep(currentStep);
              setMaxSteps(limit);
            },
            onToolCall: (call) => {
              setTimeline((prev) => [
                ...prev,
                { id: call.id, name: call.name, input: call.input, status: 'running' },
              ]);
            },
            onToolResult: (toolResult) => {
              setTimeline((prev) =>
                prev.map((entry) =>
                  entry.id === toolResult.id
                    ? { ...entry, status: toolResult.ok ? 'ok' : 'failed', summary: toolResult.summary }
                    : entry,
                ),
              );
            },
            onAgentComplete: (completed) => {
              setOps(completed.ops);
              setSummary(completed.summary);
              setResult(completed);
              optionsRef.current.onComplete?.(completed);
            },
            onError: (err) => {
              setError(err);
              optionsRef.current.onError?.(err);
            },
          },
          { signal: controller.signal },
        );

        return runResult;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        // An abort is a user action, not a failure to report.
        if (normalized.name !== 'AbortError') {
          setError(normalized);
          optionsRef.current.onError?.(normalized);
        }
        return null;
      } finally {
        setIsRunning(false);
        abortControllerRef.current = null;
      }
    },
    [reset],
  );

  return {
    run,
    abort,
    reset,
    isRunning,
    step,
    maxSteps,
    timeline,
    ops,
    summary,
    result,
    error,
  };
}
