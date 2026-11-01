import { z } from 'zod';

/**
 * Supported Tracking Providers
 */
export const TrackingProviderTypeSchema = z.enum([
  'meta',
  'google',
  'gtm',
  'tiktok',
  'custom',
]);

export type TrackingProviderType = z.infer<typeof TrackingProviderTypeSchema>;

/*
 * SECURITY MODEL
 * --------------
 * The portable document only stores PUBLIC identifiers (pixel / measurement / container ids),
 * feature flags, test event codes and an opaque `credentialId`. Secrets (Meta CAPI access
 * token, TikTok Events API token, GA4 Measurement Protocol API secret, custom webhook URL +
 * headers) are owned by the host and resolved on the server at dispatch time via
 * `credentialId`. Unknown keys — including the secret fields that `<= 1.0.0` documents
 * carried — are stripped when a document is parsed.
 */

/**
 * Metadata-only descriptor of a tracking credential saved by the host (account/workspace).
 *
 * This is what the editor receives to render a credential picker. It NEVER carries secret
 * material (access tokens, API secrets, webhook URLs/headers) — those stay on the host and
 * are resolved server-side from `id` (see `TrackingSecretResolver` in `@kubuild/core`).
 */
export interface PixelCredentialOption {
  /** Opaque host id, stored in the document as `pixels[].credentialId`. */
  id: string;
  /** Human-readable label shown in the picker. */
  name: string;
  provider: TrackingProviderType | (string & {});
  /** Public Meta / TikTok pixel id, if the credential has one. */
  pixelId?: string;
  /** Public GA4 measurement id, if the credential has one. */
  measurementId?: string;
  /** Public GTM container id, if the credential has one. */
  containerId?: string;
  /** True when the host holds a server-side secret for this credential. */
  hasSecret?: boolean;
  isActive?: boolean;
}

/**
 * Event Delivery Channels:
 * - 'both': Fires client browser pixel and dispatches to the server relay (with deduplication event_id)
 * - 'client_only': Only fires in the browser via client-side pixel scripts
 * - 'server_only': Only sends to the host server relay (no browser pixel call)
 */
export const TrackingDeliverySchema = z.enum(['both', 'client_only', 'server_only']);
export type TrackingDelivery = z.infer<typeof TrackingDeliverySchema>;

/**
 * Meta (Facebook) Pixel & Conversions API (CAPI) Configuration
 */
export const MetaTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Host credential id; the server resolves the CAPI access token from it. */
  credentialId: z.string().optional(),
  /** Meta Pixel ID (e.g. 123456789012345) — public */
  pixelId: z.string().optional().default(''),
  /** Enable Server-Side Conversions API (delivered through the host relay) */
  capiEnabled: z.boolean().optional().default(false),
  /** Test Event Code from Meta Events Manager (e.g. "TEST12345") — not a secret */
  testEventCode: z.string().optional().default(''),
});

export type MetaTrackingProviderConfig = z.infer<typeof MetaTrackingProviderConfigSchema>;

/**
 * Google Analytics 4 (GA4) & Measurement Protocol Configuration
 */
export const GoogleTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Host credential id; the server resolves the Measurement Protocol API secret from it. */
  credentialId: z.string().optional(),
  /** GA4 Measurement ID (e.g. "G-XXXXXXXXXX") — public */
  measurementId: z.string().optional().default(''),
});

export type GoogleTrackingProviderConfig = z.infer<typeof GoogleTrackingProviderConfigSchema>;

/**
 * Google Tag Manager (GTM) Configuration.
 * Client-side only: `track_event` with provider 'gtm' (or 'all') pushes to `window.dataLayer`.
 */
export const GtmTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** GTM Container ID (e.g. "GTM-XXXXXXX") — public */
  containerId: z.string().optional().default(''),
});

export type GtmTrackingProviderConfig = z.infer<typeof GtmTrackingProviderConfigSchema>;

/**
 * TikTok Pixel & Events API Configuration
 */
export const TikTokTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Host credential id; the server resolves the Events API access token from it. */
  credentialId: z.string().optional(),
  /** TikTok Pixel ID (e.g. "C1234567890") — public */
  pixelId: z.string().optional().default(''),
  /** Enable TikTok Events API (server-side, delivered through the host relay) */
  eventsApiEnabled: z.boolean().optional().default(false),
  /** Test Event Code from TikTok Event Manager — not a secret */
  testEventCode: z.string().optional().default(''),
});

export type TikTokTrackingProviderConfig = z.infer<typeof TikTokTrackingProviderConfigSchema>;

