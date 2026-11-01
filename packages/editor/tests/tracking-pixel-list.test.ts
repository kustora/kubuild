import { describe, it, expect } from 'vitest';
import {
  availableCredentials,
  buildTrackingConfig,
  initialPagePixels,
  newManualPixel,
  parseEventList,
  pixelFromCredential,
} from '../src/components/modals/tracking-pixel-list';

describe('tracking pixel list helpers', () => {
  it('reads legacy providers as page pixels', () => {
    const pixels = initialPagePixels({
      providers: { gtm: { enabled: true, containerId: 'GTM-1' } },
    });
    expect(pixels).toEqual([
      {
        id: 'legacy-gtm',
        provider: 'gtm',
        enabled: true,
        pixelId: 'GTM-1',
        serverEnabled: false,
        testEventCode: '',
        disabledEvents: [],
      },
    ]);
  });

  it('turns a saved credential into a linked pixel, server-side when the host holds its secret', () => {
    expect(
      pixelFromCredential({
        id: 'c1',
        name: 'GA',
        provider: 'google',
        measurementId: 'G-1',
        hasSecret: true,
      }),
    ).toEqual({
      id: 'c1',
      provider: 'google',
      label: 'GA',
      enabled: true,
      credentialId: 'c1',
      pixelId: 'G-1',
      serverEnabled: true,
      testEventCode: '',
      disabledEvents: [],
    });
    expect(
      pixelFromCredential({
        id: 'c2',
        name: 'GTM',
        provider: 'gtm',
        containerId: 'GTM-1',
        hasSecret: true,
      }).serverEnabled,
    ).toBe(false);
  });

  it('hides inactive, already used and host-applied credentials', () => {
    const page = [pixelFromCredential({ id: 'used', name: 'u', provider: 'meta', pixelId: '1' })];
    const offered = availableCredentials(
      [
        { id: 'used', name: 'u', provider: 'meta', pixelId: '1' },
        { id: 'off', name: 'o', provider: 'meta', pixelId: '2', isActive: false },
        { id: 'host', name: 'h', provider: 'meta', pixelId: '3' },
        { id: 'tt', name: 't', provider: 'tiktok', pixelId: '4' },
        { id: 'free', name: 'f', provider: 'meta', pixelId: '5' },
      ],
      'meta',
      page,
      [{ id: 'h', provider: 'meta', pixelId: '3' }],
    );
    expect(offered.map((c) => c.id)).toEqual(['free']);
  });

  it('saves pixels, inherit settings and no legacy providers; drops empty manual rows', () => {
    const config = buildTrackingConfig({
      enabled: true,
      autoPageView: false,
      debugMode: false,
      defaultDelivery: 'both',
      pixels: [
        {
          ...newManualPixel('meta', 'a'),
          pixelId: ' 111 ',
          label: '  ',
          disabledEvents: ['Purchase', ' '],
        },
        newManualPixel('meta', 'empty'),
        {
          ...newManualPixel('gtm', 'g'),
          pixelId: 'GTM-1',
          serverEnabled: true,
          testEventCode: 'X',
        },
        newManualPixel('custom', 'hook-unlinked'),
        { ...newManualPixel('custom', 'hook'), credentialId: 'cred_hook' },
      ],
      inheritEnabled: true,
      excludedPixelIds: ['host-1'],
    });
    expect(config.providers).toBeUndefined();
    expect(config.inherit).toEqual({ enabled: true, excludedPixelIds: ['host-1'] });
    expect(config.pixels.map((p) => p.id)).toEqual(['a', 'g', 'hook']);
    expect(config.pixels[0]).toEqual({
      id: 'a',
      provider: 'meta',
      enabled: true,
      pixelId: '111',
      serverEnabled: false,
      testEventCode: '',
      disabledEvents: ['Purchase'],
    });
    expect(config.pixels[1]).toMatchObject({ serverEnabled: false, testEventCode: '' });
  });

  it('parses the skipped-events input', () => {
    expect(parseEventList('Purchase, Lead,, ')).toEqual(['Purchase', 'Lead']);
  });
});
