import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackEventRunner } from '../src/action-runners/tracking';
import { customEventRunner } from '../src/action-runners/navigation-utils';
import { fireBrowserPixel, injectTrackingScripts, removeTrackingScripts } from '../src/tracking/tracking-manager';
import type { ActionStep, TrackingConfig } from '@kubuild/schema';

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

    it('posts to serverRelayUrl when delivery is server_only or both', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

      const step: ActionStep = {
        id: 'step_server_relay',
        type: 'track_event',
        payload: {
          eventName: 'Purchase',
          delivery: 'server_only',
          provider: 'meta',
          params: { value: 100000 },
        },
      };

      const context = {
        fetch: mockFetch,
        document: {
          tracking: {
            enabled: true,
            providers: {
              meta: {
                enabled: true,
                pixelId: 'META_999',
                serverRelayUrl: '/api/tracking/relay',
              },
            },
          },
        },
      };

      const result = await trackEventRunner(step, context, new AbortController().signal);
      expect(result.serverDispatched).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tracking/relay',
        expect.objectContaining({
          method: 'POST',
        }),
      );
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
