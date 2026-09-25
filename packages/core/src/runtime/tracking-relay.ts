import {
  TRACKING_RELAY_PROTOCOL_VERSION,
  TrackingRelayRequestSchema,
  type TrackingConfig,
  type TrackEventProvider,
  type TrackingRelayErrorCode,
  type TrackingRelayProviderResult,
  type TrackingRelayRequest,
  type TrackingRelayResponse,
} from '@kubuild/schema';
import {
  dispatchServerTracking,
  type ServerTrackingEvent,
  type TrackingSecretResolver,
} from './server-tracking';

/** Context handed to `getConfig` — use it to look up the trusted config for this page. */
export interface TrackingRelayConfigContext {
  request: Request;
  /** Untrusted hint from the request body; use it only as a lookup key you authorize. */
  documentId?: string;
  /** Untrusted hint from the request body. */
  credentialId?: string;
  provider: TrackEventProvider;
}

export interface CreateTrackingRelayHandlerOptions {
  /**
   * Loads the tracking config from the HOST (database, published page, env, ...).
   * The relay never trusts a config sent in the request body. Return `null` if unknown.
   */
  getConfig: (
    ctx: TrackingRelayConfigContext,
  ) => Promise<TrackingConfig | null | undefined> | TrackingConfig | null | undefined;
  /** Resolves provider secrets by `credentialId` (from the trusted config). */
  resolveSecrets: TrackingSecretResolver;
  /**
   * Allowed browser origins. When set, requests whose `Origin` header is missing or not in
   * the list are rejected with 403, and CORS headers are returned for allowed origins.
   */
  allowedOrigins?: readonly string[] | ((origin: string) => boolean);
  fetchFn?: typeof fetch;
  /** Override client IP extraction (defaults to x-forwarded-for / x-real-ip / cf-connecting-ip). */
  getClientIp?: (request: Request) => string | undefined;
  /** Max accepted body size in bytes (default 64 KiB). */
  maxBodyBytes?: number;
  onLog?: (message: string, data?: unknown) => void;
}

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

function defaultClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

function isOriginAllowed(
  origin: string | null,
  allowed: CreateTrackingRelayHandlerOptions['allowedOrigins'],
): boolean {
  if (!allowed) return true;
  if (!origin) return false;
  if (typeof allowed === 'function') return allowed(origin);
  return allowed.includes(origin);
}

/**
 * Creates a reference tracking relay endpoint using only Web-standard `Request`/`Response`
 * (works in Next.js route handlers, Hono, Bun, Deno, Cloudflare Workers, Node 18+ adapters).
 *
 * Flow: validate origin -> validate body with `TrackingRelayRequestSchema` -> load the trusted
 * config via `getConfig` -> attach client IP / UA from request headers -> `dispatchServerTracking`
 * with `resolveSecrets`. The response follows `TrackingRelayResponseSchema` and never echoes
 * provider response bodies.
 *
 * Non-JS backends can implement the same protocol — see `getTrackingRelayRequestJsonSchema()`.
 */
export function createTrackingRelayHandler(options: CreateTrackingRelayHandlerOptions) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const corsHeaders: Record<string, string> = {};
    if (options.allowedOrigins && origin && isOriginAllowed(origin, options.allowedOrigins)) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin';
    }

    const json = (body: TrackingRelayResponse, status: number, extra?: Record<string, string>) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(extra || {}) },
      });

    const fail = (code: TrackingRelayErrorCode, message: string, status: number, extra?: Record<string, string>) =>
      json({ version: TRACKING_RELAY_PROTOCOL_VERSION, success: false, error: { code, message } }, status, extra);

    if (!isOriginAllowed(origin, options.allowedOrigins)) {
      return fail('FORBIDDEN_ORIGIN', 'Origin is not allowed', 403);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '600',
        },
      });
    }

    if (request.method !== 'POST') {
      return fail('METHOD_NOT_ALLOWED', 'Only POST requests are accepted', 405, { Allow: 'POST, OPTIONS' });
    }

    try {
      const text = await request.text();
      if (text.length > maxBodyBytes) {
        return fail('INVALID_REQUEST', `Request body exceeds ${maxBodyBytes} bytes`, 413);
      }

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return fail('INVALID_REQUEST', 'Request body must be valid JSON', 400);
      }

      if (
        raw &&
        typeof raw === 'object' &&
        'version' in raw &&
        (raw as { version: unknown }).version !== TRACKING_RELAY_PROTOCOL_VERSION
      ) {
        return fail(
          'UNSUPPORTED_VERSION',
          `Unsupported relay protocol version; expected ${TRACKING_RELAY_PROTOCOL_VERSION}`,
          400,
        );
      }

      const parsed = TrackingRelayRequestSchema.safeParse(raw);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        return fail('INVALID_REQUEST', `Invalid relay request: ${issues}`, 400);
      }
      const body: TrackingRelayRequest = parsed.data;

      // Trusted config comes from the host, never from the body.
      const config = await options.getConfig({
        request,
        documentId: body.documentId,
        credentialId: body.credentialId,
        provider: body.provider,
      });
      if (!config) {
        return fail('CONFIG_NOT_FOUND', 'No tracking configuration found for this page', 404);
      }

      const clientIp = (options.getClientIp ?? defaultClientIp)(request);
      const clientUserAgent = request.headers.get('user-agent') || undefined;

      // Client-supplied network identity is not trusted; use what the server observed.
      const userData = { ...(body.event.userData || {}) } as NonNullable<ServerTrackingEvent['userData']>;
      delete userData.clientIp;
      delete userData.clientUserAgent;

      const event: ServerTrackingEvent = { ...body.event, userData };

      const outcome = await dispatchServerTracking(event, config, {
        resolveSecrets: options.resolveSecrets,
        documentId: body.documentId,
        provider: body.provider,
        fetchFn: options.fetchFn,
        clientIp,
        clientUserAgent,
        onLog: options.onLog,
      });

      const results: Record<string, TrackingRelayProviderResult> = {};
      for (const [key, r] of Object.entries(outcome.results)) {
        results[key] = {
          provider: r.provider,
          success: r.success,
          ...(r.status !== undefined ? { status: r.status } : {}),
          ...(r.skipped ? { skipped: true } : {}),
          ...(r.reason ? { reason: r.reason } : {}),
          ...(r.error ? { error: r.error } : {}),
        };
      }

      return json(
        {
          version: TRACKING_RELAY_PROTOCOL_VERSION,
          success: outcome.success,
          eventId: outcome.eventId,
          ...(outcome.skipped ? { skipped: true } : {}),
          ...(outcome.reason ? { reason: outcome.reason } : {}),
          results,
        },
        200,
      );
    } catch (err: unknown) {
      options.onLog?.('[Tracking relay] internal error', err);
      return fail('INTERNAL_ERROR', 'Tracking relay failed', 500);
    }
  };
}
