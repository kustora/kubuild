import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEventRunner } from '../src/action-runners/tracking';
import { customEventRunner } from '../src/action-runners/navigation-utils';
import { fireBrowserPixel, injectTrackingScripts, removeTrackingScripts } from '../src/tracking/tracking-manager';
import { TrackingRelayRequestSchema, type ActionStep, type TrackingConfig } from '@kubuild/schema';

describe('Renderer Tracking & Action Runner', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;

  let mockWindow: any;
  let mockDocument: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockWindow = {
      location: { href: 'https://example.com/test' },
      fbq: vi.fn(),
      gtag: vi.fn(),
      ttq: { track: vi.fn(), page: vi.fn(), load: vi.fn() },
    };

    mockDocument = {
      head: { appendChild: vi.fn() },
      getElementById: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue({
        setAttribute: vi.fn(),
        id: '',
        src: '',
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([{ parentNode: { insertBefore: vi.fn() } }]),
    };

    globalThis.window = mockWindow;
    globalThis.document = mockDocument;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  describe('fireBrowserPixel', () => {
    it('calls window.fbq when Meta is enabled and window.fbq is available', () => {
      fireBrowserPixel('AddToCart', { value: 150000, currency: 'IDR' }, { eventId: 'evt_123' });

      expect(mockWindow.fbq).toHaveBeenCalledWith(
        'track',
        'AddToCart',
        { value: 150000, currency: 'IDR' },
        { eventID: 'evt_123' },
      );
    });

    it('calls window.fbq trackCustom for custom events like ClickWhatsApp or button clicks', () => {
      fireBrowserPixel('ClickWhatsApp', { button_name: 'Tombol X' }, { eventId: 'evt_wa_1' });

      expect(mockWindow.fbq).toHaveBeenCalledWith(
        'trackCustom',
        'ClickWhatsApp',
        { button_name: 'Tombol X' },
        { eventID: 'evt_wa_1' },
      );
    });

    it('calls window.gtag when Google is enabled', () => {
      fireBrowserPixel('sign_up', { method: 'google' }, { eventId: 'evt_gtag_1' });

      expect(mockWindow.gtag).toHaveBeenCalledWith(
        'event',
        'sign_up',
        { method: 'google', event_id: 'evt_gtag_1' },
      );
    });

    it('calls window.ttq when TikTok is enabled', () => {
      fireBrowserPixel('CompleteRegistration', { value: 0 }, { eventId: 'evt_tt_1' });

      expect(mockWindow.ttq.track).toHaveBeenCalledWith(
        'CompleteRegistration',
        { value: 0 },
        { event_id: 'evt_tt_1' },
      );
    });

    it('does not fire when tracking is disabled globally', () => {
      fireBrowserPixel(
        'Lead',
        {},
        {
          config: { enabled: false, providers: { meta: { enabled: true, pixelId: '123' } } } as any,
        },
      );

      expect(mockWindow.fbq).not.toHaveBeenCalled();
    });
  });

  describe('trackEventRunner', () => {
    it('interpolates variables and dispatches client pixel', async () => {
      const step: ActionStep = {
        id: 'track_step_1',
        type: 'track_event',
        payload: {
          eventName: 'Lead',
          delivery: 'client_only',
          provider: 'meta',
          params: {
            source: 'landing_page',
            product: '{{ form.product_name }}',
          },
          userData: {
            email: '{{ form.email }}',
          },
        },
      };

      const context = {
        form: {
          product_name: 'Super Course',
          email: 'test@student.com',
        },
      };

      const result = await trackEventRunner(step, context, new AbortController().signal);

      expect(result.eventName).toBe('Lead');
      expect(result.params.product).toBe('Super Course');
      expect(result.userData.email).toBe('test@student.com');
      expect(result.clientDispatched).toBe(true);
      expect(mockWindow.fbq).toHaveBeenCalledWith(
        'track',
        'Lead',
        expect.objectContaining({ product: 'Super Course' }),
        expect.objectContaining({ eventID: expect.any(String) }),
      );
    });

    it('skips execution when step is disabled', async () => {
      const step: ActionStep = {
        id: 'track_step_disabled',
        type: 'track_event',
        payload: {
          eventName: 'Purchase',
          enabled: false,
        },
      };

      const result = await trackEventRunner(step, {}, new AbortController().signal);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled');
    });

    it('skips execution when tracking is disabled globally in document', async () => {
      const step: ActionStep = {
        id: 'track_step_doc_disabled',
        type: 'track_event',
        payload: {
          eventName: 'Purchase',
        },
      };

      const context = {
        document: {
          tracking: {
            enabled: false,
          },
        },
      };

      const result = await trackEventRunner(step, context, new AbortController().signal);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('disabled globally');
    });

    const serverStep: ActionStep = {
      id: 'step_server_relay',
      type: 'track_event',
      payload: {
        eventName: 'Purchase',
        delivery: 'server_only',
        provider: 'meta',
        params: { value: 100000 },
        userData: { email: '{{ form.email }}' },
      },
    };

    const trackingDoc = {
      tracking: {
        enabled: true,
        providers: { meta: { enabled: true, pixelId: 'META_999', capiEnabled: true } },
      },
    };

    it('posts a v1 relay request to the host relayUrl (RenderContext.tracking)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ version: 1, success: true, eventId: 'x', results: {} }),
      });

      const result = await trackEventRunner(
        serverStep,
        {
          form: { email: 'buyer@example.com' },
          document: trackingDoc,
          trackingRuntime: { relayUrl: '/api/tracking/relay', documentId: 'page_1', fetchFn: mockFetch },
        },
        new AbortController().signal,
      );

      expect(result.serverDispatched).toBe(true);
      expect(result.clientDispatched).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tracking/relay',
        expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
      );
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(TrackingRelayRequestSchema.safeParse(body).success).toBe(true);
      expect(body.version).toBe(1);
      expect(body.provider).toBe('meta');
      expect(body.documentId).toBe('page_1');
      expect(body.event.eventName).toBe('Purchase');
      expect(body.event.userData.email).toBe('buyer@example.com');
      // no config / secrets are ever sent by the browser
      expect(body.config).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('META_999');
    });

    it('ignores a legacy serverRelayUrl stored in the step payload or document', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
      const onDiag = vi.fn();
      const result = await trackEventRunner(
        { ...serverStep, payload: { ...serverStep.payload, serverRelayUrl: '/evil' } },
        {
          fetch: mockFetch,
          document: {
            tracking: {
              enabled: true,
              providers: { meta: { enabled: true, pixelId: 'M', serverRelayUrl: '/legacy' } },
            },
          },
          reportDiagnostic: onDiag,
        },
        new AbortController().signal,
      );
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.serverDispatched).toBe(false);
      expect(result.serverSkippedReason).toContain('no tracking relay configured');
      expect(onDiag).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRACKING_RELAY_NOT_CONFIGURED' }));
    });

    it('without a relay, skips server delivery but still fires the client pixel', async () => {
      const onLog = vi.fn();
      const result = await trackEventRunner(
        { ...serverStep, payload: { ...serverStep.payload, delivery: 'both' } },
        { document: trackingDoc, trackingRuntime: { onLog } },
        new AbortController().signal,
      );
      expect(result.clientDispatched).toBe(true);
      expect(result.serverDispatched).toBe(false);
      expect(result.serverSkippedReason).toBeDefined();
      expect(mockWindow.fbq).toHaveBeenCalled();
      expect(onLog).toHaveBeenCalledWith(expect.stringContaining('no tracking relay configured'), expect.anything());
    });

    it('reports relay failures as TRACKING_RELAY_FAILED without throwing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ version: 1, success: false, error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin is not allowed' } }),
      });
      const onDiag = vi.fn();
      const result = await trackEventRunner(
        serverStep,
        { document: trackingDoc, trackingRuntime: { relayUrl: '/relay', fetchFn: mockFetch }, reportDiagnostic: onDiag },
        new AbortController().signal,
      );
      expect(result.serverDispatched).toBe(false);
      expect(result.serverError).toBe('Origin is not allowed');
      expect(onDiag).toHaveBeenCalledWith(expect.objectContaining({ code: 'TRACKING_RELAY_FAILED' }));
    });

    it("provider 'gtm' pushes to dataLayer and never calls the relay", async () => {
      mockWindow.dataLayer = [];
      const mockFetch = vi.fn();
      const result = await trackEventRunner(
        {
          id: 'gtm_step',
          type: 'track_event',
          payload: { eventName: 'Lead', provider: 'gtm', delivery: 'both', eventId: 'evt_g', params: { plan: 'pro' } },
        },
        { trackingRuntime: { relayUrl: '/relay', fetchFn: mockFetch } },
        new AbortController().signal,
      );
      expect(mockWindow.dataLayer).toContainEqual({ event: 'Lead', event_id: 'evt_g', plan: 'pro' });
      expect(mockWindow.fbq).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.serverSkippedReason).toContain('GTM');
    });
  });

  describe('customEventRunner', () => {
    it('dispatches a DOM CustomEvent on window and mirrors to dataLayer', () => {
      mockWindow.dispatchEvent = vi.fn();
      mockWindow.dataLayer = [];

      const step: ActionStep = {
        id: 'step-evt-1',
        type: 'custom_event',
        payload: {
          eventName: 'button:whatsapp_click',
          detail: {
            button_id: 'btn-wa',
            phone: '62812345678',
          },
        },
      };

      const context = {};
      const result = customEventRunner(step, context as any);

      expect(result.eventName).toBe('button:whatsapp_click');
      expect(result.dispatched).toBe(true);
      expect(mockWindow.dispatchEvent).toHaveBeenCalled();
      expect(mockWindow.dataLayer).toContainEqual({
        event: 'button:whatsapp_click',
        button_id: 'btn-wa',
        phone: '62812345678',
      });
    });
  });
});
