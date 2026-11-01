import { describe, it, expect, vi } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@kubuild/schema';
import {
  createBlankDocument,
  resolveTrackingConfig,
  selectTrackingPixels,
  legacyProvidersToPixels,
  migrateDocument,
  dispatchServerTracking,
  createTrackingRelayHandler,
} from '../src';

const meta = (id: string, pixelId: string, extra: Record<string, unknown> = {}) => ({
  id,
  provider: 'meta' as const,
  pixelId,
  ...extra,
});

describe('resolveTrackingConfig', () => {
  it('merges host pixels before the page pixels, minus exclusions', () => {
    const resolved = resolveTrackingConfig(
      {
        pixels: [meta('page-meta', '333')],
        inherit: { enabled: true, excludedPixelIds: ['host-2'] },
      },
      [meta('host-1', '111'), meta('host-2', '222')],
    );
    expect(resolved.pixels.map((p) => p.id)).toEqual(['host-1', 'page-meta']);
    expect(resolved.pixels[0]).toMatchObject({
      enabled: true,
      serverEnabled: false,
      disabledEvents: [],
    });
  });

  it('ignores host pixels when the page opts out of inheriting', () => {
    const resolved = resolveTrackingConfig({ inherit: { enabled: false, excludedPixelIds: [] } }, [
      meta('host-1', '111'),
    ]);
    expect(resolved.pixels).toEqual([]);
  });

  it('keeps the first of two pixels with the same provider + public id, and drops disabled ones', () => {
    const resolved = resolveTrackingConfig(
      { pixels: [meta('page-copy', '111'), meta('off', '444', { enabled: false })] },
      [meta('host-1', '111')],
    );
    expect(resolved.pixels.map((p) => p.id)).toEqual(['host-1']);
  });

  it('converts a legacy providers map', () => {
    const resolved = resolveTrackingConfig({
      providers: {
        meta: { enabled: true, pixelId: '111', capiEnabled: true, testEventCode: 'T1' },
        google: { enabled: true, measurementId: 'G-1' },
        gtm: { enabled: true, containerId: '' },
      },
    });
    expect(resolved.pixels).toEqual([
      {
        id: 'legacy-meta',
        provider: 'meta',
        enabled: true,
        pixelId: '111',
        serverEnabled: true,
        testEventCode: 'T1',
        disabledEvents: [],
      },
      {
        id: 'legacy-google',
        provider: 'google',
        enabled: true,
        pixelId: 'G-1',
        serverEnabled: true,
        testEventCode: '',
        disabledEvents: [],
      },
    ]);
  });

  it('applies defaults to a missing config', () => {
    expect(resolveTrackingConfig(undefined)).toEqual({
      enabled: true,
      debugMode: false,
      autoPageView: true,
      defaultDelivery: 'both',
      inherit: { enabled: true, excludedPixelIds: [] },
      pixels: [],
    });
  });
});

describe('selectTrackingPixels', () => {
  const config = resolveTrackingConfig({
    pixels: [
      meta('a', '111'),
      meta('b', '222', { disabledEvents: ['Purchase'] }),
      { id: 'g', provider: 'google', pixelId: 'G-1' },
    ],
  });

  it('filters by provider, pixel ids and disabled events', () => {
    expect(selectTrackingPixels(config, { provider: 'meta' }).map((p) => p.id)).toEqual(['a', 'b']);
    expect(selectTrackingPixels(config, { pixelIds: ['b', 'g'] }).map((p) => p.id)).toEqual([
      'b',
      'g',
    ]);
    expect(selectTrackingPixels(config, { eventName: 'Purchase' }).map((p) => p.id)).toEqual([
      'a',
      'g',
    ]);
  });
});

