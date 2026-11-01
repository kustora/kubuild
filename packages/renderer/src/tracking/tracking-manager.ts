import type { TrackingConfig, TrackingPixel, TrackingPixelInput } from '@kubuild/schema';
import { resolveTrackingConfig, selectTrackingPixels, type ResolvedTrackingConfig } from '@kubuild/core';

interface TikTokApi {
  track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void;
  page: () => void;
  [key: string]: unknown;
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    ttq?: TikTokApi & {
      load: (pixelId: string) => void;
      /** Per-pixel handle — targets one TikTok pixel when several are loaded. */
      instance?: (pixelId: string) => TikTokApi;
    };
  }
}

const INJECTED_SCRIPT_ATTR = 'data-kubuild-tracking';

/** Anything `resolveTrackingConfig` accepts: a 1.3.0 config, a legacy one, or an already resolved one. */
export type TrackingConfigInput = Partial<TrackingConfig> | ResolvedTrackingConfig;

export interface InjectTrackingOptions {
  /** Host pixels merged in (subject to the config's `inherit` settings). */
  inheritedPixels?: readonly TrackingPixelInput[];
}

// Pixels initialised by this module, so a re-run (new config, remount) only inits new ones.
const initialisedPixels = new Set<string>();

function pixelKey(pixel: TrackingPixel): string {
  return `${pixel.provider}:${pixel.pixelId}`;
}

function appendScript(id: string, provider: string, src: string): void {
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.setAttribute(INJECTED_SCRIPT_ATTR, provider);
  script.src = src;
  const first = document.getElementsByTagName('script')[0];
  if (first?.parentNode) first.parentNode.insertBefore(script, first);
  else document.head.appendChild(script);
}

/** Meta's fbq queue stub + fbevents.js, once per page. */
function ensureMetaLoader(): void {
  if (!window.fbq) {
    /* eslint-disable */
    const n: any = (window.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    } as any);
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    /* eslint-enable */
  }
  if (!document.getElementById('kubuild-tracking-meta')) {
    appendScript('kubuild-tracking-meta', 'meta', 'https://connect.facebook.net/en_US/fbevents.js');
  }
}

/** gtag stub + the gtag.js library, once per page. */
function ensureGtag(firstMeasurementId: string): void {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };
    window.gtag('js', new Date());
  }
  if (!document.getElementById('kubuild-tracking-ga4')) {
    appendScript(
      'kubuild-tracking-ga4',
      'google',
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(firstMeasurementId)}`,
    );
  }
}

/** TikTok's ttq queue stub (official snippet, without the initial load), once per page. */
function ensureTikTokStub(): NonNullable<Window['ttq']> {
  /* eslint-disable */
  const w = window as any;
  if (w.ttq && typeof w.ttq.load === 'function') return w.ttq;
  w.TiktokAnalyticsObject = 'ttq';
  const ttq = (w.ttq = w.ttq || []);
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
  ttq.setAndDefer = function (t: any, e: any) {
    t[e] = function () {
      t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.instance = function (t: any) {
    const e = ttq._i[t] || [];
    for (let n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
    return e;
  };
  ttq.load = function (e: any, n: any) {
    const src = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[e] = [];
    ttq._i[e]._u = src;
    ttq._t = ttq._t || {};
    ttq._t[e] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[e] = n || {};
    appendScript(`kubuild-tracking-tiktok-${e}`, 'tiktok', `${src}?sdkid=${e}&lib=ttq`);
  };
  return ttq;
  /* eslint-enable */
}

function initPixel(pixel: TrackingPixel): void {
  const id = pixel.pixelId;
  switch (pixel.provider) {
    case 'meta':
      ensureMetaLoader();
      window.fbq?.('init', id);
      break;
    case 'google':
      ensureGtag(id);
      window.gtag?.('config', id, { send_page_view: false });
      break;
    case 'gtm':
      window.dataLayer = window.dataLayer || [];
      if (!document.getElementById(`kubuild-tracking-gtm-${id}`)) {
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        appendScript(`kubuild-tracking-gtm-${id}`, 'gtm', `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
      }
      break;
    case 'tiktok':
      ensureTikTokStub().load(id);
      break;
    default:
      // custom: server-side webhook only, nothing to load in the browser.
      break;
  }
}

