import { describe, it, expect } from 'vitest';
import {
  TrackingConfigSchema,
  TrackEventStepPayloadSchema,
  isTrackingConfig,
  isTrackEventStepPayload,
  ActionStepSchema,
  PageDocumentSchema,
  ProjectDocumentSchema,
  LEGACY_TRACKING_SECRET_KEYS,
  TrackingRelayRequestSchema,
  TrackingRelayResponseSchema,
  MetaTrackingSecretsSchema,
  CustomTrackingSecretsSchema,
  isTrackingRelayRequest,
  getTrackingRelayRequestJsonSchema,
  getTrackingRelayResponseJsonSchema,
  getTrackingProviderSecretsJsonSchema,
  getPageDocumentJsonSchema,
} from '../src';

describe('Tracking Schemas', () => {
  it('validates default TrackingConfigSchema', () => {
    const parsed = TrackingConfigSchema.parse({});
    expect(parsed.enabled).toBe(true);
    expect(parsed.debugMode).toBe(false);
    expect(parsed.autoPageView).toBe(true);
    expect(parsed.defaultDelivery).toBe('both');
    expect(isTrackingConfig(parsed)).toBe(true);
  });

  it('allows disabling tracking globally (master switch)', () => {
    const parsed = TrackingConfigSchema.parse({
      enabled: false,
    });
    expect(parsed.enabled).toBe(false);
  });

  it('validates providers configuration with Meta CAPI, Google, TikTok, and Custom', () => {
    const config = {
      enabled: true,
      debugMode: true,
      autoPageView: true,
      providers: {
        meta: {
          enabled: true,
          pixelId: '123456789012345',
          capiEnabled: true,
          capiAccessToken: 'EAAB...',
          testEventCode: 'TEST12345',
          serverRelayUrl: '/api/tracking/meta',
        },
        google: {
          enabled: true,
          measurementId: 'G-XYZ12345',
          measurementProtocolSecret: 'secret-key',
          serverRelayUrl: '/api/tracking/ga4',
        },
        tiktok: {
          enabled: false,
          pixelId: 'TT-98765',
          eventsApiEnabled: false,
        },
        custom: {
          enabled: true,
          endpointUrl: 'https://webhook.site/test',
          headers: { 'X-Custom-Auth': 'Bearer 123' },
        },
      },
    };

    // Legacy (<= 1.0.0) documents still parse; secret / destination fields are stripped.
    const parsed = TrackingConfigSchema.parse(config);
    expect(parsed.providers.meta?.capiEnabled).toBe(true);
    expect(parsed.providers.meta?.testEventCode).toBe('TEST12345');
    expect(parsed.providers.tiktok?.enabled).toBe(false);
    expect(parsed.providers.google?.measurementId).toBe('G-XYZ12345');

    const meta = parsed.providers.meta as Record<string, unknown>;
    expect(meta.capiAccessToken).toBeUndefined();
    expect(meta.serverRelayUrl).toBeUndefined();
    const google = parsed.providers.google as Record<string, unknown>;
    expect(google.measurementProtocolSecret).toBeUndefined();
    const custom = parsed.providers.custom as Record<string, unknown>;
    expect(custom.endpointUrl).toBeUndefined();
    expect(custom.headers).toBeUndefined();
    expect(JSON.stringify(parsed)).not.toContain('EAAB');
    expect(JSON.stringify(parsed)).not.toContain('secret-key');
    expect(JSON.stringify(parsed)).not.toContain('Bearer 123');
  });

  it('keeps public ids, flags and credentialId on providers', () => {
    const parsed = TrackingConfigSchema.parse({
      providers: {
        meta: { credentialId: 'cred_meta', pixelId: '123', capiEnabled: true, testEventCode: 'T1' },
        google: { credentialId: 'cred_ga', measurementId: 'G-1' },
        gtm: { containerId: 'GTM-1', serverRelayUrl: '/x' },
        tiktok: { credentialId: 'cred_tt', pixelId: 'TT', eventsApiEnabled: true, accessToken: 'tok' },
        custom: { credentialId: 'cred_hook' },
      },
    });
    expect(parsed.providers.meta).toMatchObject({ credentialId: 'cred_meta', pixelId: '123', capiEnabled: true });
    expect(parsed.providers.google).toMatchObject({ credentialId: 'cred_ga', measurementId: 'G-1' });
    expect(parsed.providers.gtm).toEqual({ enabled: true, containerId: 'GTM-1' });
    expect(parsed.providers.tiktok).toMatchObject({ credentialId: 'cred_tt', eventsApiEnabled: true });
    expect((parsed.providers.tiktok as Record<string, unknown>).accessToken).toBeUndefined();
    expect(parsed.providers.custom).toEqual({ enabled: true, credentialId: 'cred_hook' });
  });

  it('exposes LEGACY_TRACKING_SECRET_KEYS for sanitization', () => {
    expect(LEGACY_TRACKING_SECRET_KEYS.meta).toContain('capiAccessToken');
    expect(LEGACY_TRACKING_SECRET_KEYS.tiktok).toContain('accessToken');
    expect(LEGACY_TRACKING_SECRET_KEYS.google).toContain('measurementProtocolSecret');
    expect(LEGACY_TRACKING_SECRET_KEYS.custom).toEqual(['endpointUrl', 'headers']);
    expect(LEGACY_TRACKING_SECRET_KEYS.gtm).toEqual(['serverRelayUrl']);
  });

  it('accepts gtm as a track_event provider', () => {
    const parsed = TrackEventStepPayloadSchema.parse({ eventName: 'Lead', provider: 'gtm' });
    expect(parsed.provider).toBe('gtm');
  });
});