/**
 * Custom Webhook Configuration.
 * The destination URL and any auth headers are host secrets resolved from `credentialId`.
 */
export const CustomTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Host credential id; the server resolves the webhook `endpointUrl` + `headers` from it. */
  credentialId: z.string().optional(),
});

export type CustomTrackingProviderConfig = z.infer<typeof CustomTrackingProviderConfigSchema>;

/**
 * One tracking pixel (1.3.0+). A config holds any number of them, several per provider allowed.
 * `pixelId` is the provider's public id: Meta/TikTok pixel id, GA4 measurement id or GTM
 * container id (unused for `custom`). Secrets stay with the host, resolved from `credentialId`.
 */
export const TrackingPixelSchema = z.object({
  /** Stable entry id, unique within a config. Hosts may reuse their own credential id. */
  id: z.string().min(1).max(256),
  provider: TrackingProviderTypeSchema,
  /** Human-readable label shown in the editor. */
  label: z.string().max(200).optional(),
  enabled: z.boolean().default(true),
  /** Host credential id; the server resolves this pixel's secret from it. */
  credentialId: z.string().max(256).optional(),
  /** Public id — Meta/TikTok pixel id, GA4 measurement id, GTM container id. */
  pixelId: z.string().max(256).optional().default(''),
  /** Server-side delivery (Meta CAPI, TikTok Events API, GA4 Measurement Protocol, custom webhook) via the host relay. */
  serverEnabled: z.boolean().optional().default(false),
  /** Meta / TikTok test event code — not a secret. */
  testEventCode: z.string().max(100).optional().default(''),
  /** Event names this pixel never receives (exact, case-sensitive match), e.g. `["Purchase"]`. */
  disabledEvents: z.array(z.string().max(256)).optional().default([]),
});

export type TrackingPixel = z.infer<typeof TrackingPixelSchema>;
/** Input shape (defaults optional) — what hosts typically construct. */
export type TrackingPixelInput = z.input<typeof TrackingPixelSchema>;

/**
 * How a document treats the pixels its host passes at runtime
 * (`RenderContext.tracking.inheritedPixels`, editor `inheritedTrackingPixels`).
 */
export const TrackingInheritConfigSchema = z.object({
  /** Use the host's inherited pixels on this document. */
  enabled: z.boolean().default(true),
  /** Inherited pixel ids switched off for this document. */
  excludedPixelIds: z.array(z.string().max(256)).default([]),
});

export type TrackingInheritConfig = z.infer<typeof TrackingInheritConfigSchema>;

/**
 * Provider keys that `<= 1.0.0` documents stored but that are now host-owned
 * (secrets and server destinations). Used by migration and by import/export
 * sanitization to strip them defensively.
 */
export const LEGACY_TRACKING_SECRET_KEYS: Readonly<Record<TrackingProviderType, readonly string[]>> =
  Object.freeze({
    meta: ['capiAccessToken', 'serverRelayUrl'],
    google: ['measurementProtocolSecret', 'serverRelayUrl'],
    gtm: ['serverRelayUrl'],
    tiktok: ['accessToken', 'serverRelayUrl'],
    custom: ['endpointUrl', 'headers'],
  });

/** `<= 1.2.0` provider map — one config object per provider. */
export const LegacyTrackingProvidersSchema = z.object({
  meta: MetaTrackingProviderConfigSchema.optional(),
  google: GoogleTrackingProviderConfigSchema.optional(),
  gtm: GtmTrackingProviderConfigSchema.optional(),
  tiktok: TikTokTrackingProviderConfigSchema.optional(),
  custom: CustomTrackingProviderConfigSchema.optional(),
});

export type LegacyTrackingProviders = z.infer<typeof LegacyTrackingProvidersSchema>;

/**
 * Global Tracking Configuration Schema
 * Attached to Document / Project. Contains no secrets.
 */
export const TrackingConfigSchema = z.object({
  /** Master toggle: dynamically enables or disables all tracking operations */
  enabled: z.boolean().default(true),
  /** When enabled, events are logged to console and can bypass live API calls for safe debugging */
  debugMode: z.boolean().optional().default(false),
  /** Automatically trigger PageView event upon page load */
  autoPageView: z.boolean().optional().default(true),
  /** Default delivery method when not explicitly overridden in an action step */
  defaultDelivery: TrackingDeliverySchema.optional().default('both'),
  /** The document's own pixels (1.3.0+), any number per provider. */
  pixels: z.array(TrackingPixelSchema).optional().default([]),
  /** Use / exclude pixels inherited from the host at runtime. */
  inherit: TrackingInheritConfigSchema.optional().default({ enabled: true, excludedPixelIds: [] }),
  /**
   * @deprecated `<= 1.2.0` one-config-per-provider shape. Still parsed so old documents load;
   * the `1.2.0 -> 1.3.0` migration and `resolveTrackingConfig` convert it into `pixels`.
   */
  providers: LegacyTrackingProvidersSchema.optional(),
});

