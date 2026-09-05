import { useState, useCallback, useRef, useEffect } from 'react';
import type { PageDocument } from '@kubuild/schema';
import type { AiChatMessage, AiChatResponse } from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

/**
 * Optional, host-implemented chat history persistence (STORA-520). `@kubuild/ai` stays
 * storage-agnostic — it never imports `localStorage` or any concrete storage mechanism
 * itself; the host supplies an adapter backed by whatever it wants (browser
 * `localStorage`, IndexedDB, a Stora.page backend call, etc.).
 */
export interface AiChatHistoryStorageAdapter {
  /** Called once on mount to seed `messages` before the user sends anything. */
  loadHistory(): Promise<AiChatMessage[]> | AiChatMessage[];
  /**
   * Called at completed-message boundaries (a user message just sent, or an assistant
   * reply that just finished/streamed to completion) — never on every mid-stream token,
   * see `useAiChat`'s persistence notes.
   */
  saveHistory(messages: AiChatMessage[]): Promise<void> | void;
}

export interface UseAiChatOptions extends AiClientOptions {
  initialMessages?: AiChatMessage[];
  onMessage?: (message: AiChatMessage) => void;
  onError?: (error: Error) => void;
  /**
   * Fired for every partial token/chunk of a streaming chat response (STORA-516),
   * mirroring `useAiGenerator`'s `AiStreamCallbacks` naming convention. Optional — the
   * `messages` array already updates incrementally on its own, this is only for hosts
   * that want a side-channel (e.g. custom rendering, telemetry) into the raw chunks.
   */
  onChunk?: (delta: string, content: string) => void;
  /**
   * Optional storage adapter (STORA-520) used to persist/restore chat history across
   * reloads. Without it, behavior is exactly as before: pure in-memory React state, lost
   * on reload/unmount. `loadHistory()` is called once on mount to hydrate `messages`
   * (only overriding `initialMessages` when it resolves a non-empty array);
   * `saveHistory()` is called at completed-message boundaries — after a user message is
   * appended, and after an assistant reply finishes (streamed or not) — intentionally
   * *not* on every streaming chunk, to avoid hammering the adapter mid-stream.
   */
  historyStorage?: AiChatHistoryStorageAdapter;
}

export interface SendMessageOptions {
  currentDocument?: PageDocument;
  selectedNodeId?: string;
  systemPrompt?: string;
  /**
   * Opt out of token-level streaming for this call (STORA-515/516 default to `true`).
   * When `false`, behaves exactly like the pre-streaming single request/response call.
   */
  stream?: boolean;
}

