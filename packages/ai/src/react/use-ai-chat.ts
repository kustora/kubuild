import { useState, useCallback, useRef } from 'react';
import type { PageDocument } from '@kubuild/schema';
import type { AiChatMessage, AiChatResponse } from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

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
  }, []);

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
    [cancel, messages, options],
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
