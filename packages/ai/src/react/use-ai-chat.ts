import { useState, useCallback, useRef } from 'react';
import type { PageDocument } from '@kubuild/schema';
import type { AiChatMessage, AiChatResponse } from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

export interface UseAiChatOptions extends AiClientOptions {
  initialMessages?: AiChatMessage[];
  onMessage?: (message: AiChatMessage) => void;
  onError?: (error: Error) => void;
}

export interface SendMessageOptions {
  currentDocument?: PageDocument;
  selectedNodeId?: string;
  systemPrompt?: string;
}

export function useAiChat(options: UseAiChatOptions) {
  const [messages, setMessages] = useState<AiChatMessage[]>(options.initialMessages || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<KubuildAiClient>(createAiClient(options));

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
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

      try {
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
    error,
    cancel,
    clearMessages,
    setMessages,
  };
}
