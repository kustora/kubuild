import type { Node, PageDocument, DocumentMetadata } from '@kubuild/schema';
import type { DocumentSecurityLimits } from '@kubuild/core';

export type AiGenerationMode = 'full-page' | 'section' | 'refactor' | 'chat';

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface AiChatRequest {
  messages: AiChatMessage[];
  currentDocument?: PageDocument;
  selectedNodeId?: string;
  systemPrompt?: string;
}

export interface AiChatResponse {
  message: AiChatMessage;
}

export interface AiGeneratePageRequest {
  prompt: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  metadata?: Partial<DocumentMetadata>;
  stream?: boolean;
}

export interface AiGenerateSectionRequest {
  prompt: string;
  stylePreference?: string;
  targetSectionType?: string;
  parentContext?: string;
}

export interface AiRefactorNodeRequest {
  node: Node;
  instruction: string;
  stylePreference?: string;
}

export type AiStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'metadata'; metadata: DocumentMetadata; rootPageNode: Node }
  | { type: 'section'; index: number; total: number; section: Node }
  | { type: 'complete'; document: PageDocument }
  /**
   * Token-level chat streaming (STORA-515). `delta` is the newly-arrived text fragment,
   * `content` is the full accumulated assistant message so far — consumers that only
   * care about the running text (e.g. rendering a live-updating bubble) can just use
   * `content` and ignore `delta`.
   */
  | { type: 'chat-chunk'; delta: string; content: string }
  /** Terminal event for a chat stream — mirrors `complete` for `streamPage`. */
  | { type: 'chat-complete'; message: AiChatMessage }
  | { type: 'error'; error: { code: string; message: string } };

export interface AiStreamCallbacks {
  onStatus?: (message: string) => void;
  onMetadata?: (metadata: DocumentMetadata, rootPage: Node) => void;
  onSection?: (section: Node, index: number, total: number) => void;
  onComplete?: (document: PageDocument) => void;
  /** Fired for every partial chunk of a streaming chat response (STORA-515/516). */
  onChatChunk?: (delta: string, content: string) => void;
  /** Fired once, when a streaming chat response has finished assembling. */
  onChatComplete?: (message: AiChatMessage) => void;
  onError?: (error: Error) => void;
}

export interface AiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface AiGenerateResponse<T = PageDocument | Node> {
  success: boolean;
  data?: T;
  error?: AiErrorDetail;
  rawModelResponse?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiCompiledComponentProp {
  name: string;
  type: string;
  defaultValue?: unknown;
  options?: unknown[];
  description?: string;
}

export interface AiCompiledComponentSpec {
  type: string;
  label: string;
  category: string;
  description?: string;
  acceptsChildren: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  props?: AiCompiledComponentProp[];
}

export interface AiProviderGenerateParams {
  systemPrompt: string;
  userPrompt: string;
  messages?: AiChatMessage[];
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface AiProviderGenerateResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface AiProviderAdapter {
  readonly name: string;
  generate(params: AiProviderGenerateParams): Promise<AiProviderGenerateResult>;
  /**
   * Optional token-level streaming variant (STORA-515). Adapters whose provider API
   * supports incremental streaming (OpenAI, Anthropic, Gemini) should implement this as
   * an async generator that `yield`s each text delta as it arrives over the wire, and
   * `return`s the final `AiProviderGenerateResult` (full text + usage, mirroring
   * `generate`) once the stream ends.
   *
   * Adapters that omit this are treated by `KubuildAiEngine` as non-streaming-capable:
   * the engine falls back to a single `generate()` call and emits the whole response as
   * one chunk through the same streaming interface, so callers never need to branch on
   * adapter capability themselves.
   */
  generateStream?(
    params: AiProviderGenerateParams,
  ): AsyncGenerator<string, AiProviderGenerateResult, void>;
}

export interface ComponentDefinitionLike {
  type: string;
  label?: string;
  category?: string;
  description?: string;
  acceptsChildren?: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  propFields?: Array<{
    name: string;
    label?: string;
    type?: string;
    defaultValue?: unknown;
    options?: Array<{ label: string; value: unknown }>;
    description?: string;
  }>;
}

export interface ComponentRegistryLike {
  list(): ComponentDefinitionLike[];
  get?(type: string): ComponentDefinitionLike | undefined;
  has?(type: string): boolean;
}

export interface KubuildAiEngineOptions {
  registry?: ComponentRegistryLike;
  adapter: AiProviderAdapter;
  securityLimits?: DocumentSecurityLimits;
  systemPromptPrefix?: string;
  debug?: boolean;
  logger?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown) => void;
}
