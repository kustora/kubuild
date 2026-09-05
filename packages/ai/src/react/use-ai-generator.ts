import { useState, useCallback, useRef } from 'react';
import type { PageDocument, Node } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiStreamCallbacks,
} from '../types';
import { createAiClient, type AiClientOptions, KubuildAiClient } from '../client/ai-client';

export interface UseAiGeneratorOptions extends AiClientOptions {
  onSuccess?: (data: PageDocument | Node) => void;
  onError?: (error: Error) => void;
}

export function useAiGenerator(options: UseAiGeneratorOptions) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<Error | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef<KubuildAiClient>(createAiClient(options));

  // Cancel any in-flight request
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setIsStreaming(false);
      setCurrentStep('');
    }
  }, []);

  /**
   * Standard full page generator (non-streaming).
   */
  const generatePage = useCallback(
    async (params: AiGeneratePageRequest): Promise<PageDocument | null> => {
      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setIsGenerating(true);
      setIsStreaming(false);
      setError(null);
      setCurrentStep('Generating full page...');

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
          setCurrentStep('');
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, options],
  );

  /**
   * Progressive section streamer (SSE).
   * Calls callbacks on each step (onStatus, onMetadata, onSection, onComplete).
   */
  const streamPage = useCallback(
    async (
      params: AiGeneratePageRequest,
      streamCallbacks?: AiStreamCallbacks,
    ): Promise<PageDocument | null> => {
      cancel();
      const ac = new AbortController();
      abortControllerRef.current = ac;

      setIsGenerating(true);
      setIsStreaming(true);
      setError(null);
      setCurrentStep('Connecting to AI stream...');

      try {
        const doc = await clientRef.current.streamPage(
          params,
          {
            onStatus: (msg) => {
              setCurrentStep(msg);
              streamCallbacks?.onStatus?.(msg);
            },
            onMetadata: (metadata, rootPage) => {
              streamCallbacks?.onMetadata?.(metadata, rootPage);
            },
            onSection: (section, index, total) => {
              setCurrentStep(`Section ${index + 1}/${total} rendered`);
              streamCallbacks?.onSection?.(section, index, total);
            },
            onComplete: (completedDoc) => {
              setCurrentStep('Completed');
              streamCallbacks?.onComplete?.(completedDoc);
              options.onSuccess?.(completedDoc);
            },
            onError: (err) => {
              setError(err);
              streamCallbacks?.onError?.(err);
              options.onError?.(err);
            },
          },
          { signal: ac.signal },
        );

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
          setIsStreaming(false);
          setCurrentStep('');
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
      setIsStreaming(false);
      setError(null);
      setCurrentStep('Generating section...');

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
          setCurrentStep('');
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
      setIsStreaming(false);
      setError(null);
      setCurrentStep('Refactoring node...');

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
          setCurrentStep('');
          abortControllerRef.current = null;
        }
      }
    },
    [cancel, options],
  );

  return {
    generatePage,
    streamPage,
    generateSection,
    refactorNode,
    isGenerating,
    isStreaming,
    currentStep,
    error,
    cancel,
  };
}