describe('Tracking relay protocol v1', () => {
  it('validates a minimal relay request and applies defaults', () => {
    const parsed = TrackingRelayRequestSchema.parse({
      version: 1,
      event: { eventName: 'Purchase', eventId: 'evt_1', params: { value: 10 } },
    });
    expect(parsed.provider).toBe('all');
    expect(isTrackingRelayRequest(parsed)).toBe(true);
  });

  it('rejects unsupported versions and missing event names', () => {
    expect(
      TrackingRelayRequestSchema.safeParse({ version: 2, event: { eventName: 'Lead' } }).success,
    ).toBe(false);
    expect(TrackingRelayRequestSchema.safeParse({ version: 1, event: { eventName: '' } }).success).toBe(false);
    expect(
      TrackingRelayRequestSchema.safeParse({ version: 1, event: { eventName: 'Lead' }, provider: 'x' }).success,
    ).toBe(false);
  });

  it('validates relay responses', () => {
    expect(
      TrackingRelayResponseSchema.safeParse({
        version: 1,
        success: true,
        eventId: 'evt_1',
        results: { meta: { provider: 'meta', success: true, status: 200 } },
      }).success,
    ).toBe(true);
    expect(
      TrackingRelayResponseSchema.safeParse({
        version: 1,
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'bad' },
      }).success,
    ).toBe(true);
  });

  it('validates host-side provider secrets separately from the document', () => {
    expect(MetaTrackingSecretsSchema.safeParse({ capiAccessToken: 'EAAB' }).success).toBe(true);
    expect(CustomTrackingSecretsSchema.safeParse({ endpointUrl: 'not a url' }).success).toBe(false);
    expect(
      CustomTrackingSecretsSchema.safeParse({ endpointUrl: 'https://hook.example', headers: { A: 'b' } }).success,
    ).toBe(true);
  });

  it('exports Draft-07 JSON Schemas for non-JS relay implementations', () => {
    const req = getTrackingRelayRequestJsonSchema() as Record<string, any>;
    expect(req.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(req.$id).toContain('tracking-relay-request');
    expect(req.required).toEqual(expect.arrayContaining(['version', 'event']));
    expect(req.properties.version.const).toBe(1);
    expect(req.properties.provider.enum).toContain('gtm');

    const res = getTrackingRelayResponseJsonSchema() as Record<string, any>;
    expect(res.properties.error).toBeDefined();

    const secrets = getTrackingProviderSecretsJsonSchema() as Record<string, any>;
    expect(secrets.properties.meta).toBeDefined();

    const page = getPageDocumentJsonSchema() as Record<string, any>;
    expect(page.properties.tracking).toBeDefined();
    expect(page.definitions.trackingConfig.properties.providers.properties.meta.properties.capiAccessToken).toBeUndefined();
  });

  it('validates TrackEventStepPayloadSchema', () => {
    const payload = {
      eventName: 'Purchase',
      eventType: 'standard',
      provider: 'all',
      delivery: 'both',
      eventId: 'evt_order_123',
      params: {
        currency: 'IDR',
        value: 250000,
        content_name: 'Premium Course',
      },
      userData: {
        email: 'user@example.com',
        phone: '08123456789',
      },
    };

    const parsed = TrackEventStepPayloadSchema.parse(payload);
    expect(parsed.eventName).toBe('Purchase');
    expect(parsed.delivery).toBe('both');
    expect(parsed.params?.currency).toBe('IDR');
    expect(isTrackEventStepPayload(parsed)).toBe(true);
  });

  it('integrates track_event into ActionStepSchema', () => {
    const actionStep = {
      id: 'step_track_1',
      type: 'track_event',
      label: 'Fire Purchase Pixel',
      payload: {
        eventName: 'Purchase',
        params: { value: 150000 },
      },
    };

    const parsed = ActionStepSchema.parse(actionStep);
    expect(parsed.type).toBe('track_event');
    expect(parsed.payload?.eventName).toBe('Purchase');
  });

  it('supports tracking on PageDocumentSchema and ProjectDocumentSchema', () => {
    const pageDoc = {
      schema: 'stora.page',
      version: '1.0.0',
      metadata: {
        title: 'Landing Page with Pixel',
      },
      tracking: {
        enabled: true,
        providers: {
          meta: {
            pixelId: '999888777',
            capiEnabled: true,
          },
        },
      },
      document: {
        id: 'page_root',
        type: 'page',
        children: [],
      },
    };

    const parsedPage = PageDocumentSchema.parse(pageDoc);
    expect(parsedPage.tracking?.enabled).toBe(true);
    expect(parsedPage.tracking?.providers?.meta?.pixelId).toBe('999888777');

    const projectDoc = {
      schema: 'stora.project',
      version: '1.0.0',
      tracking: {
        enabled: false,
      },
      artboards: [
        {
          id: 'artboard_1',
          name: 'Home',
          artboardType: 'page',
          document: parsedPage,
        },
      ],
    };

    const parsedProject = ProjectDocumentSchema.parse(projectDoc);
    expect(parsedProject.tracking?.enabled).toBe(false);
  });
});
