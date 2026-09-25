import type { TrackingConfig } from '@kubuild/schema';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    ttq?: {
      track: (
        event: string,
        params?: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => void;
      page: () => void;
      load: (pixelId: string) => void;
      [key: string]: unknown;
    };
  }
}

const INJECTED_SCRIPT_ATTR = 'data-kubuild-tracking';

/**
 * Injects official client-side tracking scripts (Meta Pixel, Google Analytics 4, TikTok Pixel).
 * Returns a cleanup function that removes injected scripts when component unmounts or tracking is disabled.
 */
export function injectTrackingScripts(config?: TrackingConfig): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // If tracking is disabled globally, do not inject scripts and clean up any existing ones
  if (!config || config.enabled === false) {
    removeTrackingScripts();
    return () => {};
  }

  const providers = config.providers || {};

  // 1. Meta (Facebook) Pixel
  if (providers.meta && providers.meta.enabled !== false && providers.meta.pixelId) {
    const metaPixelId = providers.meta.pixelId.trim();
    const scriptId = `kubuild-tracking-meta-${metaPixelId}`;

    if (!document.getElementById(scriptId)) {
      /* eslint-disable */
      (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.id = scriptId;
        t.setAttribute(INJECTED_SCRIPT_ATTR, 'meta');
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s && s.parentNode ? s.parentNode.insertBefore(t, s) : b.head.appendChild(t);
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */

      if (window.fbq) {
        window.fbq('init', metaPixelId);
        if (config.autoPageView !== false) {
          window.fbq('track', 'PageView');
        }
      }
    }
  }

  // 2. Google Analytics 4 (gtag.js)
  if (providers.google && providers.google.enabled !== false && providers.google.measurementId) {
    const measurementId = providers.google.measurementId.trim();
    const scriptId = `kubuild-tracking-ga4-${measurementId}`;

    if (!document.getElementById(scriptId)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function () {
          // eslint-disable-next-line prefer-rest-params
          window.dataLayer?.push(arguments);
        };
      window.gtag('js', new Date());
      window.gtag('config', measurementId, { send_page_view: Boolean(config.autoPageView !== false) });

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.setAttribute(INJECTED_SCRIPT_ATTR, 'google');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }
  }

  // 2b. Google Tag Manager (GTM)
  if (providers.gtm && providers.gtm.enabled !== false && providers.gtm.containerId) {
    const containerId = providers.gtm.containerId.trim();
    const scriptId = `kubuild-tracking-gtm-${containerId}`;

    if (!document.getElementById(scriptId)) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.setAttribute(INJECTED_SCRIPT_ATTR, 'gtm');
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
      document.head.appendChild(script);
    }
  }

  // 3. TikTok Pixel
  if (providers.tiktok && providers.tiktok.enabled !== false && providers.tiktok.pixelId) {
    const tiktokPixelId = providers.tiktok.pixelId.trim();
    const scriptId = `kubuild-tracking-tiktok-${tiktokPixelId}`;

    if (!document.getElementById(scriptId)) {
      /* eslint-disable */
      (function (w: any, d: any, t: any) {
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        ttq.methods = [
          'page',
          'track',
          'identify',
          'instances',
          'debug',
          'on',
          'off',
          'once',
          'ready',
          'alias',
          'group',
          'enableCookie',
          'disableCookie',
        ];
        ttq.setAndDefer = function (t: any, e: any) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (t: any) {
          for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)
            ttq.setAndDefer(e, ttq.methods[n]);
          return e;
        };
        ttq.load = function (e: any, n: any) {
          var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          (ttq._i = ttq._i || {}),
            (ttq._i[e] = []),
            (ttq._i[e]._u = i),
            (ttq._t = ttq._t || {}),
            (ttq._t[e] = +new Date()),
            (ttq._o = ttq._o || {}),
            (ttq._o[e] = n || {});
          var o = document.createElement('script');
          (o.type = 'text/javascript'), (o.async = !0), (o.src = i + '?sdkid=' + e + '&lib=' + t);
          o.id = scriptId;
          o.setAttribute(INJECTED_SCRIPT_ATTR, 'tiktok');
          var a = document.getElementsByTagName('script')[0];
          a && a.parentNode ? a.parentNode.insertBefore(o, a) : document.head.appendChild(o);
        };
        ttq.load(tiktokPixelId);
        if (config.autoPageView !== false) {
          ttq.page();
        }
      })(window, document, 'ttq');
      /* eslint-enable */
    }
  }

  return () => {
    removeTrackingScripts();
  };
}

/**
 * Removes all injected tracking scripts from the document head.
 */
export function removeTrackingScripts(): void {
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
  config?: TrackingConfig;
  provider?: 'all' | 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom' | string;
  eventType?: 'standard' | 'custom';
}

/**
 * Dispatches an event to the browser pixel scripts if installed and active.
 */
export function fireBrowserPixel(
  eventName: string,
  params?: Record<string, unknown>,
  options?: FireBrowserPixelOptions,
): void {
  if (typeof window === 'undefined') return;

  const config = options?.config;
  // If master switch disabled, do not fire
  if (config && config.enabled === false) return;

  const targetProvider = options?.provider || 'all';
  const eventId = options?.eventId;
  const eventParams = params || {};
  const eventType = options?.eventType;

  const isMetaAllowed =
    (targetProvider === 'all' || targetProvider === 'meta') &&
    (!config?.providers?.meta || config.providers.meta.enabled !== false);

  const isGoogleAllowed =
    (targetProvider === 'all' || targetProvider === 'google') &&
    (!config?.providers?.google || config.providers.google.enabled !== false);

  const isTikTokAllowed =
    (targetProvider === 'all' || targetProvider === 'tiktok') &&
    (!config?.providers?.tiktok || config.providers.tiktok.enabled !== false);

  // GTM: explicit 'gtm' target always pushes; 'all' pushes only when a GTM container is configured.
  const gtmConfig = config?.providers?.gtm;
  const isGtmAllowed =
    (targetProvider === 'gtm' && (!gtmConfig || gtmConfig.enabled !== false)) ||
    (targetProvider === 'all' && !!gtmConfig && gtmConfig.enabled !== false && !!gtmConfig.containerId);

  if (config?.debugMode) {
    // eslint-disable-next-line no-console
    console.log(`[Browser Pixel Track: ${eventName}]`, {
      eventId,
      targetProvider,
      eventType,
      params: eventParams,
    });
  }

  // 1. Fire Meta Pixel (uses trackCustom for custom events, track for standard events)
  if (isMetaAllowed && typeof window.fbq === 'function') {
    const isCustom = eventType === 'custom' || (!eventType && !META_STANDARD_EVENTS.has(eventName));
    const metaMethod = isCustom ? 'trackCustom' : 'track';

    if (eventId) {
      window.fbq(metaMethod, eventName, eventParams, { eventID: eventId });
    } else {
      window.fbq(metaMethod, eventName, eventParams);
    }
  }

  // 2. Fire Google Analytics (gtag)
  if (isGoogleAllowed && typeof window.gtag === 'function') {
    window.gtag('event', eventName, {
      ...eventParams,
      ...(eventId ? { event_id: eventId } : {}),
    });
  }

  // 3. Fire TikTok Pixel
  if (isTikTokAllowed && window.ttq && typeof window.ttq.track === 'function') {
    window.ttq.track(eventName, eventParams, eventId ? { event_id: eventId } : undefined);
  }

  // 4. Push to Google Tag Manager dataLayer
  if (isGtmAllowed) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      ...eventParams,
      event: eventName,
      ...(eventId ? { event_id: eventId } : {}),
    });
  }
}
