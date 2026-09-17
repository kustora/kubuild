import type { KubuildAiEngine } from './engine';
import type { KubuildAiAgent } from './agent';
import type { PageDocument } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiChatMessage,
  AiGenerateResponse,
  AiGenerationMode,
  AiStreamEvent,
  PagePlan,
} from '../types';

export interface AiApiRequestBody {
  mode?: AiGenerationMode;
  prompt?: string;
  stylePreference?: string;
  tone?: string;
  locale?: string;
  metadata?: AiGeneratePageRequest['metadata'];
  targetSectionType?: string;
  parentContext?: string;
  node?: AiRefactorNodeRequest['node'];
  instruction?: string;
  stream?: boolean;
  messages?: AiChatMessage[];
  currentDocument?: PageDocument;
  selectedNodeId?: string;
  /** Prior conversation history from chat mode so generator keeps full context. */
  conversationHistory?: AiChatMessage[];
  sectionCount?: number | { min?: number; max?: number };
  plan?: PagePlan;
  /** Agent mode (STORA-530) — the snapshot the agent reads and patches. */
  document?: PageDocument;
  maxSteps?: number;
}

export async function processAiRequest(
  engine: KubuildAiEngine,
  body: unknown,
  signal?: AbortSignal,
  agent?: KubuildAiAgent,
): Promise<{ status: number; response: AiGenerateResponse<unknown> }> {
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      response: {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Request body must be a valid JSON object',
        },
      },
    };
  }

  const payload = body as AiApiRequestBody;
  const mode = payload.mode || 'full-page';

  if (mode === 'full-page') {
    if (!payload.prompt || typeof payload.prompt !== 'string') {
      return {
        status: 400,
        response: {
          success: false,
          error: {
            code: 'INVALID_PROMPT',
            message: '"prompt" is required for full-page generation',
          },
        },
      };
    }
    const result = await engine.generatePage(
      {
        prompt: payload.prompt,
        stylePreference: payload.stylePreference,
        tone: payload.tone,
        locale: payload.locale,
        metadata: payload.metadata,
        conversationHistory: payload.conversationHistory ?? payload.messages,
        sectionCount: payload.sectionCount,
        plan: payload.plan,
      },
      { signal },
    );
    return {
      status: result.success ? 200 : 500,
      response: result,
    };
  }

  if (mode === 'section') {
    if (!payload.prompt || typeof payload.prompt !== 'string') {
      return {
        status: 400,
        response: {
          success: false,
          error: {
            code: 'INVALID_PROMPT',
            message: '"prompt" is required for section generation',
          },
        },
      };
    }
    const result = await engine.generateSection(
      {
        prompt: payload.prompt,
        stylePreference: payload.stylePreference,
        targetSectionType: payload.targetSectionType,
        parentContext: payload.parentContext,
      },
      { signal },
    );
    return {
      status: result.success ? 200 : 500,
      response: result,
    };
  }

  if (mode === 'refactor') {
    if (!payload.node || !payload.instruction) {
      return {
        status: 400,
        response: {
          success: false,
          error: {
            code: 'INVALID_REFACTOR_PARAMS',
            message: '"node" and "instruction" are required for refactoring',
          },
        },
      };
    }
    const result = await engine.refactorNode(
      {
        node: payload.node,
        instruction: payload.instruction,
        stylePreference: payload.stylePreference,
      },
      { signal },
    );
    return {
      status: result.success ? 200 : 500,
      response: result,
    };
  }

  if (mode === 'chat') {
    if (!payload.messages || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      return {
        status: 400,
        response: {
          success: false,
          error: {
            code: 'INVALID_CHAT_PARAMS',
            message: '"messages" array is required and must not be empty for chat mode',
          },
        },
      };
    }
    const result = await engine.chat(
      {
        messages: payload.messages,
        currentDocument: payload.currentDocument,
        selectedNodeId: payload.selectedNodeId,
      },
      { signal },
    );
    return {
      status: result.success ? 200 : 500,
      response: result,
    };
  }

  if (mode === 'agent') {
    const validationError = validateAgentPayload(payload, agent);
    if (validationError) {
      return { status: validationError.status, response: validationError.response };
    }

    const result = await agent!.execute(
      {
        messages: payload.messages!,
        document: payload.document!,
        selectedNodeId: payload.selectedNodeId,
        stylePreference: payload.stylePreference,
        maxSteps: payload.maxSteps,
      },
      { signal },
    );

    return {
      status: result.stoppedBy === 'error' ? 500 : 200,
      response: { success: result.stoppedBy !== 'error', data: result },
    };
  }

  if (mode === 'plan') {
    if (!payload.prompt || typeof payload.prompt !== 'string') {
      return {
        status: 400,
        response: {
          success: false,
          error: {
            code: 'INVALID_PROMPT',
            message: '"prompt" is required for planning mode',
          },
        },
      };
    }
    const result = await engine.planPage(
      {
        prompt: payload.prompt,
        stylePreference: payload.stylePreference,
        tone: payload.tone,
        locale: payload.locale,
        sectionCount: payload.sectionCount,
        conversationHistory: payload.conversationHistory ?? payload.messages,
      },
      { signal },
    );
    return {
      status: result.success ? 200 : 500,
      response: result,
    };
  }

  return {
    status: 400,
    response: {
      success: false,
      error: {
        code: 'UNKNOWN_MODE',
        message: `Unsupported mode: ${String(mode)}. Supported modes: 'full-page', 'section', 'refactor', 'chat', 'agent', 'plan'`,
      },
    },
  };
}

