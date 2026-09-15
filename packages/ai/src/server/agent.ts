import type { PageDocument } from '@kubuild/schema';
import type {
  AgentOpRecord,
  AiAgentRequest,
  AiAgentRunResult,
  AiChatMessage,
  AiCompiledComponentSpec,
  AiContentBlock,
  AiStreamEvent,
  AiToolUseBlock,
  KubuildAiEngineOptions,
} from '../types';
import { buildAgentSystemPrompt, compileComponentCatalog } from '../core/prompt-compiler';
import { getMessageText } from '../core/messages';
import type { KubuildAiEngine } from './engine';
import { createDocumentTools, toToolDefinitions, type AgentTool } from './tools';

export interface KubuildAiAgentOptions extends KubuildAiEngineOptions {
  /**
   * Engine used by the `insert_section` tool. Optional: without it the agent still runs,
   * and `insert_section` returns a "not available" tool error telling the model to build
   * the section with `insert_component` instead.
   */
  engine?: KubuildAiEngine;
  /** Overrides the default tool set (read + write document tools). */
  tools?: AgentTool[];
}

/** Ceiling on reasoning steps per run — the primary runaway-cost guard. */
const DEFAULT_MAX_STEPS = 8;

/** Ceiling on tool calls the model may request within a single step. */
const MAX_TOOL_CALLS_PER_STEP = 8;

function toolResultMessage(blocks: AiContentBlock[]): AiChatMessage {
  return { role: 'user', content: blocks, timestamp: Date.now() };
}

/**
 * The page-editing agent (STORA-530).
 *
 * Unlike every `KubuildAiEngine` method, which is a single request/response, this runs a
 * loop: the model reads the page through tools, makes a surgical change through tools, and
 * stops. The document it mutates is a private **snapshot** — the run's output is an ordered
 * list of `AgentOp`s that the editor replays through its own store actions, so an agent
 * edit lands in the command engine and the undo stack exactly like a manual edit.
 *
 * Nothing here ever touches the user's live document.
 */
export class KubuildAiAgent {
  private options: KubuildAiAgentOptions;
  private catalog: AiCompiledComponentSpec[];
  private tools: AgentTool[];

  constructor(options: KubuildAiAgentOptions) {
    if (!options.adapter) {
      throw new Error('KubuildAiAgent requires an adapter instance');
    }
    if (!options.adapter.supportsTools) {
      // Failing loudly beats running a tool-less loop that can never edit anything: the
      // model would just describe the change it "made" and the user would get no ops.
      throw new Error(
        `Adapter "${options.adapter.name}" does not support tool calling, which agent mode requires. Use an adapter with supportsTools === true (e.g. OpenAiAdapter).`,
      );
    }
    this.options = options;
    this.catalog = compileComponentCatalog(options.registry);
    this.tools = options.tools ?? createDocumentTools();
  }

  get adapterName(): string {
    return this.options.adapter.name;
  }

  refreshCatalog(): void {
    this.catalog = compileComponentCatalog(this.options.registry);
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: unknown): void {
    if (this.options.logger) {
      this.options.logger(level, message, meta);
    } else if (this.options.debug) {
      console.log(`[KUBUILD-AGENT ${level.toUpperCase()}] ${message}`, meta !== undefined ? meta : '');
    }
  }

  private findTool(name: string): AgentTool | undefined {
    return this.tools.find((tool) => tool.definition.name === name);
  }

