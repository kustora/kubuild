# PRD — KUBUILD: Multi-Pixel Tracking & Host-Inherited Pixels

**Product:** KUBUILD
**Codename:** BUILDER-01
**Document Type:** PRD Extension
**Feature Focus:** Multiple pixels per provider, host-provided (inherited) pixels with per-page opt-out, pixel picker in the Tracking Settings modal, per-pixel event filtering
**Target Packages:** `@kubuild/schema`, `@kubuild/core`, `@kubuild/renderer`, `@kubuild/editor`, `@kubuild/react`
**Target Version:** 0.11.0 (document schema `1.3.0`)
**Status:** Implemented on `feature/tracking-multi-pixel` (unreleased)

---

## 1. Problem

The tracking model shipped in 0.10 (`document.tracking.providers.{meta,google,gtm,tiktok,custom}`) holds **one config object per provider**. In practice:

1. **One pixel per platform.** Sellers often run two Meta pixels (their own plus an agency's) or several GA4 properties. The document cannot express that, and the browser code assumes it too: `fbq('track')` broadcasts to every initialised pixel, the TikTok stub is re-run per load, and server results are keyed by provider.
2. **The host's pixels are not visible in the editor.** A host such as a funnel product keeps a pixel library and assigns pixels at a higher level (a funnel). Today the host can only pass `trackingCredentials` for a single-select dropdown per provider. It cannot say "these pixels already apply to this page", so authors re-enter them per page or the host silently overrides the document.
3. **No per-pixel event filter.** A host that lets users switch individual events off per pixel (e.g. "no Purchase from the browser for this pixel") has nowhere to put that.

## 2. Goals

- A document can hold **any number of pixels per provider**.
- A host can pass **inherited pixels** to the editor and the renderer. Authors see them in the modal and can switch each one off for the page. The page can add its own pixels on top.
- The editor lists the host's **saved pixels** (`trackingCredentials`) as a multi-select picker, and still supports **manual entry** of any number of pixels.
- Events can be targeted at specific pixels, and each pixel can disable specific events.
- Stays **backend-agnostic**: the host supplies plain data (`TrackingPixel[]`, `PixelCredentialOption[]`) and callbacks. No knowledge of funnels, tenants or any host model in KUBUILD.
- Old documents keep working through a `1.2.0 → 1.3.0` migration.

## 3. Non-goals

- Event-name mapping between platforms (e.g. `Purchase` → GA4 `purchase`). Authors and hosts name events per platform, as today.
- Consent management.
- Changing the secret model: secrets stay with the host and are resolved by `credentialId` (0.10 security model unchanged).

## 4. Data contract (`@kubuild/schema`)

### 4.1 `TrackingPixel`

```ts
TrackingPixelSchema = z.object({
  /** Stable entry id, unique within the config. Hosts may use their own credential id. */
  id: z.string().min(1).max(256),
  provider: TrackingProviderTypeSchema,            // meta | google | gtm | tiktok | custom
  label: z.string().max(200).optional(),
  enabled: z.boolean().default(true),
  /** Host credential handle; secrets are resolved server-side from it. */
  credentialId: z.string().max(256).optional(),
  /** Public id: Meta/TikTok pixel id, GA4 measurement id, GTM container id. Unused for custom. */
  pixelId: z.string().max(256).optional().default(''),
  /** Server-side delivery (Meta CAPI, TikTok Events API, GA4 MP, custom webhook) through the host relay. */
  serverEnabled: z.boolean().optional().default(false),
  /** Meta/TikTok test event code — not a secret. */
  testEventCode: z.string().max(100).optional().default(''),
  /** Event names this pixel never receives (exact match), e.g. ["Purchase"]. */
  disabledEvents: z.array(z.string().max(256)).optional().default([]),
});
```

### 4.2 `TrackingConfig` (1.3.0)

```ts
TrackingConfigSchema = z.object({
  enabled, debugMode, autoPageView, defaultDelivery,   // unchanged
  pixels: z.array(TrackingPixelSchema).default([]),
  inherit: z.object({
    /** Use the pixels the host passes at runtime. */
    enabled: z.boolean().default(true),
    /** Inherited pixel ids switched off for this document. */
    excludedPixelIds: z.array(z.string()).default([]),
  }).default({}),
  /** @deprecated 1.2.0 shape — parsed for compatibility, converted by migration and by resolveTrackingConfig. */
  providers: LegacyProvidersSchema.optional(),
});
```

`types.ts` hand-written interfaces and the hand-written `trackingConfig` JSON Schema definition are updated to match.

### 4.3 Event targeting

- `TrackEventStepPayloadSchema` gains `pixelIds?: string[]`. Empty or missing means every enabled pixel that matches `provider`.
- `TrackingRelayRequestSchema` gains `pixelIds?: string[]`. It is a hint only: it can narrow the trusted config, never add to it.
- Relay `results` are keyed `"<provider>:<pixelId entry id>"`.

### 4.4 Host-facing types

- `PixelCredentialOption` is unchanged (`id, name, provider, pixelId?, measurementId?, containerId?, hasSecret?, isActive?`).
- `RuntimeTrackingOptions` (renderer context) gains `inheritedPixels?: TrackingPixel[]`.

## 5. Resolution (`@kubuild/core`)

`resolveTrackingConfig(documentTracking, inheritedPixels?) → ResolvedTrackingConfig` is the **single merge rule**, used by the renderer, the track_event runner and the relay:

1. Normalise legacy `providers` into `pixels` (same rule as the migration).
2. If `inherit.enabled`, take `inheritedPixels` minus `excludedPixelIds`.
3. Append the document's own `pixels`.
4. Drop disabled pixels and duplicates by `provider + pixelId`; the first occurrence wins, so inherited pixels win over the page.

`dispatchServerTracking` iterates resolved pixels instead of providers. It resolves secrets per pixel `credentialId` with the existing `TrackingSecretResolver`, honours `disabledEvents` and `pixelIds`, and keys results per pixel.

`createTrackingRelayHandler`'s `getConfig` keeps returning a `TrackingConfig`. Hosts with inherited pixels return `resolveTrackingConfig(pageTracking, inheritedPixels)`.

## 6. Browser runtime (`@kubuild/renderer`)

- `injectTrackingScripts(config, { inheritedPixels })` bootstraps each library once, then:
  - Meta: `fbq('init', id)` per pixel.
  - TikTok: `ttq.load(id)` per pixel.
  - GA4: `gtag('config', id, { send_page_view: false })` per pixel.
  - GTM: one script per container.
- `autoPageView` fires one PageView per pixel unless `PageView` is in that pixel's `disabledEvents`:
  - Meta: `trackSingle`.
  - TikTok: `ttq.instance(id).page()`.
  - GA4: `page_view` with `send_to`.
  - GTM: left to the container.
- `fireBrowserPixel(eventName, params, { config, provider, pixelIds, eventId, eventType })` fires per targeted pixel:
  - Meta: `fbq('trackSingle' | 'trackSingleCustom', id, …, { eventID })`.
  - TikTok: `ttq.instance(id).track(…, { event_id })`.
  - GA4: `gtag('event', …, { send_to: id })`.
  - GTM: one `dataLayer.push` if any GTM pixel is targeted.
- `KubuildRenderer` resolves the config with `context.tracking.inheritedPixels`, and falls back to `metadata.tracking` (fixes the current gap).

## 7. Editor (`@kubuild/editor`)

### 7.1 New and changed props (`KubuildEditor`, toolbar, inspector)

| Prop | Type | Purpose |
|---|---|---|
| `trackingCredentials` | `PixelCredentialOption[]` | Host's saved pixels, offered in the picker (existing prop). |
| `context.tracking.inheritedPixels` | `TrackingPixelInput[]` | **New.** Pixels the host applies to this document — the same `RuntimeTrackingOptions` the renderer gets, so host config lives in one place. Shown with a per-page on/off switch. |
| `inheritedTrackingPixelsLabel` | `string` | **New.** Label for those pixels ("Pixels from <label>"). |
| `onManageCredentials` | `() => void` | Existing; link to the host's pixel library. |
| `onSaveTrackingSecret` | existing | Unchanged; used by manually added pixels. |

### 7.2 Tracking Settings modal

- **General policies:** unchanged.
- **Inherited pixels** (only when `inheritedTrackingPixels` is non-empty):
  - A master switch "Use pixels from <host>", which sets `inherit.enabled`.
  - One row per pixel (provider badge, label, public id) with a "Use on this page" switch, which writes `excludedPixelIds`.
- **Page pixels:** provider tabs kept. Each tab lists the document's pixels for that provider as rows:
  - "Add saved pixel": a multi-select from `trackingCredentials` of that provider, hiding ones already added or inherited. It creates `{ id, credentialId, pixelId, serverEnabled: hasSecret }`.
  - "Add manually": an empty row with a pixel id input and, when `onSaveTrackingSecret` is given, the existing secret vault.
  - Row fields:
    - label, enabled, pixel id (read-only when linked to a credential)
    - server-side toggle (disabled with an explanation when there is no secret and no `onSaveTrackingSecret`)
    - test event code (Meta/TikTok)
    - disabled events (chips)
    - remove
- Flat per-provider `useState`s are replaced with a `pixels` array in local state; save goes through `updateDocumentTracking` (still strips secrets).

### 7.3 Inspector and action builder

- The "active providers" counters (inspector-panel ~1374 and ~1397) count resolved pixels.
- `track_event` targeting by `pixelIds` is supported in the schema, runner and relay; the step form's "Only these pixels" picker is a follow-up (no UI yet).

## 8. Migration & compatibility

- `CURRENT_SCHEMA_VERSION` `1.2.0 → 1.3.0`. A new registry step converts `providers.<p>` into `pixels[]` entries (`id: "legacy-<provider>"`; `capiEnabled`/`eventsApiEnabled` → `serverEnabled`; GA4 `measurementId` and GTM `containerId` → `pixelId`). It covers `tracking`, `metadata.tracking` and project artboards, and reports a `TRACKING_PROVIDERS_CONVERTED` warning.
- The sanitizer handles both `pixels[]` and legacy `providers`.
- Consumers on 0.10 keep parsing 1.3.0 documents? **No** — a 0.10 renderer ignores `pixels`. Hosts upgrade editor and renderer together (same fixed changeset group).

## 9. Testing

- schema: `TrackingPixel` and config defaults, legacy parse, JSON Schema, `pixelIds` on step and relay request.
- core:
  - migration `1.2.0 → 1.3.0`, including artboards and metadata
  - `resolveTrackingConfig` (inherit on/off, exclusions, dedup order, legacy normalisation)
  - `dispatchServerTracking` with 2 Meta pixels and different credentials, `disabledEvents`, `pixelIds`, per-pixel result keys
  - the relay
- renderer: injection of 2 Meta + 2 TikTok + 2 GA4 pixels; `trackSingle` per pixel; `disabledEvents`; `pixelIds`; inherited pixels from context.
- editor:
  - modal: inherited rows toggle `excludedPixelIds`; saved-pixel picker adds several; manual add/remove; save writes `pixels`
  - inspector counters
- Version bumps in existing tests that hard-code `1.2.0`.
- Playground: demo inherited pixels and a credential list.

## 10. Rollout

1. Implement on branch `feature/tracking-multi-pixel`. All packages move to `0.11.0` with a changeset and CHANGELOG entries.
2. Hosts verify against local builds (`pnpm pack` tarballs or `link:`) before publish.
3. Publish through the existing release flow (owner's call).

## 11. Implementation notes

- The relay gained `isEventAllowed(event, ctx)` (403 `EVENT_NOT_ALLOWED`) so a host can refuse browser-sent events such as `Purchase` that it only trusts from its own backend.
- `fireBrowserPixel` without a config or inherited pixels keeps the pre-1.3.0 broadcast behaviour (events go to whatever libraries are loaded).
- Indonesian strings in the modal's old credential selector and the inspector's pixel counter were replaced with English, matching the rest of the editor chrome.