export type TrackingConfig = z.infer<typeof TrackingConfigSchema>;

/* ------------------------------------------------------------------------------------------
 * Host-side secrets — NEVER part of the document. Exported so hosts / relays can validate
 * what their secret store returns.
 * ---------------------------------------------------------------------------------------- */

/** Meta Conversions API secret material. */
export const MetaTrackingSecretsSchema = z.object({
  /** System User access token for the Meta Graph API. */
  capiAccessToken: z.string().min(1),
});
export type MetaTrackingSecrets = z.infer<typeof MetaTrackingSecretsSchema>;

/** GA4 Measurement Protocol secret material. */
export const GoogleTrackingSecretsSchema = z.object({
  /** Measurement Protocol `api_secret`. */
  measurementProtocolSecret: z.string().min(1),
});
export type GoogleTrackingSecrets = z.infer<typeof GoogleTrackingSecretsSchema>;

/** TikTok Events API secret material. */
export const TikTokTrackingSecretsSchema = z.object({
  /** Long-term Events API access token. */
  accessToken: z.string().min(1),
});
export type TikTokTrackingSecrets = z.infer<typeof TikTokTrackingSecretsSchema>;

/** Custom webhook destination + auth headers (both are host secrets). */
export const CustomTrackingSecretsSchema = z.object({
  endpointUrl: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
});
export type CustomTrackingSecrets = z.infer<typeof CustomTrackingSecretsSchema>;

/** Secret material keyed by provider. GTM is client-only and has no secret. */
export interface TrackingProviderSecretsMap {
  meta: MetaTrackingSecrets;
  google: GoogleTrackingSecrets;
  tiktok: TikTokTrackingSecrets;
  custom: CustomTrackingSecrets;
}

/** Providers that support server-side delivery (and therefore have secrets). */
export type ServerTrackingProviderType = keyof TrackingProviderSecretsMap;

/** Secret material for a single provider, as returned by a host secret resolver. */
export type TrackingProviderSecrets = TrackingProviderSecretsMap[ServerTrackingProviderType];

/**
 * Standard Event Names commonly used across Meta, Google, and TikTok.
 */
export const StandardTrackingEventSchema = z.enum([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Lead',
  'Contact',
  'CompleteRegistration',
  'Subscribe',
  'Search',
  'SubmitApplication',
  'Schedule',
]);

export type StandardTrackingEvent = z.infer<typeof StandardTrackingEventSchema>;

/**
 * Target provider of a `track_event` step. 'gtm' pushes to `window.dataLayer` (client only).
 */
export const TrackEventProviderSchema = z.enum(['all', 'meta', 'google', 'gtm', 'tiktok', 'custom']);
export type TrackEventProvider = z.infer<typeof TrackEventProviderSchema>;

/**
 * Track Event Step Payload Schema (for Action Pipelines)
 */
export const TrackEventStepPayloadSchema = z.object({
  /** Event name: e.g. "Purchase", "Lead", or custom string */
  eventName: z.string().min(1, 'Event name cannot be empty'),
  /** Standard event vs custom event identifier */
  eventType: z.enum(['standard', 'custom']).optional().default('standard'),
  /**
   * Target provider: 'all' or a specific provider.
   * 'gtm' pushes the event to `window.dataLayer` (client-side only).
   */
  provider: TrackEventProviderSchema.optional().default('all'),
  /** Delivery channel: 'both', 'client_only', or 'server_only' */
  delivery: TrackingDeliverySchema.optional().default('both'),
  /**
   * Only these pixel entry ids (`TrackingPixel.id`). Empty / omitted = every enabled pixel
   * matching `provider`.
   */
  pixelIds: z.array(z.string().max(256)).optional(),
  /**
   * Deduplication Event ID.
   * If omitted, a unique ID is automatically generated so Meta/TikTok CAPI
   * deduplicates cleanly with the browser pixel.
   */
  eventId: z.string().optional(),
  /**
   * Event parameters/properties (e.g. currency, value, content_name, order_id).
   * Supports runtime variable interpolation (e.g. {{ form.price }} or {{ variables.currency }}).
   */
  params: z.record(z.string(), z.unknown()).optional().default({}),
  /**
   * User Data for advanced matching and server CAPI (e.g. email, phone, firstName, lastName).
   * Supports runtime variable interpolation (e.g. {{ form.email }}).
   */
  userData: z.record(z.string(), z.unknown()).optional().default({}),
  /** Step-level active toggle */
  enabled: z.boolean().optional().default(true),
});

