import {
  TRACKING_RELAY_PROTOCOL_VERSION,
  type ActionStep,
  type TrackEventStepPayload,
  type TrackingConfig,
  type TrackingRelayRequest,
  type TrackingRelayResponse,
} from '@kubuild/schema';
import {
  type Diagnostic,
  type PipelineExecutionContext,
  type PipelineStepHandler,
  type RuntimeTrackingOptions,
  interpolateValue,
  generateTrackingEventId,
} from '@kubuild/core';
import { fireBrowserPixel } from '../tracking/tracking-manager';

/**
 * Result returned by track_event action runner
 */
export interface TrackEventResult {
  eventName: string;
  eventId: string;
  delivery: 'both' | 'client_only' | 'server_only';
  provider: string;
  params: Record<string, unknown>;
  userData: Record<string, unknown>;
  skipped?: boolean;
  reason?: string;
  clientDispatched?: boolean;
  serverDispatched?: boolean;
  serverError?: string;
  /** Why server delivery was not attempted (e.g. no host relay configured). */
  serverSkippedReason?: string;
}

/**
 * Action Runner for `track_event`.
 * Dispatches events to browser pixel and/or server CAPI with variable interpolation and deduplication.
 */
export const trackEventRunner: PipelineStepHandler = async (
  step: ActionStep,
  context: PipelineExecutionContext,
): Promise<TrackEventResult> => {
  const payload = (step.payload || {}) as TrackEventStepPayload;

  // 1. Step-level enabled check
  if (payload.enabled === false) {
    return {
      eventName: payload.eventName || '',
      eventId: '',
      delivery: payload.delivery || 'both',
      provider: payload.provider || 'all',
      params: {},
      userData: {},
      skipped: true,
      reason: 'Track event step is disabled',
    };
  }

  // 2. Resolve tracking configuration from execution context or document
  const doc = context.document as { tracking?: TrackingConfig; metadata?: { tracking?: TrackingConfig } } | undefined;
  const trackingConfig = (context.trackingConfig as TrackingConfig | undefined) ||
    doc?.tracking ||
    doc?.metadata?.tracking;

  // Master toggle check: if tracking is disabled globally, skip dispatch
  if (trackingConfig && trackingConfig.enabled === false) {
    return {
      eventName: payload.eventName || '',
      eventId: '',
      delivery: payload.delivery || 'both',
      provider: payload.provider || 'all',
      params: {},
      userData: {},
      skipped: true,
      reason: 'Tracking is disabled globally in document settings',
    };
  }

  const rawEventName = String(payload.eventName || '').trim();
  const eventName = String(interpolateValue(rawEventName, context)).trim();
  if (!eventName) {
    throw new Error('Track event name cannot be empty');
  }

  // 3. Interpolate dynamic variables in event parameters and user data
  const rawParams = payload.params || {};
  const interpolatedParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawParams)) {
    interpolatedParams[k] = interpolateValue(v, context);
  }

  const rawUserData = payload.userData || {};
  const interpolatedUserData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawUserData)) {
    interpolatedUserData[k] = interpolateValue(v, context);
  }

  // 4. Resolve Deduplication Event ID
  let eventId = payload.eventId ? String(interpolateValue(payload.eventId, context)) : '';
  if (!eventId) {
    eventId = generateTrackingEventId();
  }

  const delivery = payload.delivery || trackingConfig?.defaultDelivery || 'both';
  const provider = payload.provider || 'all';

  let clientDispatched = false;
  let serverDispatched = false;
  let serverError: string | undefined;
  let serverSkippedReason: string | undefined;

  // 5. Client-Side Browser Pixel Dispatch
  if (delivery === 'client_only' || delivery === 'both') {
    fireBrowserPixel(eventName, interpolatedParams, {
      eventId,
      config: trackingConfig,
      provider,
      eventType: payload.eventType,
    });
    clientDispatched = true;
  }

  // 6. Server-side delivery — ONLY via the host relay (RenderContext.tracking.relayUrl).
  //    The browser never calls provider APIs and never sees secrets.
  if (delivery === 'server_only' || delivery === 'both') {
    const runtime = context.trackingRuntime as RuntimeTrackingOptions | undefined;
    const report = context.reportDiagnostic as ((d: Diagnostic) => void) | undefined;
    const log = (message: string, data?: unknown) => {
      runtime?.onLog?.(message, data);
      if (trackingConfig?.debugMode) {
        console.log(`[KUBUILD Tracking] ${message}`, data ?? '');
      }
    };

    if (provider === 'gtm') {
      serverSkippedReason = 'GTM is client-side only (dataLayer); no server delivery';
    } else if (!runtime?.relayUrl) {
      serverSkippedReason =
        'Server delivery skipped: no tracking relay configured (RenderContext.tracking.relayUrl)';
      log(serverSkippedReason, { eventName, eventId });
      report?.({
        code: 'TRACKING_RELAY_NOT_CONFIGURED',
        nodeId: typeof context.nodeId === 'string' ? context.nodeId : undefined,
        eventName,
        message: serverSkippedReason,
      });
    } else {
      const relayRequest: TrackingRelayRequest = {
        version: TRACKING_RELAY_PROTOCOL_VERSION,
        provider,
        ...(runtime.documentId ? { documentId: runtime.documentId } : {}),
        event: {
          eventName,
          eventId,
          ...(payload.eventType ? { eventType: payload.eventType } : {}),
          eventTime: Math.floor(Date.now() / 1000),
          ...(typeof window !== 'undefined' && window.location?.href
            ? { eventSourceUrl: window.location.href }
            : {}),
          actionSource: 'website',
          params: interpolatedParams,
          userData: interpolatedUserData,
        },
      };

      try {
        const fetchFn =
          runtime.fetchFn ||
          (context.fetch as typeof fetch | undefined) ||
          (typeof fetch === 'function' ? fetch : undefined);
        if (!fetchFn) throw new Error('fetch is not available in this environment');

        const res = await fetchFn(runtime.relayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(runtime.relayHeaders || {}) },
          credentials: runtime.credentials ?? 'same-origin',
          keepalive: true,
          body: JSON.stringify(relayRequest),
        });

        const body = (await (typeof res.json === 'function' ? res.json().catch(() => null) : null)) as
          | TrackingRelayResponse
          | null;

        if (res.ok && (body?.success ?? true)) {
          serverDispatched = true;
        } else {
          serverError =
            body?.error?.message || `Tracking relay responded with status ${res.status}`;
        }
      } catch (err: unknown) {
        serverError = err instanceof Error ? err.message : String(err);
      }

      if (serverError) {
        log(`Tracking relay failed: ${serverError}`, { eventName, eventId });
        report?.({
          code: 'TRACKING_RELAY_FAILED',
          nodeId: typeof context.nodeId === 'string' ? context.nodeId : undefined,
          eventName,
          message: serverError,
        });
      }
    }
  }

  return {
    eventName,
    eventId,
    delivery,
    provider,
    params: interpolatedParams,
    userData: interpolatedUserData,
    clientDispatched,
    serverDispatched,
    serverError,
    ...(serverSkippedReason ? { serverSkippedReason } : {}),
  };
};
