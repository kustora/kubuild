import type { KubuildAiEngine } from './engine';
import type {
  AiGeneratePageRequest,
  AiGenerateSectionRequest,
  AiRefactorNodeRequest,
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

  return {
    status: 400,
    response: {
      success: false,
      error: {
        code: 'UNKNOWN_MODE',
        message: `Unsupported mode: ${String(mode)}. Supported modes: 'full-page', 'section', 'refactor'`,
      },
    },
  };
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
 */
export function createAiHandler(engine: KubuildAiEngine) {
  return async (request: Request): Promise<Response> => {
    try {
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
