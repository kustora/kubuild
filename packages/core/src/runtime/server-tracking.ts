import type {
  TrackingConfig,
  MetaTrackingProviderConfig,
  GoogleTrackingProviderConfig,
  TikTokTrackingProviderConfig,
  CustomTrackingProviderConfig,
} from '@kubuild/schema';

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
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  skipped?: boolean;
}

/**
 * Aggregate result from dispatchServerTracking
 */
export interface ServerTrackingDispatchResult {
  success: boolean;
  eventId: string;
  skipped?: boolean;
  reason?: string;
  results: Record<string, TrackingDeliveryResult>;
}

/**
 * Options for configuring server tracking dispatch
 */
export interface ServerTrackingOptions {
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
    if (config.capiAccessToken) {
      headers['Authorization'] = `Bearer ${config.capiAccessToken}`;
    }

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
    if (config.accessToken) {
      headers['Access-Token'] = config.accessToken;
    }

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
    let url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
      config.measurementId,
    )}`;
    if (config.measurementProtocolSecret) {
      url += `&api_secret=${encodeURIComponent(config.measurementProtocolSecret)}`;
    }

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
  config: CustomTrackingProviderConfig,
  options?: ServerTrackingOptions,
): Promise<TrackingDeliveryResult> {
  const fetcher = options?.fetchFn || globalThis.fetch;
  if (!config.endpointUrl) {
    return { provider: 'custom', success: false, error: 'Custom Webhook URL is missing' };
  }

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

  try {
    const res = await fetcher(config.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {}),
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

/**
 * High-Level Server Tracking Dispatcher
 * Evaluates dynamic enabled state, filters enabled providers, and dispatches events.
 */
export async function dispatchServerTracking(
  event: ServerTrackingEvent,
  config?: TrackingConfig,
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

  const providers = config.providers || {};
  const dispatchPromises: Array<Promise<{ key: string; result: TrackingDeliveryResult }>> = [];

  // Meta CAPI
  if (providers.meta && providers.meta.enabled !== false && providers.meta.capiEnabled) {
    dispatchPromises.push(
      sendMetaCapiEvent(eventWithId, providers.meta, mergedOptions).then((result) => ({
        key: 'meta',
        result,
      })),
    );
  }

  // TikTok Events API
  if (providers.tiktok && providers.tiktok.enabled !== false && providers.tiktok.eventsApiEnabled) {
    dispatchPromises.push(
      sendTikTokEventsApi(eventWithId, providers.tiktok, mergedOptions).then((result) => ({
        key: 'tiktok',
        result,
      })),
    );
  }

  // GA4 Measurement Protocol
  if (
    providers.google &&
    providers.google.enabled !== false &&
    providers.google.measurementId &&
    providers.google.measurementProtocolSecret
  ) {
    dispatchPromises.push(
      sendGa4MeasurementEvent(eventWithId, providers.google, mergedOptions).then((result) => ({
        key: 'google',
        result,
      })),
    );
  }

  // Custom Webhook
  if (providers.custom && providers.custom.enabled !== false && providers.custom.endpointUrl) {
    dispatchPromises.push(
      sendCustomWebhookEvent(eventWithId, providers.custom, mergedOptions).then((result) => ({
        key: 'custom',
        result,
      })),
    );
  }

  const settled = await Promise.allSettled(dispatchPromises);
  const results: Record<string, TrackingDeliveryResult> = {};
  let overallSuccess = true;

  for (const item of settled) {
    if (item.status === 'fulfilled') {
      results[item.value.key] = item.value.result;
      if (!item.value.result.success) {
        overallSuccess = false;
      }
    } else {
      overallSuccess = false;
    }
  }

  return {
    success: overallSuccess,
    eventId,
    results,
  };
}