/**
 * Shared validation for agent-mode requests (STORA-530) — used by both the JSON and the
 * SSE paths so they can never disagree about what a valid agent request looks like.
 * Returns `null` when the payload is good.
 */
function validateAgentPayload(
  payload: AiApiRequestBody,
  agent?: KubuildAiAgent,
): { status: number; response: AiGenerateResponse<never> } | null {
  if (!agent) {
    return {
      status: 501,
      response: {
        success: false,
        error: {
          code: 'AGENT_NOT_CONFIGURED',
          message:
            'Agent mode is not enabled on this endpoint. Pass a KubuildAiAgent to createAiHandler to enable it.',
        },
      },
    };
  }

  if (!payload.messages || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return {
      status: 400,
      response: {
        success: false,
        error: {
          code: 'INVALID_AGENT_PARAMS',
          message: '"messages" array is required and must not be empty for agent mode',
        },
      },
    };
  }

  if (!payload.document || !payload.document.document) {
    return {
      status: 400,
      response: {
        success: false,
        error: {
          code: 'INVALID_AGENT_PARAMS',
          message: '"document" (the current PageDocument) is required for agent mode',
        },
      },
    };
  }

  return null;
}

/**
 * Options for {@link createAiHandler} (STORA-519).
 */
export interface CreateAiHandlerOptions {
  /**
   * Enables agent mode (STORA-530) on this endpoint. Without it, `mode: 'agent'` requests
   * are answered with a 501 rather than silently falling back to chat.
   */
  agent?: KubuildAiAgent;

  /**
   * Optional hook invoked with the raw incoming `Request` before it ever reaches the
   * engine/provider — the place to plug in host-owned auth and/or rate-limiting without
   * forking the handler.
   *
   * - Return a `Response` (or a Promise resolving to one) to reject/short-circuit the
   *   request — e.g. `new Response(..., { status: 401 })` or `429` — that response is
   *   returned as-is and the engine/provider is never invoked.
   * - Return `void`/`undefined` (or a Promise resolving to that) to allow the request to
   *   continue through the normal handler logic unchanged.
   *
   * Omitting this option entirely preserves the exact pre-STORA-519 behavior.
   */
  beforeRequest?: (request: Request) => Promise<Response | void> | Response | void;
}

/**
 * Pipes an `AiStreamEvent` iterable out as an SSE response (STORA-530).
 *
 * All three streaming modes (`streamPage`, `chatStream`, agent `run`) emit the same event
 * shape over the same transport, so they share one encoder instead of three near-identical
 * `ReadableStream` blocks. A throw mid-stream is delivered as a final `error` event rather
 * than tearing down the connection, so the client can render it in place.
 */
