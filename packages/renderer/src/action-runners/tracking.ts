import type { ActionStep, TrackEventStepPayload, TrackingConfig } from '@kubuild/schema';
import {
  type PipelineExecutionContext,
  type PipelineStepHandler,
  interpolateValue,
  generateTrackingEventId,
  dispatchServerTracking,
  type ServerTrackingEvent,
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

  // 6. Server-Side CAPI Dispatch
  if (delivery === 'server_only' || delivery === 'both') {
    // Determine server relay URL: provider-specific or top-level or on step
    let serverRelayUrl = (payload as unknown as Record<string, unknown>)['serverRelayUrl'] as string | undefined;
    if (!serverRelayUrl && trackingConfig?.providers) {
      if (provider === 'meta') {
        serverRelayUrl = trackingConfig.providers.meta?.serverRelayUrl;
      } else if (provider === 'tiktok') {
        serverRelayUrl = trackingConfig.providers.tiktok?.serverRelayUrl;
      } else if (provider === 'google') {
        serverRelayUrl = trackingConfig.providers.google?.serverRelayUrl;
      } else {
        serverRelayUrl =
          trackingConfig.providers.meta?.serverRelayUrl ||
          trackingConfig.providers.tiktok?.serverRelayUrl ||
          trackingConfig.providers.google?.serverRelayUrl;
      }
    }

    const serverEventPayload: ServerTrackingEvent = {
      eventName,
      eventId,
      eventTime: Math.floor(Date.now() / 1000),
      eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      params: interpolatedParams,
      userData: interpolatedUserData,
    };

    // If running in browser and relay URL is configured, POST to server relay
    if (typeof window !== 'undefined' && serverRelayUrl) {
      try {
        const fetchFn = (context.fetch as typeof fetch) || window.fetch;
        const res = await fetchFn(serverRelayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: serverEventPayload,
            provider,
          }),
        });
        if (res.ok) {
          serverDispatched = true;
        } else {
          serverError = `Server relay responded with status ${res.status}`;
        }
      } catch (err: unknown) {
        serverError = err instanceof Error ? err.message : String(err);
      }
    } else {
      // In server/SSR environment or direct dispatch mode:
      try {
        const dispatchResult = await dispatchServerTracking(serverEventPayload, trackingConfig);
        serverDispatched = dispatchResult.success;
        if (!dispatchResult.success) {
          serverError = 'One or more server tracking providers failed';
        }
      } catch (err: unknown) {
        serverError = err instanceof Error ? err.message : String(err);
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
  };
};