/** PageView for one pixel. GTM records page views through its own container. */
function firePageView(pixel: TrackingPixel): void {
  switch (pixel.provider) {
    case 'meta':
      window.fbq?.('trackSingle', pixel.pixelId, 'PageView');
      break;
    case 'google':
      window.gtag?.('event', 'page_view', { send_to: pixel.pixelId });
      break;
    case 'tiktok':
      (window.ttq?.instance ? window.ttq.instance(pixel.pixelId) : window.ttq)?.page();
      break;
    default:
      break;
  }
}

/**
 * Injects the client-side scripts of every resolved pixel (Meta Pixel, GA4, GTM, TikTok) —
 * several pixels per provider supported — and, with `autoPageView`, fires one PageView per
 * newly initialised pixel (skipping pixels that list `PageView` in `disabledEvents`).
 * Returns a cleanup that removes the injected scripts.
 */
export function injectTrackingScripts(config?: TrackingConfigInput, options: InjectTrackingOptions = {}): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const resolved = config || options.inheritedPixels?.length ? resolveTrackingConfig(config, options.inheritedPixels) : null;
  if (!resolved || resolved.enabled === false) {
    removeTrackingScripts();
    return () => {};
  }

  for (const pixel of resolved.pixels) {
    if (!pixel.pixelId || pixel.provider === 'custom') continue;
    const key = pixelKey(pixel);
    if (initialisedPixels.has(key)) continue;
    initPixel(pixel);
    initialisedPixels.add(key);
    if (resolved.autoPageView !== false && !pixel.disabledEvents.includes('PageView')) {
      firePageView(pixel);
    }
  }

  return () => {
    removeTrackingScripts();
  };
}

/**
 * Removes all injected tracking scripts from the document head. Pixels are initialised again
 * (with a fresh PageView) on the next injection.
 */
export function removeTrackingScripts(): void {
  initialisedPixels.clear();
  if (typeof document === 'undefined') return;
  const scripts = document.querySelectorAll(`script[${INJECTED_SCRIPT_ATTR}]`);
  scripts.forEach((el) => {
    el.parentNode?.removeChild(el);
  });
}

/**
 * Official Meta Pixel Standard Events.
 * Any other event name should be dispatched using `fbq('trackCustom', ...)`
 */
export const META_STANDARD_EVENTS = new Set([
  'AddPaymentInfo',
  'AddToCart',
  'AddToWishlist',
  'CompleteRegistration',
  'Contact',
  'CustomizeProduct',
  'Donate',
  'FindLocation',
  'InitiateCheckout',
  'Lead',
  'PageView',
  'Purchase',
  'Schedule',
  'Search',
  'StartTrial',
  'SubmitApplication',
  'Subscribe',
  'ViewContent',
]);

export interface FireBrowserPixelOptions {
  eventId?: string;
  /** Tracking config to target. Without it the event is broadcast to whatever pixels are loaded. */
  config?: TrackingConfigInput;
  /** Host pixels merged into `config` (subject to its `inherit` settings). */
  inheritedPixels?: readonly TrackingPixelInput[];
  provider?: 'all' | 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom' | string;
  /** Only these pixel entry ids (`TrackingPixel.id`). */
  pixelIds?: readonly string[];
  eventType?: 'standard' | 'custom';
}

function isCustomMetaEvent(eventName: string, eventType?: 'standard' | 'custom'): boolean {
  return eventType === 'custom' || (!eventType && !META_STANDARD_EVENTS.has(eventName));
}

/** Pre-1.3.0 behaviour for callers without a config: broadcast to every loaded library. */
function broadcastBrowserPixel(
  eventName: string,
  params: Record<string, unknown>,
  options: FireBrowserPixelOptions,
): void {
  const target = options.provider || 'all';
  const eventId = options.eventId;
  if ((target === 'all' || target === 'meta') && typeof window.fbq === 'function') {
    const method = isCustomMetaEvent(eventName, options.eventType) ? 'trackCustom' : 'track';
    if (eventId) window.fbq(method, eventName, params, { eventID: eventId });
    else window.fbq(method, eventName, params);
  }
  if ((target === 'all' || target === 'google') && typeof window.gtag === 'function') {
    window.gtag('event', eventName, { ...params, ...(eventId ? { event_id: eventId } : {}) });
  }
  if ((target === 'all' || target === 'tiktok') && typeof window.ttq?.track === 'function') {
    window.ttq.track(eventName, params, eventId ? { event_id: eventId } : undefined);
  }
  if (target === 'gtm') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ...params, event: eventName, ...(eventId ? { event_id: eventId } : {}) });
  }
}