describe('1.2.0 -> 1.3.0 migration', () => {
  function doc120(tracking: Record<string, unknown>) {
    const doc = createBlankDocument('Old tracking') as unknown as Record<string, unknown>;
    doc.version = '1.2.0';
    doc.tracking = tracking;
    doc.metadata = { ...(doc.metadata as object), tracking: JSON.parse(JSON.stringify(tracking)) };
    return doc;
  }

  it('turns providers into pixels in tracking and metadata.tracking, with a warning', () => {
    const result = migrateDocument(
      doc120({
        providers: {
          tiktok: { enabled: true, pixelId: 'TT1', eventsApiEnabled: true, credentialId: 'c' },
        },
      }),
    );
    expect(result.success).toBe(true);
    const tracking = result.document!.tracking!;
    expect(result.document!.version).toBe(CURRENT_SCHEMA_VERSION);
    expect(tracking.providers).toBeUndefined();
    expect(tracking.pixels).toEqual([
      {
        id: 'legacy-tiktok',
        provider: 'tiktok',
        enabled: true,
        credentialId: 'c',
        pixelId: 'TT1',
        serverEnabled: true,
        testEventCode: '',
        disabledEvents: [],
      },
    ]);
    expect(result.document!.metadata!.tracking!.pixels).toHaveLength(1);
    const warning = result.diagnostic.warnings?.find(
      (w) => w.code === 'TRACKING_PROVIDERS_CONVERTED',
    );
    expect(warning?.paths).toEqual(['tracking.providers', 'metadata.tracking.providers']);
  });

  it('drops provider tabs that were saved empty', () => {
    expect(
      legacyProvidersToPixels({
        meta: { enabled: true, pixelId: '', capiEnabled: false, testEventCode: '' },
      }),
    ).toEqual([]);
  });
});

describe('multi-pixel server dispatch', () => {
  const okFetch = () =>
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  const resolveSecrets = vi.fn(async ({ credentialId }: { credentialId?: string }) =>
    credentialId ? { capiAccessToken: `token-${credentialId}` } : null,
  );

  it('delivers to every server-enabled pixel of a provider, each with its own secret', async () => {
    const fetchFn = okFetch();
    const outcome = await dispatchServerTracking(
      { eventName: 'Lead' },
      {
        pixels: [
          meta('own', '111', { serverEnabled: true, credentialId: 'c1' }),
          meta('page', '333'),
        ],
      },
      {
        fetchFn: fetchFn as unknown as typeof fetch,
        resolveSecrets,
        inheritedPixels: [meta('agency', '222', { serverEnabled: true, credentialId: 'c2' })],
      },
    );

    expect(Object.keys(outcome.results).sort()).toEqual(['meta:agency', 'meta:own']);
    expect(outcome.results['meta:own']).toMatchObject({
      provider: 'meta',
      pixelId: 'own',
      success: true,
    });
    const urls = fetchFn.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/111/events'))).toBe(true);
    expect(urls.some((u) => u.includes('/222/events'))).toBe(true);
    const auth = fetchFn.mock.calls.map((c) => c[1].headers.Authorization).sort();
    expect(auth).toEqual(['Bearer token-c1', 'Bearer token-c2']);
  });

  it('honours pixelIds and disabledEvents', async () => {
    const fetchFn = okFetch();
    const config = {
      pixels: [
        meta('a', '111', { serverEnabled: true, credentialId: 'c1' }),
        meta('b', '222', { serverEnabled: true, credentialId: 'c2', disabledEvents: ['Purchase'] }),
      ],
    };
    const purchase = await dispatchServerTracking({ eventName: 'Purchase' }, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
      resolveSecrets,
    });
    expect(Object.keys(purchase.results)).toEqual(['meta:a']);

    const onlyB = await dispatchServerTracking({ eventName: 'Lead' }, config, {
      fetchFn: fetchFn as unknown as typeof fetch,
      resolveSecrets,
      pixelIds: ['b'],
    });
    expect(Object.keys(onlyB.results)).toEqual(['meta:b']);
  });
});

describe('relay isEventAllowed and pixelIds', () => {
  const request = (body: unknown) =>
    new Request('https://host.example/relay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('rejects events the host does not allow from the browser', async () => {
    const getConfig = vi.fn();
    const handler = createTrackingRelayHandler({
      getConfig,
      resolveSecrets: () => null,
      isEventAllowed: (event) => event.eventName !== 'Purchase',
    });
    const res = await handler(request({ version: 1, event: { eventName: 'Purchase' } }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('EVENT_NOT_ALLOWED');
    expect(getConfig).not.toHaveBeenCalled();
  });

  it('narrows delivery to the requested pixel ids', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    const handler = createTrackingRelayHandler({
      getConfig: () => ({
        pixels: [
          meta('a', '111', { serverEnabled: true, credentialId: 'c1' }),
          meta('b', '222', { serverEnabled: true, credentialId: 'c2' }),
        ],
      }),
      resolveSecrets: () => ({ capiAccessToken: 't' }),
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    const res = await handler(
      request({ version: 1, event: { eventName: 'Lead' }, pixelIds: ['b'] }),
    );
    const json = await res.json();
    expect(Object.keys(json.results)).toEqual(['meta:b']);
    expect(json.results['meta:b'].pixelId).toBe('b');
  });
});
