import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireBrowserPixel,
  injectTrackingScripts,
  removeTrackingScripts,
} from '../src/tracking/tracking-manager';
import { trackEventRunner } from '../src/action-runners/tracking';
import type { ActionStep } from '@kubuild/schema';

const pixel = (
  id: string,
  provider: 'meta' | 'tiktok' | 'google' | 'gtm',
  pixelId: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  provider,
  pixelId,
  ...extra,
});

describe('multi-pixel browser tracking', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  let mockWindow: any;
  let ttqInstances: Record<
    string,
    { track: ReturnType<typeof vi.fn>; page: ReturnType<typeof vi.fn> }
  >;

  beforeEach(() => {
    ttqInstances = {};
    const instance = (id: string) => (ttqInstances[id] ??= { track: vi.fn(), page: vi.fn() });
    mockWindow = {
      location: { href: 'https://example.com/' },
      fbq: vi.fn(),
      gtag: vi.fn(),
      ttq: { track: vi.fn(), page: vi.fn(), load: vi.fn(), instance: vi.fn(instance) },
    };
    globalThis.window = mockWindow;
    globalThis.document = {
      head: { appendChild: vi.fn() },
      getElementById: vi.fn().mockReturnValue(null),
      createElement: vi.fn().mockReturnValue({ setAttribute: vi.fn() }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      getElementsByTagName: vi.fn().mockReturnValue([{ parentNode: { insertBefore: vi.fn() } }]),
    } as any;
    removeTrackingScripts();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  });

  it('initialises every pixel of a provider and fires one PageView each', () => {
    injectTrackingScripts(
      {
        pixels: [
          pixel('a', 'meta', '111'),
          pixel('b', 'meta', '222', { disabledEvents: ['PageView'] }),
        ],
      },
      { inheritedPixels: [pixel('host', 'tiktok', 'TT1')] },
    );

    expect(mockWindow.fbq).toHaveBeenCalledWith('init', '111');
    expect(mockWindow.fbq).toHaveBeenCalledWith('init', '222');
    expect(mockWindow.fbq).toHaveBeenCalledWith('trackSingle', '111', 'PageView');
    expect(mockWindow.fbq).not.toHaveBeenCalledWith('trackSingle', '222', 'PageView');
    expect(mockWindow.ttq.load).toHaveBeenCalledWith('TT1');
    expect(ttqInstances.TT1.page).toHaveBeenCalledTimes(1);
  });

  it('does not re-initialise pixels on a second injection', () => {
    const config = { pixels: [pixel('a', 'meta', '111')] };
    injectTrackingScripts(config);
    injectTrackingScripts(config);
    expect(mockWindow.fbq.mock.calls.filter((c: unknown[]) => c[0] === 'init')).toHaveLength(1);
  });

  it('sends an event to each targeted pixel on its own', () => {
    const config = {
      pixels: [
        pixel('a', 'meta', '111'),
        pixel('b', 'meta', '222', { disabledEvents: ['Purchase'] }),
        pixel('g', 'google', 'G-1'),
        pixel('t', 'tiktok', 'TT1'),
      ],
    };

    fireBrowserPixel('Purchase', { value: 10 }, { config, eventId: 'evt_1' });

    expect(mockWindow.fbq).toHaveBeenCalledWith(
      'trackSingle',
      '111',
      'Purchase',
      { value: 10 },
      { eventID: 'evt_1' },
    );
    expect(mockWindow.fbq).not.toHaveBeenCalledWith(
      'trackSingle',
      '222',
      'Purchase',
      expect.anything(),
      expect.anything(),
    );
    expect(mockWindow.gtag).toHaveBeenCalledWith('event', 'Purchase', {
      value: 10,
      send_to: 'G-1',
      event_id: 'evt_1',
    });
    expect(ttqInstances.TT1.track).toHaveBeenCalledWith(
      'Purchase',
      { value: 10 },
      { event_id: 'evt_1' },
    );
    expect(mockWindow.ttq.track).not.toHaveBeenCalled();
  });

  it('narrows to pixelIds and uses trackSingleCustom for custom Meta events', () => {
    const config = { pixels: [pixel('a', 'meta', '111'), pixel('b', 'meta', '222')] };
    fireBrowserPixel('WatchedVideo', {}, { config, pixelIds: ['b'] });
    expect(mockWindow.fbq).toHaveBeenCalledTimes(1);
    expect(mockWindow.fbq).toHaveBeenCalledWith('trackSingleCustom', '222', 'WatchedVideo', {});
  });

  it('track_event steps fire into the host-inherited pixels too', async () => {
    const step = {
      id: 's',
      type: 'track_event',
      payload: { eventName: 'Lead', delivery: 'client_only' },
    } as unknown as ActionStep;
    await trackEventRunner(step, {
      document: { tracking: { pixels: [pixel('page', 'meta', '333')] } },
      trackingRuntime: { inheritedPixels: [pixel('host', 'meta', '111')] },
    } as any);

    const targets = mockWindow.fbq.mock.calls.map((c: unknown[]) => c[1]);
    expect(targets).toEqual(['111', '333']);
  });
});
