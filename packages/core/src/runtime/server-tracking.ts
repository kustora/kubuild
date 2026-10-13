import type {
  TrackingConfig,
  MetaTrackingProviderConfig,
  GoogleTrackingProviderConfig,
  TikTokTrackingProviderConfig,
  CustomTrackingProviderConfig,
  MetaTrackingSecrets,
  GoogleTrackingSecrets,
  TikTokTrackingSecrets,
  CustomTrackingSecrets,
  TrackingProviderSecrets,
  ServerTrackingProviderType,
  TrackEventProvider,
  TrackingPixel,
  TrackingPixelInput,
} from '@kubuild/schema';
import { resolveTrackingConfig, selectTrackingPixels } from './tracking-pixels.js';

/**
 * Reference passed to a host `TrackingSecretResolver`. `credentialId` comes from the trusted
 * tracking config (`pixels[].credentialId`), never from an untrusted request.
 */
export interface TrackingSecretRef {
  provider: ServerTrackingProviderType;
  credentialId?: string;
  documentId?: string;
}

/**
 * Host-provided function that returns the secret material for one provider, or `null` when the
 * host has none. Implement it against any secret store (env vars, KMS, DB, Vault, ...).
 * A missing secret makes the provider be skipped with a reason — it never throws.
 */
export type TrackingSecretResolver = (
  ref: TrackingSecretRef,
) => Promise<TrackingProviderSecrets | null | undefined> | TrackingProviderSecrets | null | undefined;

/**
 * Normalized Server Tracking Event
 */
export interface ServerTrackingEvent {
  eventName: string;
  eventType?: 'standard' | 'custom';
  eventId?: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'app' | 'system_generated';
  params?: Record<string, unknown>;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    gender?: string;
    dateOfBirth?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    clientIp?: string;
    clientUserAgent?: string;
    fbp?: string;
    fbc?: string;
    externalId?: string;
    [key: string]: unknown;
  };
  customData?: Record<string, unknown>;
}

/**
 * Result of a single provider delivery
 */
export interface TrackingDeliveryResult {
  provider: string;
  /** Pixel entry id (`TrackingPixel.id`) the result belongs to, when dispatched per pixel. */
  pixelId?: string;
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  skipped?: boolean;
  /** Why the provider was skipped (e.g. no secret resolved). */
  reason?: string;
}

/**
 * Aggregate result from dispatchServerTracking
 */
export interface ServerTrackingDispatchResult {
  success: boolean;
  eventId: string;
  skipped?: boolean;
  reason?: string;
  /** Keyed `"<provider>:<pixel entry id>"`. */
  results: Record<string, TrackingDeliveryResult>;
}

/**
 * Options for configuring server tracking dispatch
 */
export interface ServerTrackingOptions {
  /**
   * Resolves provider secrets by `credentialId`. The ONLY way secrets reach the dispatcher —
   * the document never contains them. Without it, every server provider is skipped.
   */
  resolveSecrets?: TrackingSecretResolver;
  /** Host document id, forwarded to `resolveSecrets`. */
  documentId?: string;
  /** Restrict dispatch to one provider ('all' by default). 'gtm' is client-only. */
  provider?: TrackEventProvider;
  /** Restrict dispatch to these pixel entry ids (narrows the config, never adds to it). */
  pixelIds?: readonly string[];
  /**
   * Host pixels merged in through `resolveTrackingConfig` (subject to the config's
   * `inherit` settings). Omit when `config` is already resolved.
   */
  inheritedPixels?: readonly TrackingPixelInput[];
  fetchFn?: typeof fetch;
  clientIp?: string;
  clientUserAgent?: string;
  sourceUrl?: string;
  simulateInDebug?: boolean;
  onLog?: (message: string, data?: unknown) => void;
}

/**
 * Normalizes an email string (lowercase, trim) according to Meta CAPI specification.
 */
export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/**
 * Normalizes a phone number (removes non-digits, strips leading zeros if needed) per CAPI spec.
 */
export function normalizePhone(phone: string): string {
  return (phone || '').replace(/[^0-9]/g, '');
}

/**
 * Normalizes text names (trim, lowercase).
 */
export function normalizeText(text: string): string {
  return (text || '').trim().toLowerCase();
}

