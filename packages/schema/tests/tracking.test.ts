import { describe, it, expect } from 'vitest';
import {
  TrackingConfigSchema,
  TrackEventStepPayloadSchema,
  isTrackingConfig,
  isTrackEventStepPayload,
  ActionStepSchema,
  PageDocumentSchema,
  ProjectDocumentSchema,
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

    const parsed = TrackingConfigSchema.parse(config);
    expect(parsed.providers.meta?.capiEnabled).toBe(true);
    expect(parsed.providers.meta?.testEventCode).toBe('TEST12345');
    expect(parsed.providers.tiktok?.enabled).toBe(false);
    expect(parsed.providers.custom?.headers?.['X-Custom-Auth']).toBe('Bearer 123');
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
