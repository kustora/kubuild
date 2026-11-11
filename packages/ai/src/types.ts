import type { Node, NodeEffect, PageDocument, DocumentMetadata } from '@kubuild/schema';
import type { DocumentSecurityLimits, EffectRegistry } from '@kubuild/core';

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

/**
 * An image the user attached. `url` must be a hosted http(s) URL (the editor uploads the
 * file through the host's asset provider first): vision-capable adapters send it to the
 * model as an image, and every adapter also lists the URL in the prompt text so the model
 * can place the image on the page.
 */
export interface AiImageBlock {
  type: 'image';
  url: string;
  mimeType?: string;
}

export type AiContentBlock = AiTextBlock | AiToolUseBlock | AiToolResultBlock | AiImageBlock;

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
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** @deprecated Alias of `instructions` — appended, never a replacement for the base prompt. */
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
  /**
   * `true` when the model's plan could not be parsed and the engine substituted its
   * generic default plan (hero/features/testimonials/cta/footer). The plan is still
   * usable, but hosts should tell the user it is not tailored to their prompt.
   */
  usedFallback?: boolean;
}

export interface AiPlanPageRequest {
  prompt: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  sectionCount?: number | { min?: number; max?: number };
  conversationHistory?: AiChatMessage[];
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** Images attached to this request — see `AiImageBlock`. */
  images?: AiImageBlock[];
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
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** Images attached to this request — see `AiImageBlock`. */
  images?: AiImageBlock[];
}

export interface AiGenerateSectionRequest {
  prompt: string;
  stylePreference?: string;
  targetSectionType?: string;
  parentContext?: string;
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** Images attached to this request — see `AiImageBlock`. */
  images?: AiImageBlock[];
}

