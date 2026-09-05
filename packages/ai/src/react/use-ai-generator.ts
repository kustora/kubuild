import { useState, useCallback, useRef } from 'react';
import type { PageDocument, Node } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
} from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

export interface UseAiGeneratorOptions extends AiClientOptions {
  onSuccess?: (data: PageDocument | Node) => void;
  onError?: (error: Error) => void;
}

export function useAiGenerator(options: UseAiGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<KubuildAiClient>(createAiClient(options));

  // Cancel any in-flight request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }, []);

  const generatePage = useCallback(
    async (params: AiGeneratePageRequest): Promise<PageDocument | null> => {
      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setIsGenerating(true);
      setError(null);

      try {
        const doc = await clientRef.current.generatePage(params, {
          signal: ac.signal,
        });
        options.onSuccess?.(doc);
        return doc;
      } catch (err: unknown) {
        if (ac.signal.aborted) return null;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        options.onError?.(e);
        return null;
      } finally {
        if (abortControllerRef.current === ac) {
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, options],
  );

  const generateSection = useCallback(
    async (params: AiGenerateSectionRequest): Promise<Node | null> => {
      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setIsGenerating(true);
      setError(null);

      try {
        const node = await clientRef.current.generateSection(params, {
          signal: ac.signal,
        });
        options.onSuccess?.(node);
        return node;
      } catch (err: unknown) {
        if (ac.signal.aborted) return null;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        options.onError?.(e);
        return null;
      } finally {
        if (abortControllerRef.current === ac) {
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, options],
  );

  const refactorNode = useCallback(
    async (params: AiRefactorNodeRequest): Promise<Node | null> => {
      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setIsGenerating(true);
      setError(null);

      try {
        const node = await clientRef.current.refactorNode(params, {
          signal: ac.signal,
        });
        options.onSuccess?.(node);
        return node;
      } catch (err: unknown) {
        if (ac.signal.aborted) return null;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        options.onError?.(e);
        return null;
      } finally {
        if (abortControllerRef.current === ac) {
          setIsGenerating(false);
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, options],
  );

  return {
    generatePage,
    generateSection,
    refactorNode,
    isGenerating,
    error,
    cancel,
  };
}
