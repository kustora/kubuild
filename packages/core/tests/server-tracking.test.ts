import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashSha256,
  normalizeEmail,
  normalizePhone,
  generateTrackingEventId,
  sendMetaCapiEvent,
  sendTikTokEventsApi,
  sendGa4MeasurementEvent,
  sendCustomWebhookEvent,
  dispatchServerTracking,
  createTrackingRelayHandler,
  type ServerTrackingEvent,
  type TrackingSecretResolver,
} from '../src';
import { TrackingRelayResponseSchema, type TrackingConfig } from '@kubuild/schema';

describe('Server Tracking & CAPI Runtime', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Normalization and Hashing', () => {
    it('normalizes email according to CAPI rules', () => {
      expect(normalizeEmail('  Test.User@Example.COM ')).toBe('test.user@example.com');
      expect(normalizeEmail('')).toBe('');
    });

    it('normalizes phone number to digits only', () => {
      expect(normalizePhone('+62 (812) 3456-7890')).toBe('6281234567890');
      expect(normalizePhone('')).toBe('');
    });

    it('generates a valid SHA-256 hex string', async () => {
      const email = normalizeEmail('test@example.com');
      const hash = await hashSha256(email);
      // SHA-256 of "test@example.com"
      expect(hash).toBe('973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b');
      expect(hash.length).toBe(64);
    });

    it('generates unique event IDs with prefix', () => {
      const id1 = generateTrackingEventId();
      const id2 = generateTrackingEventId();
      expect(id1.startsWith('evt_')).toBe(true);
      expect(id2.startsWith('evt_')).toBe(true);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Meta Conversions API (CAPI)', () => {
    it('constructs correct Meta CAPI payload with hashed user data and sends request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ events_received: 1, fbtrace_id: 'abc123trace' }),
      });

      const event: ServerTrackingEvent = {
        eventName: 'Purchase',
        eventId: 'evt_purchase_99',
        eventTime: 1711223344,
        eventSourceUrl: 'https://myshop.com/checkout/success',
        params: {
          currency: 'IDR',
          value: 200000,
        },
        userData: {
          email: 'customer@example.com',
          phone: '+628111222333',
          firstName: 'John',
          clientIp: '192.168.1.1',
          clientUserAgent: 'Mozilla/5.0 Test',
        },
      };

      const result = await sendMetaCapiEvent(
        event,
        {
          enabled: true,
          pixelId: '123456789',
          capiEnabled: true,
          testEventCode: 'TEST9999',
        },
        { capiAccessToken: 'test-token' },
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('123456789/events');
      expect(calledOptions.headers.Authorization).toBe('Bearer test-token');

      const body = JSON.parse(calledOptions.body);
      expect(body.test_event_code).toBe('TEST9999');
      expect(body.data[0].event_name).toBe('Purchase');
      expect(body.data[0].event_id).toBe('evt_purchase_99');
      expect(body.data[0].custom_data.value).toBe(200000);
      expect(body.data[0].custom_data.currency).toBe('IDR');
      expect(body.data[0].user_data.em).toBeDefined();
      expect(body.data[0].user_data.em[0].length).toBe(64);
      expect(body.data[0].user_data.client_ip_address).toBe('192.168.1.1');
    });

    it('returns failure when pixelId is missing', async () => {
      const result = await sendMetaCapiEvent(
        { eventName: 'Lead' },
        { enabled: true, pixelId: '', capiEnabled: true, testEventCode: '' },
        { capiAccessToken: 'tok' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
    });

    it('skips (does not throw) when no access token secret is provided', async () => {
      const mockFetch = vi.fn();
      const result = await sendMetaCapiEvent(
        { eventName: 'Lead' },
        { enabled: true, pixelId: '123', capiEnabled: true, testEventCode: '' },
        null,
        { fetchFn: mockFetch as unknown as typeof fetch },
      );
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('access token');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('TikTok Events API', () => {
    it('constructs correct TikTok payload and dispatches', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, message: 'OK' }),
      });

      const event: ServerTrackingEvent = {
        eventName: 'AddToCart',
        eventId: 'evt_tt_1',
        params: { value: 50000 },
        userData: { email: 'ttuser@example.com' },
      };

      const result = await sendTikTokEventsApi(
        event,
        {
          enabled: true,
          pixelId: 'TIKTOK_PIXEL_1',
          eventsApiEnabled: true,
          testEventCode: 'TT_TEST',
        },
        { accessToken: 'tt-access-token' },
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('tiktok.com');
      expect(calledOptions.headers['Access-Token']).toBe('tt-access-token');

      const body = JSON.parse(calledOptions.body);
      expect(body.event_source_id).toBe('TIKTOK_PIXEL_1');
      expect(body.test_event_code).toBe('TT_TEST');
      expect(body.data[0].event).toBe('AddToCart');
    });
  });

  describe('GA4 Measurement Protocol', () => {
    it('constructs GA4 MP request and dispatches', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const event: ServerTrackingEvent = {
        eventName: 'generate_lead',
        eventId: 'evt_ga4_1',
        params: { value: 100 },
      };

      const result = await sendGa4MeasurementEvent(
        event,
        {
          enabled: true,
          measurementId: 'G-12345678',
        },
        { measurementProtocolSecret: 'ga4-secret' },
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('measurement_id=G-12345678');
      expect(calledUrl).toContain('api_secret=ga4-secret');
    });
  });

  describe('Custom Webhook', () => {
    it('sends POST request to custom webhook endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ recorded: true }),
      });

      const event: ServerTrackingEvent = {
        eventName: 'CustomAction',
        params: { foo: 'bar' },
      };

      const result = await sendCustomWebhookEvent(
        event,
        { enabled: true },
        { endpointUrl: 'https://myapi.com/webhook', headers: { 'X-Signature': 'sig-xyz' } },
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://myapi.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'X-Signature': 'sig-xyz' }),
        }),
      );
    });
  });

  describe('High-Level dispatchServerTracking (secrets via resolver)', () => {
    const okFetch = () =>
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

    const fullConfig: TrackingConfig = {
      enabled: true,
      providers: {
        meta: { enabled: true, credentialId: 'cred_meta', pixelId: 'META_123', capiEnabled: true, testEventCode: '' },
        tiktok: {
          enabled: true,
          credentialId: 'cred_tt',
          pixelId: 'TT_123',
          eventsApiEnabled: true,
          testEventCode: '',
        },
        google: { enabled: true, credentialId: 'cred_ga', measurementId: 'G-1234' },
        custom: { enabled: true, credentialId: 'cred_hook' },
      },
    };

    const resolver: TrackingSecretResolver = async ({ provider }) => {
      switch (provider) {
        case 'meta':
          return { capiAccessToken: 'meta-token' };
        case 'tiktok':
          return { accessToken: 'tt-token' };
        case 'google':
          return { measurementProtocolSecret: 'ga-sec' };
        case 'custom':
          return { endpointUrl: 'https://hooks.example.com/t', headers: { 'X-Key': 'k' } };
        default:
          return null;
      }
    };

    it('skips dispatching if tracking is disabled globally (dynamic toggle)', async () => {
      const mockFetch = vi.fn();
      const outcome = await dispatchServerTracking(
        { eventName: 'Lead' },
        { ...fullConfig, enabled: false },
        { fetchFn: mockFetch as unknown as typeof fetch, resolveSecrets: resolver },
      );

      expect(outcome.skipped).toBe(true);
      expect(outcome.reason).toContain('disabled globally');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resolves secrets by credentialId and dispatches to all active providers', async () => {
      const mockFetch = okFetch();
      const resolveSpy = vi.fn(resolver);

      const outcome = await dispatchServerTracking(
        { eventName: 'Purchase', params: { value: 100 } },
        fullConfig,
        { fetchFn: mockFetch as unknown as typeof fetch, resolveSecrets: resolveSpy, documentId: 'page_1' },
      );

      expect(outcome.success).toBe(true);
      expect(outcome.eventId).toBeDefined();
      expect(outcome.results.meta?.success).toBe(true);
      expect(outcome.results.tiktok?.success).toBe(true);
      expect(outcome.results.google?.success).toBe(true);
      expect(outcome.results.custom?.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(resolveSpy).toHaveBeenCalledWith({ provider: 'meta', credentialId: 'cred_meta', documentId: 'page_1' });

      const urls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('api_secret=ga-sec'))).toBe(true);
      expect(urls).toContain('https://hooks.example.com/t');
      const metaCall = mockFetch.mock.calls.find((c) => String(c[0]).includes('graph.facebook.com'));
      expect(metaCall?.[1].headers.Authorization).toBe('Bearer meta-token');
    });

    it('skips every provider with a reason when no resolver is configured (no throw)', async () => {
      const mockFetch = okFetch();
      const outcome = await dispatchServerTracking({ eventName: 'Lead' }, fullConfig, {
        fetchFn: mockFetch as unknown as typeof fetch,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(outcome.success).toBe(true);
      expect(outcome.skipped).toBe(true);
      expect(outcome.results.meta?.skipped).toBe(true);
      expect(outcome.results.meta?.reason).toContain('resolveSecrets');
    });

    it('skips only providers whose secret is missing', async () => {
      const mockFetch = okFetch();
      const outcome = await dispatchServerTracking({ eventName: 'Lead' }, fullConfig, {
        fetchFn: mockFetch as unknown as typeof fetch,
        resolveSecrets: async (ref) => (ref.provider === 'meta' ? { capiAccessToken: 'x' } : null),
      });

      expect(outcome.success).toBe(true);
      expect(outcome.skipped).toBeUndefined();
      expect(outcome.results.meta?.success).toBe(true);
      expect(outcome.results.meta?.skipped).toBeUndefined();
      expect(outcome.results.tiktok?.skipped).toBe(true);
      expect(outcome.results.tiktok?.reason).toContain('cred_tt');
      expect(outcome.results.custom?.skipped).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('reports resolver errors per provider without throwing', async () => {
      const outcome = await dispatchServerTracking({ eventName: 'Lead' }, fullConfig, {
        fetchFn: okFetch() as unknown as typeof fetch,
        resolveSecrets: () => {
          throw new Error('vault down');
        },
      });
      expect(outcome.success).toBe(false);
      expect(outcome.results.meta?.error).toContain('vault down');
    });

    it('filters by target provider and treats gtm as client-only', async () => {
      const mockFetch = okFetch();
      const onlyMeta = await dispatchServerTracking({ eventName: 'Lead' }, fullConfig, {
        fetchFn: mockFetch as unknown as typeof fetch,
        resolveSecrets: resolver,
        provider: 'meta',
      });
      expect(Object.keys(onlyMeta.results)).toEqual(['meta']);

      const gtm = await dispatchServerTracking({ eventName: 'Lead' }, fullConfig, {
        fetchFn: mockFetch as unknown as typeof fetch,
        resolveSecrets: resolver,
        provider: 'gtm',
      });
      expect(gtm.skipped).toBe(true);
      expect(gtm.reason).toContain('GTM');
    });

    it('simulates in debug mode without network and without secrets', async () => {
      const mockFetch = vi.fn();
      const outcome = await dispatchServerTracking(
        { eventName: 'Lead' },
        { ...fullConfig, debugMode: true },
        { fetchFn: mockFetch as unknown as typeof fetch, onLog: () => {} },
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(outcome.results.meta?.success).toBe(true);
      expect((outcome.results.meta?.data as { simulated?: boolean }).simulated).toBe(true);
    });
  });
});

describe('createTrackingRelayHandler', () => {
  const trustedConfig: TrackingConfig = {
    enabled: true,
    providers: {
      meta: { enabled: true, credentialId: 'cred_meta', pixelId: 'META_1', capiEnabled: true, testEventCode: '' },
    },
  };

  const makeRequest = (body: unknown, init: { origin?: string; method?: string; headers?: Record<string, string> } = {}) =>
    new Request('https://host.example/api/tracking', {
      method: init.method ?? 'POST',
      headers: {
        'content-type': 'application/json',
        ...(init.origin ? { origin: init.origin } : {}),
        ...(init.headers || {}),
      },
      ...(init.method === 'GET' || init.method === 'OPTIONS'
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });

  const validBody = {
    version: 1,
    provider: 'all',
    documentId: 'page_1',
    event: {
      eventName: 'Purchase',
      eventId: 'evt_1',
      params: { value: 10 },
      userData: { email: 'a@b.co', clientIp: '6.6.6.6' },
    },
  };

  it('dispatches a valid request using the trusted config and resolver', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
    const getConfig = vi.fn().mockResolvedValue(trustedConfig);
    const resolveSecrets = vi.fn().mockResolvedValue({ capiAccessToken: 'server-token' });
    const handler = createTrackingRelayHandler({
      getConfig,
      resolveSecrets,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const res = await handler(
      makeRequest(validBody, { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1', 'user-agent': 'UA/1' } }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(TrackingRelayResponseSchema.safeParse(json).success).toBe(true);
    expect(json.success).toBe(true);
    expect(json.eventId).toBe('evt_1');
    expect(json.results.meta.success).toBe(true);
    expect(json.results.meta.data).toBeUndefined();

    expect(getConfig).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'page_1', provider: 'all' }));
    expect(resolveSecrets).toHaveBeenCalledWith({ provider: 'meta', credentialId: 'cred_meta', documentId: 'page_1' });

    const [, init] = fetchFn.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer server-token');
    const sent = JSON.parse(init.body);
    // IP / UA come from request headers, never from the (spoofable) body
    expect(sent.data[0].user_data.client_ip_address).toBe('1.2.3.4');
    expect(sent.data[0].user_data.client_user_agent).toBe('UA/1');
  });

  it('never uses a tracking config sent in the request body', async () => {
    const fetchFn = vi.fn();
    const handler = createTrackingRelayHandler({
      getConfig: () => ({ enabled: false, providers: {} }) as TrackingConfig,
      resolveSecrets: () => ({ capiAccessToken: 'x' }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const res = await handler(makeRequest({ ...validBody, config: trustedConfig, tracking: trustedConfig }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects invalid bodies with 400 INVALID_REQUEST', async () => {
    const handler = createTrackingRelayHandler({ getConfig: () => trustedConfig, resolveSecrets: () => null });

    const notJson = await handler(makeRequest('{nope'));
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error.code).toBe('INVALID_REQUEST');

    const missingEvent = await handler(makeRequest({ version: 1 }));
    expect(missingEvent.status).toBe(400);
    expect((await missingEvent.json()).error.code).toBe('INVALID_REQUEST');
  });

  it('rejects unsupported protocol versions', async () => {
    const handler = createTrackingRelayHandler({ getConfig: () => trustedConfig, resolveSecrets: () => null });
    const res = await handler(makeRequest({ ...validBody, version: 2 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('UNSUPPORTED_VERSION');
  });

  it('enforces allowedOrigins and returns CORS headers for allowed ones', async () => {
    const handler = createTrackingRelayHandler({
      getConfig: () => trustedConfig,
      resolveSecrets: () => null,
      allowedOrigins: ['https://shop.example'],
    });

    const forbidden = await handler(makeRequest(validBody, { origin: 'https://evil.example' }));
    expect(forbidden.status).toBe(403);
    expect((await forbidden.json()).error.code).toBe('FORBIDDEN_ORIGIN');

    const missing = await handler(makeRequest(validBody));
    expect(missing.status).toBe(403);

    const allowed = await handler(makeRequest(validBody, { origin: 'https://shop.example' }));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://shop.example');

    const preflight = await handler(makeRequest(null, { origin: 'https://shop.example', method: 'OPTIONS' }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns 405 for non-POST and 404 when the host has no config', async () => {
    const handler = createTrackingRelayHandler({ getConfig: () => null, resolveSecrets: () => null });
    const get = await handler(makeRequest(null, { method: 'GET' }));
    expect(get.status).toBe(405);

    const noConfig = await handler(makeRequest(validBody));
    expect(noConfig.status).toBe(404);
    expect((await noConfig.json()).error.code).toBe('CONFIG_NOT_FOUND');
  });
});
