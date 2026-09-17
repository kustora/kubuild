import type { Node, PageDocument, DocumentMetadata } from '@kubuild/schema';
import type { DocumentSecurityLimits } from '@kubuild/core';

export type AiGenerationMode = 'full-page' | 'section' | 'refactor' | 'chat' | 'agent' | 'plan';

/** Plain text content block. */
export interface AiTextBlock {
  type: 'text';
  text: string;
}

/**
 * A tool invocation requested by the model (STORA-530). Provider-agnostic shape: the
 * OpenAI adapter maps this to `assistant.tool_calls`, Anthropic to a `tool_use` block.
 */
export interface AiToolUseBlock {
  type: 'tool_use';
  /** Provider-issued call id — echoed back on the matching `tool_result`. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** The host's answer to an `AiToolUseBlock`, fed back into the next model turn. */
export interface AiToolResultBlock {
  type: 'tool_result';
  /** Must match the `id` of the `tool_use` block being answered. */
  toolUseId: string;
  /** Serialized result payload (JSON string for structured results). */
  content: string;
  /** True when the tool failed — the model is expected to self-correct and retry. */
  isError?: boolean;
}

export type AiContentBlock = AiTextBlock | AiToolUseBlock | AiToolResultBlock;

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'system';
  /**
   * Either a plain string (every pre-STORA-530 call site) or a list of content blocks
   * carrying tool calls/results. Adapters that don't support tool calling only ever see
   * the string form, since `tools` is never passed to them.
   */
  content: string | AiContentBlock[];
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

export interface PlannedSection {
  type: string;
  title: string;
  prompt: string;
}

export interface PagePlan {
  title?: string;
  description?: string;
  pageStyles?: Node['styles'];
  sections?: PlannedSection[];
}

export interface AiPlanPageRequest {
  prompt: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  sectionCount?: number | { min?: number; max?: number };
  conversationHistory?: AiChatMessage[];
}

export interface AiGeneratePageRequest {
  prompt: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  metadata?: Partial<DocumentMetadata>;
  stream?: boolean;
  /** Prior conversation history from chat mode so generator keeps full context. */
  conversationHistory?: AiChatMessage[];
  /** Desired number of sections or range. */
  sectionCount?: number | { min?: number; max?: number };
  /** Pre-confirmed plan to generate directly without re-planning. */
  plan?: PagePlan;
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
  /** Agent mode (STORA-530): a new reasoning step has begun. */
  | { type: 'agent-step'; step: number; maxSteps: number }
  /** Agent mode: the model asked to run a tool. */
  | { type: 'tool-call'; id: string; name: string; input: Record<string, unknown> }
  /** Agent mode: the tool finished (or failed — the model then self-corrects). */
  | { type: 'tool-result'; id: string; name: string; ok: boolean; summary: string }
  /** Agent mode terminal event: the patch the client replays through the store. */
  | { type: 'agent-complete'; result: AiAgentRunResult }
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
  /** Agent mode (STORA-530). */
  onAgentStep?: (step: number, maxSteps: number) => void;
  onToolCall?: (call: { id: string; name: string; input: Record<string, unknown> }) => void;
  onToolResult?: (result: { id: string; name: string; ok: boolean; summary: string }) => void;
  onAgentComplete?: (result: AiAgentRunResult) => void;
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

/**
 * A tool the model may call (STORA-530). `inputSchema` is a JSON Schema object describing
 * the tool's arguments — passed through verbatim to the provider (OpenAI
 * `function.parameters`, Anthropic `input_schema`, Gemini `parameters`).
 */
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type AiToolChoice = 'auto' | 'none' | 'required' | { name: string };

export interface AiProviderGenerateParams {
  systemPrompt: string;
  userPrompt: string;
  messages?: AiChatMessage[];
  jsonSchema?: Record<string, unknown>;
  signal?: AbortSignal;
  /**
   * Tools the model may call this turn. Adapters that don't implement tool calling ignore
   * this field entirely, so passing it can never break an older adapter — but the agent
   * loop refuses to run against such an adapter (see `KubuildAiAgent`).
   */
  tools?: AiToolDefinition[];
  toolChoice?: AiToolChoice;
  /** Overrides the adapter's configured sampling temperature for this call. */
  temperature?: number;
}

/** Why the model stopped generating — drives the agent loop's continue/stop decision. */
export type AiStopReason = 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'unknown';

export interface AiProviderGenerateResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
  /**
   * Tool invocations requested by the model. Non-empty only when `params.tools` was given
   * and the adapter supports tool calling.
   */
  toolCalls?: AiToolUseBlock[];
  stopReason?: AiStopReason;
}

export interface AiProviderAdapter {
  readonly name: string;
  /**
   * Whether this adapter forwards `params.tools` to its provider and parses tool calls
   * back out (STORA-530). Adapters predating tool calling simply omit it, which reads as
   * `false` — `KubuildAiAgent` refuses to start rather than silently running a tool-less
   * loop that can never edit anything.
   */
  readonly supportsTools?: boolean;
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
  /** Agent loop step ceiling (STORA-530). Default: 8. */
  maxAgentSteps?: number;
  debug?: boolean;
  logger?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown) => void;
}