function sseResponse(
  events: AsyncIterable<AiStreamEvent>,
  errorCode: string,
): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ type: 'error', error: { code: errorCode, message } })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

/**
 * Creates a standard Web Fetch API Request handler with optional SSE streaming support.
 *
 * Plug-and-play for Next.js App Router (route.ts), SvelteKit, Remix, Astro, Bun, etc.
 *
 * Example:
 * ```ts
 * export const POST = createAiHandler(engine);
 * ```
 *
 * Example with an auth/rate-limit hook (STORA-519):
 * ```ts
 * export const POST = createAiHandler(engine, {
 *   beforeRequest: async (request) => {
 *     if (!isAuthorized(request)) {
 *       return new Response('Unauthorized', { status: 401 });
 *     }
 *     // returning nothing lets the request proceed as normal
 *   },
 * });
 * ```
 */
export function createAiHandler(engine: KubuildAiEngine, options?: CreateAiHandlerOptions) {
  return async (request: Request): Promise<Response> => {
    try {
      if (options?.beforeRequest) {
        const hookResult = await options.beforeRequest(request);
        if (hookResult instanceof Response) {
          return hookResult;
        }
      }

      if (request.method !== 'POST') {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'METHOD_NOT_ALLOWED',
              message: 'Only POST requests are accepted',
            },
          }),
          {
            status: 405,
            headers: {
              'Content-Type': 'application/json',
              Allow: 'POST',
            },
          },
        );
      }

      const body = (await request.json().catch(() => null)) as AiApiRequestBody | null;

      // Handle opt-in SSE Streaming
      if (body && typeof body === 'object' && body.stream === true) {
        const mode = body.mode || 'full-page';

        // Agent streaming (STORA-530) — emits agent-step/tool-call/tool-result events as
        // the loop runs, then a terminal agent-complete carrying the ops to replay.
        if (mode === 'agent') {
          const validationError = validateAgentPayload(body, options?.agent);
          if (validationError) {
            return new Response(JSON.stringify(validationError.response), {
              status: validationError.status,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          return sseResponse(
            options!.agent!.run(
              {
                messages: body.messages!,
                document: body.document!,
                selectedNodeId: body.selectedNodeId,
                stylePreference: body.stylePreference,
                maxSteps: body.maxSteps,
              },
              { signal: request.signal },
            ),
            'AGENT_STREAM_ERROR',
          );
        }

        // Token-level chat streaming (STORA-515) — routed separately from full-page
        // streaming below since it needs `messages`, not `prompt`.
        if (mode === 'chat') {
          if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
            return new Response(
              JSON.stringify({
                success: false,
                error: {
                  code: 'INVALID_CHAT_PARAMS',
                  message: '"messages" array is required and must not be empty for chat mode',
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            );
          }

          return sseResponse(
            engine.chatStream(
              {
                messages: body.messages!,
                currentDocument: body.currentDocument,
                selectedNodeId: body.selectedNodeId,
              },
              { signal: request.signal },
            ),
            'CHAT_STREAM_ERROR',
          );
        }

        if (!body.prompt || typeof body.prompt !== 'string') {
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'INVALID_PROMPT',
                message: '"prompt" is required for streaming generation',
              },
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        return sseResponse(
          engine.streamPage(
            {
              prompt: body.prompt!,
              stylePreference: body.stylePreference,
              tone: body.tone,
              locale: body.locale,
              metadata: body.metadata,
              conversationHistory: body.conversationHistory ?? body.messages,
              sectionCount: body.sectionCount,
              plan: body.plan,
            },
            { signal: request.signal },
          ),
          'STREAM_ERROR',
        );
      }

      // Default: Standard non-streaming JSON response (Backward-compatible)
      const { status, response } = await processAiRequest(
        engine,
        body,
        request.signal,
        options?.agent,
      );

      return new Response(JSON.stringify(response), {
        status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message,
          },
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  };
}