export type TrackEventStepPayload = z.infer<typeof TrackEventStepPayloadSchema>;

/* ------------------------------------------------------------------------------------------
 * Relay protocol (browser -> host server). Versioned and language-agnostic: any backend
 * (Node, PHP, Go, Python, ...) can implement it — see the JSON Schema export.
 * ---------------------------------------------------------------------------------------- */

export const TRACKING_RELAY_PROTOCOL_VERSION = 1 as const;

/** Normalized server tracking event, as sent from the browser to the host relay. */
export const ServerTrackingEventSchema = z.object({
  eventName: z.string().min(1).max(256),
  eventType: z.enum(['standard', 'custom']).optional(),
  eventId: z.string().max(256).optional(),
  /** Unix epoch seconds. */
  eventTime: z.number().int().nonnegative().optional(),
  eventSourceUrl: z.string().max(4096).optional(),
  actionSource: z.enum(['website', 'app', 'system_generated']).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  /** Raw (unhashed) user data; the relay hashes PII per provider spec before forwarding. */
  userData: z.record(z.string(), z.unknown()).optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
});
export type ServerTrackingEventInput = z.infer<typeof ServerTrackingEventSchema>;

/**
 * Body the renderer POSTs to the host relay (`RenderContext.tracking.relayUrl`).
 * The relay MUST load the tracking config itself (trusted) — never from this body.
 */
export const TrackingRelayRequestSchema = z.object({
  version: z.literal(TRACKING_RELAY_PROTOCOL_VERSION),
  event: ServerTrackingEventSchema,
  provider: TrackEventProviderSchema.optional().default('all'),
  /** Optional hint only; the relay uses the credentialId from its trusted config. */
  credentialId: z.string().max(256).optional(),
  /** Optional narrowing hint: only these pixel entry ids from the trusted config. Never adds pixels. */
  pixelIds: z.array(z.string().max(256)).max(100).optional(),
  /** Host document/page id so the relay can look up the trusted tracking config. */
  documentId: z.string().max(256).optional(),
});
export type TrackingRelayRequest = z.infer<typeof TrackingRelayRequestSchema>;

/** Per-provider outcome returned by the relay (provider response bodies are not echoed). */
export const TrackingRelayProviderResultSchema = z.object({
  provider: z.string(),
  /** Pixel entry id (`TrackingPixel.id`) this result belongs to. */
  pixelId: z.string().optional(),
  success: z.boolean(),
  status: z.number().int().optional(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  error: z.string().optional(),
});
export type TrackingRelayProviderResult = z.infer<typeof TrackingRelayProviderResultSchema>;

export const TrackingRelayErrorCodeSchema = z.enum([
  'INVALID_REQUEST',
  'UNSUPPORTED_VERSION',
  'FORBIDDEN_ORIGIN',
  'METHOD_NOT_ALLOWED',
  'CONFIG_NOT_FOUND',
  'EVENT_NOT_ALLOWED',
  'INTERNAL_ERROR',
]);
export type TrackingRelayErrorCode = z.infer<typeof TrackingRelayErrorCodeSchema>;

export const TrackingRelayResponseSchema = z.object({
  version: z.literal(TRACKING_RELAY_PROTOCOL_VERSION),
  success: z.boolean(),
  eventId: z.string().optional(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  /** Keyed `"<provider>:<pixel entry id>"`. */
  results: z.record(z.string(), TrackingRelayProviderResultSchema).optional(),
  error: z
    .object({
      code: TrackingRelayErrorCodeSchema,
      message: z.string(),
    })
    .optional(),
});
export type TrackingRelayResponse = z.infer<typeof TrackingRelayResponseSchema>;

/**
 * Type guards
 */
export function isTrackingConfig(value: unknown): value is TrackingConfig {
  return TrackingConfigSchema.safeParse(value).success;
}

export function isTrackEventStepPayload(value: unknown): value is TrackEventStepPayload {
  return TrackEventStepPayloadSchema.safeParse(value).success;
}

export function isTrackingRelayRequest(value: unknown): value is TrackingRelayRequest {
  return TrackingRelayRequestSchema.safeParse(value).success;
}