/* ------------------------------------------------------------------------------------
 * Agent mode (STORA-530)
 * ----------------------------------------------------------------------------------*/

/**
 * A single, surgical document mutation produced by an agent tool call. Deliberately
 * mirrors the editor store's existing action surface (`updateNodeProps`,
 * `updateNodeStyle`, `insertComponent`, `moveComponent`, `deleteComponent`,
 * `duplicateComponent`, `replaceNodeSubtree`) so the client can replay a whole run
 * through the exact same code path manual editing uses — and therefore inherit
 * `DocumentHistoryManager` undo for free.
 *
 * The agent never returns a whole regenerated document; it returns a list of these.
 */
export type AgentOp =
  | {
      kind: 'update-props';
      nodeId: string;
      props: Record<string, unknown>;
      merge: boolean;
    }
  | {
      kind: 'update-styles';
      nodeId: string;
      styles: Record<string, unknown>;
      /** Set for a breakpoint layer write. Mutually exclusive with `state`. */
      breakpoint?: 'base' | 'desktop' | 'tablet' | 'mobile';
      /** Set for a pseudo-state layer write (e.g. ':hover'). Mutually exclusive with `breakpoint`. */
      state?: string;
      merge: boolean;
    }
  | { kind: 'insert-node'; parentId: string; index?: number; node: Node }
  | { kind: 'move-node'; nodeId: string; targetParentId: string; index?: number }
  | { kind: 'delete-node'; nodeId: string }
  | {
      kind: 'duplicate-node';
      nodeId: string;
      targetParentId?: string;
      index?: number;
    }
  | { kind: 'replace-node'; nodeId: string; node: Node };

/** An `AgentOp` plus the metadata the review UI needs before the user hits Apply. */
export interface AgentOpRecord {
  id: string;
  op: AgentOp;
  /** Human-readable one-liner, e.g. `Ubah props tombol "cta-btn"`. */
  summary: string;
  /**
   * True for ops that can destroy user content (`delete-node`, `replace-node`). The
   * editor never auto-applies these, even with auto-apply turned on.
   */
  destructive: boolean;
}

export interface AiAgentRequest {
  messages: AiChatMessage[];
  /** The canvas document the agent reasons about and mutates a snapshot of. */
  document: PageDocument;
  selectedNodeId?: string;
  systemPrompt?: string;
  stylePreference?: string;
  /** Overrides the engine's configured step ceiling for this run. */
  maxSteps?: number;
}

export interface AiAgentRunResult {
  ops: AgentOpRecord[];
  /** The agent's closing natural-language message. */
  summary: string;
  stepsUsed: number;
  stoppedBy: 'complete' | 'max-steps' | 'aborted' | 'error';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}