/**
 * Sends an event to the browser pixels of a tracking config — each targeted pixel on its own
 * (Meta `trackSingle`, TikTok `ttq.instance(id)`, GA4 `send_to`), so several pixels of one
 * provider each receive it exactly once. Pixels are filtered by `provider`, `pixelIds` and
 * their `disabledEvents`. GTM gets one `dataLayer` push when any GTM pixel is targeted.
 */
export function fireBrowserPixel(
  eventName: string,
  params?: Record<string, unknown>,
  options: FireBrowserPixelOptions = {},
): void {
  if (typeof window === 'undefined') return;
  const eventParams = params || {};
  const eventId = options.eventId;

  if (!options.config && !options.inheritedPixels?.length) {
    broadcastBrowserPixel(eventName, eventParams, options);
    return;
  }

  const resolved = resolveTrackingConfig(options.config, options.inheritedPixels);
  if (resolved.enabled === false) return;

  const pixels = selectTrackingPixels(resolved, {
    provider: options.provider || 'all',
    pixelIds: options.pixelIds,
    eventName,
  }).filter((pixel) => pixel.pixelId && pixel.provider !== 'custom');

  if (resolved.debugMode) {
    console.log(`[Browser Pixel Track: ${eventName}]`, {
      eventId,
      pixels: pixels.map((p) => p.id),
      eventType: options.eventType,
      params: eventParams,
    });
  }

  let gtmPushed = false;
  for (const pixel of pixels) {
    switch (pixel.provider) {
      case 'meta':
        if (typeof window.fbq === 'function') {
          const method = isCustomMetaEvent(eventName, options.eventType) ? 'trackSingleCustom' : 'trackSingle';
          window.fbq(method, pixel.pixelId, eventName, eventParams, ...(eventId ? [{ eventID: eventId }] : []));
        }
        break;
      case 'google':
        if (typeof window.gtag === 'function') {
          window.gtag('event', eventName, {
            ...eventParams,
            send_to: pixel.pixelId,
            ...(eventId ? { event_id: eventId } : {}),
          });
        }
        break;
      case 'tiktok': {
        const ttq = window.ttq?.instance ? window.ttq.instance(pixel.pixelId) : window.ttq;
        if (ttq && typeof ttq.track === 'function') {
          ttq.track(eventName, eventParams, eventId ? { event_id: eventId } : undefined);
        }
        break;
      }
      case 'gtm':
        if (!gtmPushed) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ ...eventParams, event: eventName, ...(eventId ? { event_id: eventId } : {}) });
          gtmPushed = true;
        }
        break;
      default:
        break;
    }
  }
}

/** Browser identifiers ad platforms use to match server-side events to a visitor. */
export interface BrowserTrackingIds {
  fbp?: string;
  fbc?: string;
  ttp?: string;
  ttclid?: string;
  /** GA4 client id, taken from the `_ga` cookie. */
  clientId?: string;
}

function readCookie(name: string): string | undefined {
  const cookies = typeof document.cookie === 'string' ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator > 0 && cookie.slice(0, separator) === name) {
      const value = cookie.slice(separator + 1);
      try {
        return decodeURIComponent(value) || undefined;
      } catch {
        return value || undefined;
      }
    }
  }
  return undefined;
}

/**
 * Reads the `_fbp`, `_fbc` and `_ttp` cookies, `ttclid` from the URL and the GA4 client id
 * from `_ga`. Without an `_fbc` cookie, `fbc` is built from an `fbclid` query param.
 * Returns only the ids present, and `{}` outside a browser.
 */
export function collectBrowserTrackingIds(): BrowserTrackingIds {
  if (typeof window === 'undefined' || typeof document === 'undefined') return {};

  let query: URLSearchParams | undefined;
  try {
    query = new URL(window.location.href).searchParams;
  } catch {
    query = undefined;
  }

  const ids: BrowserTrackingIds = {};
  const fbp = readCookie('_fbp');
  if (fbp) ids.fbp = fbp;

  const fbclid = query?.get('fbclid');
  const fbc = readCookie('_fbc') || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
  if (fbc) ids.fbc = fbc;

  const ttp = readCookie('_ttp');
  if (ttp) ids.ttp = ttp;

  const ttclid = query?.get('ttclid');
  if (ttclid) ids.ttclid = ttclid;

  // `_ga` is `GA1.<n>.<random>.<timestamp>`; the client id is the last two parts.
  const gaParts = readCookie('_ga')?.split('.') ?? [];
  if (gaParts.length >= 4) ids.clientId = gaParts.slice(-2).join('.');

  return ids;
}