  /**
   * Runs one tool call against the current snapshot.
   *
   * An unknown tool name is answered with a normal (failed) tool result rather than an
   * exception, for the same reason bad arguments are: it gives the model a chance to pick a
   * real tool on the next step instead of killing the run.
   */
  private async executeToolCall(
    call: AiToolUseBlock,
    snapshot: PageDocument,
    signal?: AbortSignal,
  ): Promise<{
    block: AiContentBlock;
    ok: boolean;
    summary: string;
    snapshot: PageDocument;
    op?: AgentOpRecord;
  }> {
    const tool = this.findTool(call.name);

    if (!tool) {
      const available = this.tools.map((t) => t.definition.name).join(', ');
      return {
        ok: false,
        summary: `Tool "${call.name}" tidak dikenal`,
        snapshot,
        block: {
          type: 'tool_result',
          toolUseId: call.id,
          isError: true,
          content: JSON.stringify({
            ok: false,
            error: `Unknown tool "${call.name}". Available tools: ${available}.`,
          }),
        },
      };
    }

    let result;
    try {
      result = await tool.execute(call.input ?? {}, {
        document: snapshot,
        catalog: this.catalog,
        securityLimits: this.options.securityLimits,
        signal,
        generateSection: this.options.engine
          ? async ({ prompt, parentContext }) => {
              const response = await this.options.engine!.generateSection(
                { prompt, parentContext },
                { signal },
              );
              if (!response.success || !response.data) {
                throw new Error(response.error?.message ?? 'Section generation failed');
              }
              return response.data;
            }
          : undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('error', `Tool "${call.name}" threw`, message);
      return {
        ok: false,
        summary: `Tool "${call.name}" error`,
        snapshot,
        block: {
          type: 'tool_result',
          toolUseId: call.id,
          isError: true,
          content: JSON.stringify({ ok: false, error: message }),
        },
      };
    }

    const op: AgentOpRecord | undefined =
      result.ok && result.op
        ? {
            id: call.id,
            op: result.op,
            summary: result.summary,
            destructive: tool.destructive === true,
          }
        : undefined;

    return {
      ok: result.ok,
      summary: result.summary,
      snapshot: result.document ?? snapshot,
      op,
      block: {
        type: 'tool_result',
        toolUseId: call.id,
        isError: !result.ok,
        content: JSON.stringify(result.content),
      },
    };
  }

  /**
   * Executes one agent turn, streaming progress as `AiStreamEvent`s and ending with a
   * terminal `agent-complete` (or `error`) event.
   *
   * The loop stops as soon as the model returns a turn with no tool calls — that final
   * message is the summary shown to the user. It also stops at `maxSteps` (cost guard) or
   * on abort, and reports which of those happened via `stoppedBy` so the UI can say
   * "stopped after N steps" rather than pretending the work is finished.
   */
  async *run(
    request: AiAgentRequest,
    context?: { signal?: AbortSignal },
  ): AsyncIterable<AiStreamEvent> {
    const maxSteps = request.maxSteps ?? this.options.maxAgentSteps ?? DEFAULT_MAX_STEPS;
    const signal = context?.signal;

    if (!request.messages || request.messages.length === 0) {
      yield {
        type: 'error',
        error: { code: 'INVALID_AGENT_REQUEST', message: '"messages" must not be empty' },
      };
      return;
    }

    if (!request.document?.document) {
      yield {
        type: 'error',
        error: { code: 'INVALID_AGENT_REQUEST', message: '"document" is required for agent mode' },
      };
      return;
    }

    // The system prompt is built once from the *initial* document: the outline the model
    // starts from stays stable across steps, which keeps the prompt prefix cacheable. Edits
    // made mid-run are reflected in tool results, and the model can always call
    // get_page_outline for a refreshed view.
    const systemPrompt = buildAgentSystemPrompt({
      catalog: this.catalog,
      document: request.document,
      selectedNodeId: request.selectedNodeId,
      prefix: this.options.systemPromptPrefix,
      stylePreference: request.stylePreference,
      additionalContext: request.systemPrompt,
    });

    const toolDefinitions = toToolDefinitions(this.tools);
    const messages: AiChatMessage[] = [...request.messages];
    const ops: AgentOpRecord[] = [];

    let snapshot: PageDocument = request.document;
    let promptTokens = 0;
    let completionTokens = 0;
    let summary = '';
    let stoppedBy: AiAgentRunResult['stoppedBy'] = 'complete';
    let step = 0;

    this.log('info', `[AGENT] run started (maxSteps=${maxSteps}, tools=${toolDefinitions.length})`);

    try {
      while (step < maxSteps) {
        if (signal?.aborted) {
          stoppedBy = 'aborted';
          break;
        }

        step++;
        yield { type: 'agent-step', step, maxSteps };

        const result = await this.options.adapter.generate({
          systemPrompt,
          userPrompt: getMessageText(request.messages[request.messages.length - 1]),
          messages,
          tools: toolDefinitions,
          toolChoice: 'auto',
          signal,
        });

        promptTokens += result.usage?.promptTokens ?? 0;
        completionTokens += result.usage?.completionTokens ?? 0;

        const toolCalls = result.toolCalls ?? [];

        if (toolCalls.length === 0) {
          summary = result.text.trim();
          stoppedBy = 'complete';
          this.log('info', `[AGENT] finished after ${step} step(s) with ${ops.length} op(s)`);
          break;
        }

        // Record the assistant turn (text + tool calls) before the results, so the next
        // request replays a well-formed call/result pairing.
        const assistantBlocks: AiContentBlock[] = [];
        if (result.text.trim()) {
          assistantBlocks.push({ type: 'text', text: result.text });
        }
        assistantBlocks.push(...toolCalls);
        messages.push({ role: 'assistant', content: assistantBlocks, timestamp: Date.now() });

        const capped = toolCalls.slice(0, MAX_TOOL_CALLS_PER_STEP);
        const resultBlocks: AiContentBlock[] = [];

        for (const call of capped) {
          if (signal?.aborted) {
            stoppedBy = 'aborted';
            break;
          }

          yield { type: 'tool-call', id: call.id, name: call.name, input: call.input ?? {} };

          const executed = await this.executeToolCall(call, snapshot, signal);
          snapshot = executed.snapshot;
          resultBlocks.push(executed.block);
          if (executed.op) ops.push(executed.op);

          yield {
            type: 'tool-result',
            id: call.id,
            name: call.name,
            ok: executed.ok,
            summary: executed.summary,
          };
        }

        // Every tool call must get a matching result, or the next provider request is
        // malformed — so calls dropped by the per-step cap or by an abort are answered
        // explicitly rather than left dangling.
        for (const call of toolCalls.slice(capped.length)) {
          resultBlocks.push({
            type: 'tool_result',
            toolUseId: call.id,
            isError: true,
            content: JSON.stringify({
              ok: false,
              error: `Too many tool calls in one step (limit ${MAX_TOOL_CALLS_PER_STEP}). This call was not executed — request it again in the next step.`,
            }),
          });
        }

        messages.push(toolResultMessage(resultBlocks));

        if (stoppedBy === 'aborted') break;
      }

      if (stoppedBy === 'complete' && step >= maxSteps && !summary) {
        stoppedBy = 'max-steps';
        summary = `Berhenti setelah ${maxSteps} langkah. ${ops.length} perubahan sudah disiapkan — periksa hasilnya lalu minta lanjutan bila perlu.`;
        this.log('warn', `[AGENT] hit maxSteps (${maxSteps}) with ${ops.length} op(s)`);
      }

      if (stoppedBy === 'aborted' && !summary) {
        summary = `Dihentikan. ${ops.length} perubahan sempat disiapkan.`;
      }

      yield {
        type: 'agent-complete',
        result: {
          ops,
          summary,
          stepsUsed: step,
          stoppedBy,
          usage: { promptTokens, completionTokens },
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('error', `[AGENT] run failed: ${message}`);
      // Ops produced before the failure are still valid and still reviewable — dropping
      // them would silently discard work the user can see happening in the timeline.
      yield {
        type: 'agent-complete',
        result: {
          ops,
          summary: summary || `Terjadi error: ${message}`,
          stepsUsed: step,
          stoppedBy: 'error',
          usage: { promptTokens, completionTokens },
        },
      };
      yield { type: 'error', error: { code: 'AGENT_ERROR', message } };
    }
  }

  /** Non-streaming convenience wrapper — drains `run()` and returns its terminal result. */
  async execute(
    request: AiAgentRequest,
    context?: { signal?: AbortSignal },
  ): Promise<AiAgentRunResult> {
    let final: AiAgentRunResult | null = null;
    let error: { code: string; message: string } | null = null;

    for await (const event of this.run(request, context)) {
      if (event.type === 'agent-complete') final = event.result;
      if (event.type === 'error') error = event.error;
    }

    if (final) return final;
    return {
      ops: [],
      summary: error?.message ?? 'Agent produced no result',
      stepsUsed: 0,
      stoppedBy: 'error',
    };
  }
}