/**
 * Generates a SHA-256 hash formatted as a hex string.
 * Uses universal Web Crypto API (supported in Node 18+, Bun, Deno, and modern browsers).
 */
export async function hashSha256(value: string): Promise<string> {
  const normalized = (value || '').trim();
  if (!normalized) return '';

  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments where crypto.subtle is not accessible
  throw new Error('Web Crypto API (crypto.subtle) is not available in current runtime environment.');
}

/**
 * Generates a unique deduplication event ID.
 */
export function generateTrackingEventId(prefix = 'evt'): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${timestamp}_${randomPart}`;
}

/**
 * Dispatches an event to Meta Conversions API (CAPI).
 * Spec: https://developers.facebook.com/docs/marketing-api/conversions-api
 */
export async function sendMetaCapiEvent(
  event: ServerTrackingEvent,
  config: MetaTrackingProviderConfig,
  secrets: MetaTrackingSecrets | null | undefined,
  options?: ServerTrackingOptions,
): Promise<TrackingDeliveryResult> {
  const fetcher = options?.fetchFn || globalThis.fetch;
  if (!config.pixelId) {
    return {
      provider: 'meta',
      success: false,
      error: 'Meta Pixel ID is missing',
    };
  }

  // Prepare hashed user data
  const rawUserData = event.userData || {};
  const hashedUserData: Record<string, unknown> = {};

  if (rawUserData.email) {
    hashedUserData.em = [await hashSha256(normalizeEmail(String(rawUserData.email)))];
  }
  if (rawUserData.phone) {
    hashedUserData.ph = [await hashSha256(normalizePhone(String(rawUserData.phone)))];
  }
  if (rawUserData.firstName) {
    hashedUserData.fn = [await hashSha256(normalizeText(String(rawUserData.firstName)))];
  }
  if (rawUserData.lastName) {
    hashedUserData.ln = [await hashSha256(normalizeText(String(rawUserData.lastName)))];
  }
  if (rawUserData.city) {
    hashedUserData.ct = [await hashSha256(normalizeText(String(rawUserData.city)))];
  }
  if (rawUserData.state) {
    hashedUserData.st = [await hashSha256(normalizeText(String(rawUserData.state)))];
  }
  if (rawUserData.zip) {
    hashedUserData.zp = [await hashSha256(normalizeText(String(rawUserData.zip)))];
  }
  if (rawUserData.country) {
    hashedUserData.country = [await hashSha256(normalizeText(String(rawUserData.country)))];
  }

  // Client IP & User Agent (unhashed per Meta spec)
  const clientIp = rawUserData.clientIp || options?.clientIp;
  if (clientIp) hashedUserData.client_ip_address = clientIp;

  const clientUserAgent = rawUserData.clientUserAgent || options?.clientUserAgent;
  if (clientUserAgent) hashedUserData.client_user_agent = clientUserAgent;

  if (rawUserData.fbp) hashedUserData.fbp = rawUserData.fbp;
  if (rawUserData.fbc) hashedUserData.fbc = rawUserData.fbc;
  if (rawUserData.externalId) {
    hashedUserData.external_id = [await hashSha256(String(rawUserData.externalId))];
  }

  const eventTime = event.eventTime || Math.floor(Date.now() / 1000);
  const eventSourceUrl = event.eventSourceUrl || options?.sourceUrl;

  const capiPayload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: eventTime,
        event_id: event.eventId,
        event_source_url: eventSourceUrl,
        action_source: event.actionSource || 'website',
        user_data: hashedUserData,
        custom_data: {
          ...(event.params || {}),
          ...(event.customData || {}),
        },
      },
    ],
  };

  if (config.testEventCode) {
    capiPayload.test_event_code = config.testEventCode;
  }

  if (options?.simulateInDebug) {
    options.onLog?.('[Meta CAPI SIMULATED]', capiPayload);
    return { provider: 'meta', success: true, data: { simulated: true, payload: capiPayload } };
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(config.pixelId)}/events`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (!secrets?.capiAccessToken) {
      return skippedResult('meta', 'No Meta CAPI access token resolved for this credential');
    }
    headers['Authorization'] = `Bearer ${secrets.capiAccessToken}`;

    const res = await fetcher(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(capiPayload),
    });

    const resJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        provider: 'meta',
        success: false,
        status: res.status,
        error: (resJson as { error?: { message?: string } })?.error?.message || `HTTP ${res.status}`,
        data: resJson,
      };
    }

    return {
      provider: 'meta',
      success: true,
      status: res.status,
      data: resJson,
    };
  } catch (err: unknown) {
    return {
      provider: 'meta',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Dispatches an event to TikTok Events API.
 * Spec: https://business-api.tiktok.com/portal/docs
 */
export async function sendTikTokEventsApi(
  event: ServerTrackingEvent,
  config: TikTokTrackingProviderConfig,
  secrets: TikTokTrackingSecrets | null | undefined,
  options?: ServerTrackingOptions,
): Promise<TrackingDeliveryResult> {
  const fetcher = options?.fetchFn || globalThis.fetch;
  if (!config.pixelId) {
    return { provider: 'tiktok', success: false, error: 'TikTok Pixel ID is missing' };
  }

  const rawUserData = event.userData || {};
  const user: Record<string, unknown> = {};

  if (rawUserData.email) {
    user.email = await hashSha256(normalizeEmail(String(rawUserData.email)));
  }
  if (rawUserData.phone) {
    user.phone_number = await hashSha256(normalizePhone(String(rawUserData.phone)));
  }
  if (rawUserData.clientIp || options?.clientIp) {
    user.ip = rawUserData.clientIp || options?.clientIp;
  }
  if (rawUserData.clientUserAgent || options?.clientUserAgent) {
    user.user_agent = rawUserData.clientUserAgent || options?.clientUserAgent;
  }

  const tiktokPayload: Record<string, unknown> = {
    event_source: 'web',
    event_source_id: config.pixelId,
    data: [
      {
        event: event.eventName,
        event_id: event.eventId,
        timestamp: new Date((event.eventTime ? event.eventTime * 1000 : Date.now())).toISOString(),
        user,
        properties: {
          ...(event.params || {}),
          ...(event.customData || {}),
        },
        page: {
          url: event.eventSourceUrl || options?.sourceUrl,
        },
      },
    ],
  };

  if (config.testEventCode) {
    tiktokPayload.test_event_code = config.testEventCode;
  }

  if (options?.simulateInDebug) {
    options.onLog?.('[TikTok Events API SIMULATED]', tiktokPayload);
    return { provider: 'tiktok', success: true, data: { simulated: true, payload: tiktokPayload } };
  }

  try {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (!secrets?.accessToken) {
      return skippedResult('tiktok', 'No TikTok Events API access token resolved for this credential');
    }
    headers['Access-Token'] = secrets.accessToken;

    const res = await fetcher(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(tiktokPayload),
    });

    const resJson = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        provider: 'tiktok',
        success: false,
        status: res.status,
        error: (resJson as { message?: string })?.message || `HTTP ${res.status}`,
        data: resJson,
      };
    }

    return { provider: 'tiktok', success: true, status: res.status, data: resJson };
  } catch (err: unknown) {
    return {
      provider: 'tiktok',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Dispatches an event to Google Analytics 4 Measurement Protocol.
 * Spec: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */
export async function sendGa4MeasurementEvent(
  event: ServerTrackingEvent,
  config: GoogleTrackingProviderConfig,
  secrets: GoogleTrackingSecrets | null | undefined,
  options?: ServerTrackingOptions,
): Promise<TrackingDeliveryResult> {
  const fetcher = options?.fetchFn || globalThis.fetch;
  if (!config.measurementId) {
    return { provider: 'google', success: false, error: 'GA4 Measurement ID is missing' };
  }

  const clientId =
    (event.userData?.clientId as string | undefined) ||
    (event.userData?.externalId as string | undefined) ||
    'anonymous_client';

  const ga4Payload = {
    client_id: clientId,
    events: [
      {
        name: event.eventName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        params: {
          ...(event.params || {}),
          ...(event.customData || {}),
          event_id: event.eventId,
        },
      },
    ],
  };

  if (options?.simulateInDebug) {
    options.onLog?.('[GA4 Measurement Protocol SIMULATED]', ga4Payload);
    return { provider: 'google', success: true, data: { simulated: true, payload: ga4Payload } };
  }

  try {
    if (!secrets?.measurementProtocolSecret) {
      return skippedResult('google', 'No GA4 Measurement Protocol API secret resolved for this credential');
    }
    const url =
      `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.measurementId)}` +
      `&api_secret=${encodeURIComponent(secrets.measurementProtocolSecret)}`;

    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ga4Payload),
    });

    return {
      provider: 'google',
      success: res.ok,
      status: res.status,
      data: { status: res.status },
    };
  } catch (err: unknown) {
    return {
      provider: 'google',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Dispatches an event to a Custom Webhook.
 */
export async function sendCustomWebhookEvent(
  event: ServerTrackingEvent,
  _config: CustomTrackingProviderConfig,
  secrets: CustomTrackingSecrets | null | undefined,
  options?: ServerTrackingOptions,
): Promise<TrackingDeliveryResult> {
  const fetcher = options?.fetchFn || globalThis.fetch;

  const webhookPayload = {
    event: event.eventName,
    eventId: event.eventId,
    timestamp: event.eventTime ? event.eventTime * 1000 : Date.now(),
    userData: event.userData,
    params: event.params,
    customData: event.customData,
    sourceUrl: event.eventSourceUrl || options?.sourceUrl,
  };

  if (options?.simulateInDebug) {
    options.onLog?.('[Custom Webhook SIMULATED]', webhookPayload);
    return { provider: 'custom', success: true, data: { simulated: true, payload: webhookPayload } };
  }

  if (!secrets?.endpointUrl) {
    return skippedResult('custom', 'No custom webhook destination resolved for this credential');
  }

  try {
    const res = await fetcher(secrets.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secrets.headers || {}),
      },
      body: JSON.stringify(webhookPayload),
    });

    const resJson = await res.json().catch(() => ({}));
    return {
      provider: 'custom',
      success: res.ok,
      status: res.status,
      data: resJson,
    };
  } catch (err: unknown) {
    return {
      provider: 'custom',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


function skippedResult(provider: string, reason: string): TrackingDeliveryResult {
  return { provider, success: true, skipped: true, reason };
}

type ProviderTask = {
  /** Result key: `"<provider>:<pixel entry id>"`. */
  key: string;
  provider: ServerTrackingProviderType;
  pixelId: string;
  credentialId?: string;
  run: (secrets: TrackingProviderSecrets | null) => Promise<TrackingDeliveryResult>;
};

/** Builds the per-provider config the `send*` helpers take from one pixel entry. */
function toServerTask(
  pixel: TrackingPixel,
  event: ServerTrackingEvent,
  options: ServerTrackingOptions,
): ProviderTask | null {
  const base = { key: `${pixel.provider}:${pixel.id}`, pixelId: pixel.id, credentialId: pixel.credentialId };
  const credentialId = pixel.credentialId;
  switch (pixel.provider) {
    case 'meta': {
      const cfg: MetaTrackingProviderConfig = {
        enabled: true,
        credentialId,
        pixelId: pixel.pixelId,
        capiEnabled: true,
        testEventCode: pixel.testEventCode,
      };
      return { ...base, provider: 'meta', run: (s) => sendMetaCapiEvent(event, cfg, s as MetaTrackingSecrets | null, options) };
    }
    case 'tiktok': {
      const cfg: TikTokTrackingProviderConfig = {
        enabled: true,
        credentialId,
        pixelId: pixel.pixelId,
        eventsApiEnabled: true,
        testEventCode: pixel.testEventCode,
      };
      return { ...base, provider: 'tiktok', run: (s) => sendTikTokEventsApi(event, cfg, s as TikTokTrackingSecrets | null, options) };
    }
    case 'google': {
      if (!pixel.pixelId) return null;
      const cfg: GoogleTrackingProviderConfig = { enabled: true, credentialId, measurementId: pixel.pixelId };
      return { ...base, provider: 'google', run: (s) => sendGa4MeasurementEvent(event, cfg, s as GoogleTrackingSecrets | null, options) };
    }
    case 'custom': {
      const cfg: CustomTrackingProviderConfig = { enabled: true, credentialId };
      return { ...base, provider: 'custom', run: (s) => sendCustomWebhookEvent(event, cfg, s as CustomTrackingSecrets | null, options) };
    }
    default:
      // GTM is client-side only.
      return null;
  }
}

/**
 * High-Level Server Tracking Dispatcher (server-side only).
 *
 * Evaluates the master toggle, resolves the config's pixels (`resolveTrackingConfig`, with
 * `options.inheritedPixels`), keeps the server-enabled ones that match `provider`, `pixelIds`
 * and the pixel's `disabledEvents`, resolves each pixel's secret through
 * `options.resolveSecrets` (keyed by its `credentialId`) and dispatches in parallel. A pixel
 * without a resolved secret is skipped with a `reason` — this function never throws for
 * missing secrets. Several pixels of one provider each get their own delivery.
 *
 * Never call this from the browser: the renderer posts to a host relay instead
 * (see `createTrackingRelayHandler`).
 */
export async function dispatchServerTracking(
  event: ServerTrackingEvent,
  config?: Partial<TrackingConfig>,
  options?: ServerTrackingOptions,
): Promise<ServerTrackingDispatchResult> {
  const eventId = event.eventId || generateTrackingEventId();
  const eventWithId: ServerTrackingEvent = { ...event, eventId };

  // 1. Dynamic master toggle check: if tracking is disabled, cleanly return without any network activity
  if (!config || config.enabled === false) {
    return {
      success: true,
      eventId,
      skipped: true,
      reason: 'Tracking is disabled globally',
      results: {},
    };
  }

  const isDebug = Boolean(config.debugMode);
  const simulate = isDebug && options?.simulateInDebug !== false;

  const mergedOptions: ServerTrackingOptions = {
    ...options,
    simulateInDebug: simulate,
    onLog: (msg, data) => {
      if (isDebug) {
        // eslint-disable-next-line no-console
        console.log(`[KUBUILD Tracking] ${msg}`, data || '');
      }
      options?.onLog?.(msg, data);
    },
  };

  const target = options?.provider || 'all';
  const resolved = resolveTrackingConfig(config, options?.inheritedPixels);
  const tasks: ProviderTask[] = selectTrackingPixels(resolved, {
    provider: target,
    pixelIds: options?.pixelIds,
    eventName: eventWithId.eventName,
  })
    .filter((pixel) => pixel.serverEnabled)
    .map((pixel) => toServerTask(pixel, eventWithId, mergedOptions))
    .filter((task): task is ProviderTask => task !== null);

  if (tasks.length === 0) {
    return {
      success: true,
      eventId,
      skipped: true,
      reason:
        target === 'gtm'
          ? 'GTM is client-side only (dataLayer); no server delivery'
          : 'No server-side tracking provider is enabled',
      results: {},
    };
  }

  const resolve = options?.resolveSecrets;

  const runTask = async (task: ProviderTask): Promise<TrackingDeliveryResult> => {
    let secrets: TrackingProviderSecrets | null = null;
    if (resolve) {
      try {
        secrets =
          (await resolve({ provider: task.provider, credentialId: task.credentialId, documentId: options?.documentId })) ??
          null;
      } catch (err: unknown) {
        return {
          provider: task.provider,
          pixelId: task.pixelId,
          success: false,
          error: `Secret resolution failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // In debug simulation we still build the payload (no network), even without secrets.
    if (!secrets && !simulate) {
      const reason = resolve
        ? `No secret resolved for provider "${task.provider}"${task.credentialId ? ` (credentialId "${task.credentialId}")` : ' (no credentialId linked)'}`
        : 'No secret resolver configured (options.resolveSecrets)';
      mergedOptions.onLog?.(`[${task.key}] skipped: ${reason}`);
      return { ...skippedResult(task.provider, reason), pixelId: task.pixelId };
    }

    return { ...(await task.run(secrets)), pixelId: task.pixelId };
  };

  const settled = await Promise.allSettled(tasks.map((task) => runTask(task)));
  const results: Record<string, TrackingDeliveryResult> = {};
  let overallSuccess = true;
  let delivered = 0;

  settled.forEach((item, index) => {
    const { key, provider, pixelId } = tasks[index];
    if (item.status === 'fulfilled') {
      results[key] = item.value;
      if (!item.value.success) overallSuccess = false;
      if (!item.value.skipped) delivered++;
    } else {
      overallSuccess = false;
      results[key] = {
        provider,
        pixelId,
        success: false,
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
      };
    }
  });

  const allSkipped = delivered === 0 && overallSuccess;

  return {
    success: overallSuccess,
    eventId,
    ...(allSkipped ? { skipped: true, reason: 'All server providers were skipped' } : {}),
    results,
  };
}