export function useAiChat(options: UseAiChatOptions) {
  const [messages, setMessages] = useState<AiChatMessage[]>(options.initialMessages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<KubuildAiClient>(createAiClient(options));
  const historyStorageRef = useRef(options.historyStorage);
  historyStorageRef.current = options.historyStorage;

  /**
   * STORA-520 — best-effort persistence: a storage failure (quota exceeded, network
   * error on a remote adapter, etc.) must never break the chat itself, so errors are
   * swallowed here rather than surfaced through `setError`/`onError` (those are reserved
   * for the actual chat request failing).
   */
  const persistHistory = useCallback((history: AiChatMessage[]) => {
    const adapter = historyStorageRef.current;
    if (!adapter) return;
    try {
      void Promise.resolve(adapter.saveHistory(history)).catch(() => undefined);
    } catch {
      // Synchronous throw from a non-Promise-returning adapter — ignore, same reasoning.
    }
  }, []);

  // STORA-520 — hydrate from storage once on mount. Only overrides `initialMessages`
  // when the adapter actually resolves a non-empty history, so a fresh/empty adapter
  // (e.g. first-ever visit) doesn't clobber a host-provided `initialMessages` seed.
  useEffect(() => {
    const adapter = historyStorageRef.current;
    if (!adapter) return;
    let cancelled = false;
    Promise.resolve(adapter.loadHistory())
      .then((loaded) => {
        if (!cancelled && Array.isArray(loaded) && loaded.length > 0) {
          setMessages(loaded);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        options.onError?.(e);
      });
    return () => {
      cancelled = true;
    };
    // Deliberately empty deps: `historyStorage`/`onError` are read via refs/closures at
    // call time and this must run exactly once per mount, not whenever the caller passes
    // a fresh options object.
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      // Aborts the underlying fetch (and, for a streaming request, the in-flight
      // ReadableStream read) — not just local UI state (STORA-516 AC).
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    persistHistory([]);
  }, [persistHistory]);

  const sendMessage = useCallback(
    async (content: string, sendOptions?: SendMessageOptions): Promise<AiChatMessage | null> => {
      if (!content.trim()) return null;

      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      const userMessage: AiChatMessage = {
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      const updatedHistory = [...messages, userMessage];
      setMessages(updatedHistory);
      setIsLoading(true);
      setError(null);
      // Completed-message boundary #1 (STORA-520): the user's message is final the
      // instant it's sent — persist it now rather than waiting for the assistant reply,
      // so a reload mid-request doesn't lose it.
      persistHistory(updatedHistory);

      const useStream = sendOptions?.stream !== false;

      try {
        if (useStream) {
          setIsStreaming(true);

          // Placeholder assistant message, filled in incrementally as chunks arrive.
          let assistantIndex = -1;
          setMessages((prev) => {
            assistantIndex = prev.length;
            return [...prev, { role: 'assistant', content: '', timestamp: Date.now() }];
          });

          const finalMessage = await clientRef.current.chatStream(
            {
              messages: updatedHistory,
              currentDocument: sendOptions?.currentDocument,
              selectedNodeId: sendOptions?.selectedNodeId,
              systemPrompt: sendOptions?.systemPrompt,
            },
            {
              onChatChunk: (delta, contentSoFar) => {
                options.onChunk?.(delta, contentSoFar);
                setMessages((prev) => {
                  if (assistantIndex < 0 || assistantIndex >= prev.length) return prev;
                  const next = prev.slice();
                  next[assistantIndex] = { ...next[assistantIndex], content: contentSoFar };
                  return next;
                });
              },
              onChatComplete: (message) => {
                setMessages((prev) => {
                  if (assistantIndex < 0 || assistantIndex >= prev.length) return prev;
                  const next = prev.slice();
                  next[assistantIndex] = message;
                  return next;
                });
              },
            },
            { signal: ac.signal },
          );

          // Completed-message boundary #2 (STORA-520): the stream finished — persist the
          // fully assembled assistant message, never the intermediate per-chunk content
          // (`onChatChunk` above deliberately does not call `persistHistory`).
          persistHistory([...updatedHistory, finalMessage]);
          options.onMessage?.(finalMessage);
          return finalMessage;
        }

        const response: AiChatResponse = await clientRef.current.chat(
          {
            messages: updatedHistory,
            currentDocument: sendOptions?.currentDocument,
            selectedNodeId: sendOptions?.selectedNodeId,
            systemPrompt: sendOptions?.systemPrompt,
          },
          { signal: ac.signal },
        );

        const assistantMsg = response.message;
        setMessages((prev) => [...prev, assistantMsg]);
        // Completed-message boundary #2 (non-streaming variant): a single request/response
        // call has no intermediate chunks at all, so this is simply "after the reply".
        persistHistory([...updatedHistory, assistantMsg]);
        options.onMessage?.(assistantMsg);
        return assistantMsg;
      } catch (err: unknown) {
        if (ac.signal.aborted) return null;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        options.onError?.(e);
        return null;
      } finally {
        if (abortControllerRef.current === ac) {
          setIsLoading(false);
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, messages, options, persistHistory],
  );

  return {
    messages,
    sendMessage,
    isLoading,
    /** Whether the in-flight `sendMessage` call is a token-level stream (STORA-516). */
    isStreaming,
    error,
    cancel,
    clearMessages,
    setMessages,
  };
}
