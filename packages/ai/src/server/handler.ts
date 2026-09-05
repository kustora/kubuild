import type { KubuildAiEngine } from './engine';
import type { PageDocument } from '@kubuild/schema';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
  AiChatMessage,
  AiGenerateResponse,
  AiGenerationMode,
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
}

export async function processAiRequest(
  engine: KubuildAiEngine,
  body: unknown,
  signal?: AbortSignal,
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

  return {
    status: 400,
    response: {
      success: false,
      error: {
        code: 'UNKNOWN_MODE',
        message: `Unsupported mode: ${String(mode)}. Supported modes: 'full-page', 'section', 'refactor', 'chat'`,
      },
    },
  };
}

/**
 * Options for {@link createAiHandler} (STORA-519).
 */
export interface CreateAiHandlerOptions {
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

          const encoder = new TextEncoder();
          const readable = new ReadableStream({
            async start(controller) {
              try {
                for await (const event of engine.chatStream(
                  {
                    messages: body.messages!,
                    currentDocument: body.currentDocument,
                    selectedNodeId: body.selectedNodeId,
                  },
                  { signal: request.signal },
                )) {
                  controller.enqueue(
                    encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
                  );
                }
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                controller.enqueue(
                  encoder.encode(
                    `event: error\ndata: ${JSON.stringify({ type: 'error', error: { code: 'CHAT_STREAM_ERROR', message } })}\n\n`,
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

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const event of engine.streamPage(
                {
                  prompt: body.prompt!,
                  stylePreference: body.stylePreference,
                  tone: body.tone,
                  locale: body.locale,
                  metadata: body.metadata,
                },
                { signal: request.signal },
              )) {
                controller.enqueue(
                  encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
                );
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ type: 'error', error: { code: 'STREAM_ERROR', message } })}\n\n`,
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

      // Default: Standard non-streaming JSON response (Backward-compatible)
      const { status, response } = await processAiRequest(
        engine,
        body,
        request.signal,
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
