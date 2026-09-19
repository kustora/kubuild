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

/**
 * Option descriptor representing a saved Pixel Credential from Account/Workspace
 */
export interface PixelCredentialOption {
  id: string;
  name: string;
  provider: 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom' | string;
  pixelId: string;
  capiAccessToken?: string;
  testEventCode?: string;
  measurementProtocolSecret?: string;
  serverRelayUrl?: string;
  customHeaders?: Record<string, string>;
  isActive?: boolean;
}

/**
 * Event Delivery Channels:
 * - 'both': Fires client browser pixel and dispatches to server CAPI (with deduplication event_id)
 * - 'client_only': Only fires in the browser via client-side pixel scripts
 * - 'server_only': Only sends to server endpoint / CAPI (no browser pixel call)
 */
export const TrackingDeliverySchema = z.enum(['both', 'client_only', 'server_only']);
export type TrackingDelivery = z.infer<typeof TrackingDeliverySchema>;

/**
 * Meta (Facebook) Pixel & Conversions API (CAPI) Configuration
 */
export const MetaTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** Meta Pixel ID (e.g. 123456789012345) */
  pixelId: z.string().optional().default(''),
  /** Enable Server-Side Conversions API */
  capiEnabled: z.boolean().optional().default(false),
  /**
   * System User Access Token for Meta Graph API.
   * Note: For security in production, prefer configuring tokens on your server backend
   * or proxying via `serverRelayUrl`.
   */
  capiAccessToken: z.string().optional().default(''),
  /** Test Event Code from Meta Events Manager (e.g. "TEST12345") */
  testEventCode: z.string().optional().default(''),
  /**
   * Host Server Relay URL (e.g. "/api/tracking/meta").
   * Recommended for browser clients to post CAPI events safely without exposing the secret token.
   */
  serverRelayUrl: z.string().optional().default(''),
});

export type MetaTrackingProviderConfig = z.infer<typeof MetaTrackingProviderConfigSchema>;

/**
 * Google Analytics 4 (GA4) & Measurement Protocol Configuration
 */
export const GoogleTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** GA4 Measurement ID (e.g. "G-XXXXXXXXXX") */
  measurementId: z.string().optional().default(''),
  /** GA4 Measurement Protocol API Secret (for server-side events) */
  measurementProtocolSecret: z.string().optional().default(''),
  /** Host Server Relay URL (e.g. "/api/tracking/ga4") */
  serverRelayUrl: z.string().optional().default(''),
});

export type GoogleTrackingProviderConfig = z.infer<typeof GoogleTrackingProviderConfigSchema>;

/**
 * Google Tag Manager (GTM) Configuration
 */
export const GtmTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** GTM Container ID (e.g. "GTM-XXXXXXX") */
  containerId: z.string().optional().default(''),
  /** Host Server Relay URL */
  serverRelayUrl: z.string().optional().default(''),
});

export type GtmTrackingProviderConfig = z.infer<typeof GtmTrackingProviderConfigSchema>;

/**
 * TikTok Pixel & Events API Configuration
 */
export const TikTokTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** TikTok Pixel ID (e.g. "C1234567890") */
  pixelId: z.string().optional().default(''),
  /** Enable TikTok Events API (server-side) */
  eventsApiEnabled: z.boolean().optional().default(false),
  /** Long-term Access Token for TikTok Events API */
  accessToken: z.string().optional().default(''),
  /** Test Event Code from TikTok Event Manager */
  testEventCode: z.string().optional().default(''),
  /** Host Server Relay URL (e.g. "/api/tracking/tiktok") */
  serverRelayUrl: z.string().optional().default(''),
});

export type TikTokTrackingProviderConfig = z.infer<typeof TikTokTrackingProviderConfigSchema>;

/**
 * Custom Webhook / Analytics Endpoint Configuration
 */
export const CustomTrackingProviderConfigSchema = z.object({
  enabled: z.boolean().default(true),
  /** Optional linked account/workspace credential ID */
  credentialId: z.string().optional(),
  /** Custom Webhook endpoint URL */
  endpointUrl: z.string().optional().default(''),
  /** Optional headers sent with the webhook POST request */
  headers: z.record(z.string(), z.string()).optional().default({}),
});

export type CustomTrackingProviderConfig = z.infer<typeof CustomTrackingProviderConfigSchema>;

/**
 * Global Tracking Configuration Schema
 * Attached to Document / Project / Runtime Context.
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
  /** Provider-specific settings */
  providers: z
    .object({
      meta: MetaTrackingProviderConfigSchema.optional(),
      google: GoogleTrackingProviderConfigSchema.optional(),
      gtm: GtmTrackingProviderConfigSchema.optional(),
      tiktok: TikTokTrackingProviderConfigSchema.optional(),
      custom: CustomTrackingProviderConfigSchema.optional(),
    })
    .optional()
    .default({}),
});

export type TrackingConfig = z.infer<typeof TrackingConfigSchema>;

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
 * Track Event Step Payload Schema (for Action Pipelines)
 */
export const TrackEventStepPayloadSchema = z.object({
  /** Event name: e.g. "Purchase", "Lead", or custom string */
  eventName: z.string().min(1, 'Event name cannot be empty'),
  /** Standard event vs custom event identifier */
  eventType: z.enum(['standard', 'custom']).optional().default('standard'),
  /** Target provider: 'all' or a specific provider */
  provider: z.enum(['all', 'meta', 'google', 'tiktok', 'custom']).optional().default('all'),
  /** Delivery channel: 'both', 'client_only', or 'server_only' */
  delivery: TrackingDeliverySchema.optional().default('both'),
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

/**
 * Type guards
 */
export function isTrackingConfig(value: unknown): value is TrackingConfig {
  return TrackingConfigSchema.safeParse(value).success;
}

export function isTrackEventStepPayload(value: unknown): value is TrackEventStepPayload {
  return TrackEventStepPayloadSchema.safeParse(value).success;
}
