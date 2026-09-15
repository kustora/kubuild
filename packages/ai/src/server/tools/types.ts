import type { Node, PageDocument } from '@kubuild/schema';
import type { DocumentSecurityLimits } from '@kubuild/core';
import type { AgentOp, AiCompiledComponentSpec, AiToolDefinition } from '../../types';

/**
 * Everything a tool needs to answer or mutate (STORA-530).
 *
 * `document` is the agent's private **snapshot** — never the user's live canvas document.
 * Write tools return an updated snapshot plus an `AgentOp`; the real document is only
 * touched later, on the client, when the user applies the run.
 */
export interface ToolExecutionContext {
  document: PageDocument;
  catalog: AiCompiledComponentSpec[];
  securityLimits?: DocumentSecurityLimits;
  /**
   * Delegate used by `insert_section` to synthesize a section node — wired to
   * `KubuildAiEngine.generateSection` so section generation keeps going through the
   * existing plan/normalize/validate path rather than a second implementation.
   */
  generateSection?: (params: {
    prompt: string;
    parentContext?: string;
  }) => Promise<Node>;
  signal?: AbortSignal;
}

export interface ToolExecutionResult {
  ok: boolean;
  /**
   * Payload handed back to the model as a `tool_result` block. Always a JSON string, so
   * the model sees a uniform shape whether the call succeeded or failed.
   */
  content: unknown;
  /** One-line description for the run timeline / op review UI. */
  summary: string;
  /** Present on a successful write — the patch the client will replay. */
  op?: AgentOp;
  /** Present on a successful write — the snapshot later steps reason about. */
  document?: PageDocument;
}

export interface AgentTool {
  definition: AiToolDefinition;
  /** Read tools never produce ops; write tools always do (when they succeed). */
  kind: 'read' | 'write';
  /**
   * True for tools that can destroy user content. The editor refuses to auto-apply these
   * even when the user has auto-apply turned on.
   */
  destructive?: boolean;
  execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> | ToolExecutionResult;
}
