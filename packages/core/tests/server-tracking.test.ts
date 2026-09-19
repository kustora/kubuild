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
  type ServerTrackingEvent,
} from '../src';
import type { TrackingConfig } from '@kubuild/schema';

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
          capiAccessToken: 'test-token',
          testEventCode: 'TEST9999',
          serverRelayUrl: '',
        },
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
        { enabled: true, pixelId: '', capiEnabled: true, capiAccessToken: '', testEventCode: '', serverRelayUrl: '' },
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('missing');
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
          accessToken: 'tt-access-token',
          testEventCode: 'TT_TEST',
          serverRelayUrl: '',
        },
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
          measurementProtocolSecret: 'ga4-secret',
          serverRelayUrl: '',
        },
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
        {
          enabled: true,
          endpointUrl: 'https://myapi.com/webhook',
          headers: { 'X-Signature': 'sig-xyz' },
        },
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

  describe('High-Level dispatchServerTracking', () => {
    it('skips dispatching if tracking is disabled globally (dynamic toggle)', async () => {
      const mockFetch = vi.fn();
      const config: TrackingConfig = {
        enabled: false,
        providers: {
          meta: {
            enabled: true,
            pixelId: '123',
            capiEnabled: true,
            capiAccessToken: 'token',
            testEventCode: '',
            serverRelayUrl: '',
          },
        },
      };

      const outcome = await dispatchServerTracking(
        { eventName: 'Lead' },
        config,
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(outcome.skipped).toBe(true);
      expect(outcome.reason).toContain('disabled globally');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('dispatches to all active providers simultaneously with deduplication eventId', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const config: TrackingConfig = {
        enabled: true,
        providers: {
          meta: {
            enabled: true,
            pixelId: 'META_123',
            capiEnabled: true,
            capiAccessToken: 'meta-token',
            testEventCode: '',
            serverRelayUrl: '',
          },
          tiktok: {
            enabled: true,
            pixelId: 'TT_123',
            eventsApiEnabled: true,
            accessToken: 'tt-token',
            testEventCode: '',
            serverRelayUrl: '',
          },
          google: {
            enabled: true,
            measurementId: 'G-1234',
            measurementProtocolSecret: 'ga-sec',
            serverRelayUrl: '',
          },
        },
      };

      const outcome = await dispatchServerTracking(
        { eventName: 'Purchase', params: { value: 100 } },
        config,
        { fetchFn: mockFetch as unknown as typeof fetch },
      );

      expect(outcome.success).toBe(true);
      expect(outcome.eventId).toBeDefined();
      expect(outcome.results.meta?.success).toBe(true);
      expect(outcome.results.tiktok?.success).toBe(true);
      expect(outcome.results.google?.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