export interface AiRefactorNodeRequest {
  node: Node;
  instruction: string;
  stylePreference?: string;
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** Images attached to this request — see `AiImageBlock`. */
  images?: AiImageBlock[];
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
  /**
   * Agent mode: periodic liveness/progress signal while a step is waiting on the model
   * (`phase: 'model'`) or on a long-running tool such as `insert_section`
   * (`phase: 'tool'`). Emitted every `agentProgressIntervalMs` so the SSE connection never
   * goes idle long enough for a reverse proxy (nginx `proxy_read_timeout`, Cloudflare's
   * 100s idle limit) to drop it, and so the UI can show that work is still happening.
   */
  | {
      type: 'agent-progress';
      step: number;
      phase: 'model' | 'tool';
      /** Tool being executed (`phase: 'tool'`) or being written by the model (`phase: 'model'`). */
      toolName?: string;
      /** Milliseconds since this phase started. */
      elapsedMs: number;
      /** Characters the model has streamed so far this step (text + tool arguments). */
      outputChars?: number;
    }
  /** Agent mode: the model asked to run a tool. */
  | { type: 'tool-call'; id: string; name: string; input: Record<string, unknown> }
  /**
   * Agent mode: the tool finished (or failed — the model then self-corrects). `op` is the
   * edit this call produced, if any — the same record `agent-complete` later lists — so a
   * client can keep the work done so far when the stream drops before completing.
   */
  | {
      type: 'tool-result';
      id: string;
      name: string;
      ok: boolean;
      summary: string;
      op?: AgentOpRecord;
    }
  /** Agent mode terminal event: the patch the client replays through the store. */
  | { type: 'agent-complete'; result: AiAgentRunResult }
  | { type: 'error'; error: { code: string; message: string } };

export type AiAgentProgress = Omit<Extract<AiStreamEvent, { type: 'agent-progress' }>, 'type'>;

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
  onAgentProgress?: (progress: AiAgentProgress) => void;
  onToolCall?: (call: { id: string; name: string; input: Record<string, unknown> }) => void;
  onToolResult?: (result: {
    id: string;
    name: string;
    ok: boolean;
    summary: string;
    op?: AgentOpRecord;
  }) => void;
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
  /**
   * `true` when `success` is true but the engine had to substitute a default result
   * (currently: `planPage` when the model's plan JSON could not be parsed).
   */
  usedFallback?: boolean;
  /** Non-fatal diagnostics for a successful response (e.g. `PLAN_FALLBACK`). */
  warnings?: AiErrorDetail[];
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
  /**
   * Images that go with `userPrompt` when `messages` is absent (plan/generate/section/
   * refactor calls). Chat-style calls carry theirs as `AiImageBlock`s inside `messages`.
   * Adapters without vision support ignore it — the URLs are already in the prompt text.
   */
  images?: AiImageBlock[];
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
  /**
   * Streaming only: fired as tool-call arguments arrive, so callers can report progress
   * while the model is still writing a large tool call. `argumentsLength` is the running
   * length of that call's arguments string.
   */
  onToolCallDelta?: (delta: { index: number; name?: string; argumentsLength: number }) => void;
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
  /**
   * Whether `generateStream` also assembles tool calls into its returned result. When
   * true, `KubuildAiAgent` streams each step instead of waiting on one long `generate()`
   * call — keeping the provider connection active and allowing live progress.
   */
  readonly supportsToolStreaming?: boolean;
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

/**
 * An Agent Skill (https://agentskills.io/specification), parsed from a `SKILL.md` — see
 * `parseSkill` / `loadSkillsFromDirectory`. Only `name` + `description` are always in the
 * prompt; `instructions` and `files` load when a request needs the skill.
 */
export interface AiSkill {
  /** 1-64 lowercase letters, digits and single hyphens; matches the skill's folder name. */
  name: string;
  /** What the skill does and when to use it — the model picks skills from this alone. */
  description: string;
  /** The `SKILL.md` body. */
  instructions: string;
  /**
   * Extra text files keyed by path relative to the skill root, e.g. `references/faq.md`.
   * Only the agent can read these (`read_skill_file`); non-agent modes get `instructions`
   * alone, so keep what those modes need in `SKILL.md` itself.
   */
  files?: Record<string, string>;
}

export interface KubuildAiEngineOptions {
  registry?: ComponentRegistryLike;
  adapter: AiProviderAdapter;
  securityLimits?: DocumentSecurityLimits;
  systemPromptPrefix?: string;
  /**
   * Skills the AI may use. The agent sees the catalog and loads skills itself through its
   * `load_skill` / `read_skill_file` tools; chat, plan, generate, section and refactor
   * calls first ask the model which skills (at most 2) fit the request — one short extra
   * call per request — and add those to the system prompt.
   */
  skills?: AiSkill[];
  /**
   * Effect plugins the pages can run (STORA-651) — the same registry the editor gets. When
   * set, the agent sees an effect catalog and a `set_node_effects` tool; configs it writes
   * are validated with each plugin's `parse`.
   */
  effects?: EffectRegistry;
  /** Agent loop step ceiling (STORA-530). Default: 8. */
  maxAgentSteps?: number;
  /**
   * Interval for `agent-progress` events while a step waits on the model or a tool
   * (default 10000). Keep it below the idle timeout of every proxy in front of the stream.
   */
  agentProgressIntervalMs?: number;
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
  | { kind: 'replace-node'; nodeId: string; node: Node }
  /** Replaces the node's whole effect list; `[]` removes it (STORA-651). */
  | { kind: 'set-effects'; nodeId: string; effects: NodeEffect[] };

/** An `AgentOp` plus the metadata the review UI needs before the user hits Apply. */
export interface AgentOpRecord {
  id: string;
  op: AgentOp;
  /** Human-readable one-liner, e.g. `Update props of tombol "cta-btn"`. */
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
  /**
   * Extra host/user instructions, appended AFTER the built-in system prompt (never
   * replacing it — the base prompt carries the output-format, safety and tool rules).
   * Over HTTP, `createAiHandler` caps its length and can disable it entirely
   * (`allowClientInstructions` / `maxClientInstructionsLength`).
   */
  instructions?: string;
  /** @deprecated Alias of `instructions` — appended, never a replacement for the base prompt. */
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
