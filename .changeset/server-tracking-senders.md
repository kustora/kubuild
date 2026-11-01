---
"@kubuild/core": patch
"@kubuild/renderer": patch
---

Server tracking fixes:

- TikTok Events API: a `code` other than `0` in an HTTP 200 response is now reported as a failure, and `userData.ttp`, `userData.ttclid` and `userData.externalId` (hashed) are sent as `user.ttp`, `user.ttclid` and `user.external_id`.
- Meta CAPI: the Graph API version defaults to `v26.0` (`v19.0` expired on 2026-05-21) and can be set with `ServerTrackingOptions.metaApiVersion`. The default is exported as `DEFAULT_META_GRAPH_API_VERSION`.
- `ServerTrackingEvent.userData` types `ttp`, `ttclid` and `clientId` (GA4).
- `normalizePhone` docs: it only strips non-digits; pass numbers with their country code.
- Renderer: the `track_event` relay request now carries the visitor's `_fbp`, `_fbc`, `_ttp`, `ttclid` and GA4 client id in `userData` (step values win). New export `collectBrowserTrackingIds()`.
