import type {
  LegacyTrackingProviders,
  TrackEventProvider,
  TrackingConfig,
  TrackingPixel,
  TrackingPixelInput,
  TrackingProviderType,
} from '@kubuild/schema';

/**
 * A tracking config with every pixel source merged into `pixels`: legacy `providers`
 * converted, host-inherited pixels applied (minus the document's exclusions), disabled and
 * duplicate pixels dropped. This is what the renderer, the `track_event` runner and the
 * server dispatcher act on.
 */
export type ResolvedTrackingConfig = Omit<TrackingConfig, 'providers'> & {
  pixels: TrackingPixel[];
};

const LEGACY_ID_PREFIX = 'legacy-';

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Fills schema defaults on a host- or document-supplied pixel without re-validating it. */
export function normalizeTrackingPixel(pixel: TrackingPixelInput): TrackingPixel {
  return {
    id: pixel.id,
    provider: pixel.provider,
    ...(pixel.label !== undefined ? { label: pixel.label } : {}),
    enabled: pixel.enabled ?? true,
    ...(pixel.credentialId ? { credentialId: pixel.credentialId } : {}),
    pixelId: str(pixel.pixelId),
    serverEnabled: pixel.serverEnabled ?? false,
    testEventCode: str(pixel.testEventCode),
    disabledEvents: pixel.disabledEvents ?? [],
  };
}

/**
 * Converts the `<= 1.2.0` one-config-per-provider map into pixel entries
 * (`id: "legacy-<provider>"`). Providers with neither a public id nor a credential are dropped —
 * the old modal saved an object for every tab, filled in or not.
 */
export function legacyProvidersToPixels(
  providers: LegacyTrackingProviders | undefined,
): TrackingPixel[] {
  if (!providers || typeof providers !== 'object') return [];
  const pixels: TrackingPixel[] = [];
  const push = (
    provider: TrackingProviderType,
    cfg: Record<string, unknown>,
    pixelId: string,
    serverEnabled: boolean,
  ) => {
    const credentialId = str(cfg.credentialId);
    if (!pixelId && !credentialId) return;
    pixels.push(
      normalizeTrackingPixel({
        id: `${LEGACY_ID_PREFIX}${provider}`,
        provider,
        enabled: cfg.enabled !== false,
        ...(credentialId ? { credentialId } : {}),
        pixelId,
        serverEnabled,
        testEventCode: str(cfg.testEventCode),
      }),
    );
  };

  const { meta, google, gtm, tiktok, custom } = providers;
  if (meta) push('meta', meta, str(meta.pixelId), Boolean(meta.capiEnabled));
  // 1.2.0 sent GA4 Measurement Protocol whenever a measurement id and a secret existed.
  if (google) push('google', google, str(google.measurementId), true);
  if (gtm) push('gtm', gtm, str(gtm.containerId), false);
  if (tiktok) push('tiktok', tiktok, str(tiktok.pixelId), Boolean(tiktok.eventsApiEnabled));
  // A custom webhook was server-only.
  if (custom) push('custom', custom, '', true);
  return pixels;
}

/**
 * The single merge rule for a document's tracking config and the pixels its host applies:
 *
 * 1. legacy `providers` → pixels;
 * 2. host `inheritedPixels` (when `inherit.enabled`), minus `inherit.excludedPixelIds`;
 * 3. the document's own `pixels`;
 * 4. disabled pixels dropped; duplicates (same provider + public id, or same entry id) keep the
 *    first occurrence, so an inherited pixel wins over the page's copy of it.
 *
 * Accepts unparsed input (missing defaults) so hosts can call it on raw stored JSON.
 */
export function resolveTrackingConfig(
  tracking: Partial<TrackingConfig> | null | undefined,
  inheritedPixels: readonly TrackingPixelInput[] = [],
): ResolvedTrackingConfig {
  const inherit = {
    enabled: tracking?.inherit?.enabled ?? true,
    excludedPixelIds: tracking?.inherit?.excludedPixelIds ?? [],
  };
  const excluded = new Set(inherit.excludedPixelIds);

  const candidates: TrackingPixel[] = [
    ...(inherit.enabled
      ? inheritedPixels.filter((p) => !excluded.has(p.id)).map(normalizeTrackingPixel)
      : []),
    ...legacyProvidersToPixels(tracking?.providers),
    ...(tracking?.pixels ?? []).map(normalizeTrackingPixel),
  ];

  const seenIds = new Set<string>();
  const seenPublic = new Set<string>();
  const pixels: TrackingPixel[] = [];
  for (const pixel of candidates) {
    if (!pixel.enabled || seenIds.has(pixel.id)) continue;
    const publicKey = pixel.pixelId ? `${pixel.provider}:${pixel.pixelId.toUpperCase()}` : '';
    if (publicKey && seenPublic.has(publicKey)) continue;
    seenIds.add(pixel.id);
    if (publicKey) seenPublic.add(publicKey);
    pixels.push(pixel);
  }

  return {
    enabled: tracking?.enabled ?? true,
    debugMode: tracking?.debugMode ?? false,
    autoPageView: tracking?.autoPageView ?? true,
    defaultDelivery: tracking?.defaultDelivery ?? 'both',
    inherit,
    pixels,
  };
}

export interface TrackingPixelFilter {
  /** 'all' (default) or one provider. */
  provider?: TrackEventProvider | (string & {});
  /** Only these entry ids; empty / omitted = no restriction. */
  pixelIds?: readonly string[];
  /** Drops pixels that list this event in `disabledEvents`. */
  eventName?: string;
}

/** Pixels of a resolved config an event should go to. */
export function selectTrackingPixels(
  config: Pick<ResolvedTrackingConfig, 'pixels'>,
  filter: TrackingPixelFilter = {},
): TrackingPixel[] {
  const provider = filter.provider ?? 'all';
  const ids = filter.pixelIds && filter.pixelIds.length > 0 ? new Set(filter.pixelIds) : null;
  return config.pixels.filter(
    (pixel) =>
      pixel.enabled &&
      (provider === 'all' || pixel.provider === provider) &&
      (!ids || ids.has(pixel.id)) &&
      !(filter.eventName && pixel.disabledEvents.includes(filter.eventName)),
  );
}

/**
 * In-place 1.2.0 -> 1.3.0 conversion of one tracking object: `providers` becomes `pixels`.
 * Returns the dotted paths converted.
 */
export function convertTrackingProvidersInPlace(
  tracking: unknown,
  basePath = 'tracking',
): string[] {
  if (!tracking || typeof tracking !== 'object' || Array.isArray(tracking)) return [];
  const record = tracking as Record<string, unknown>;
  if (record.providers === undefined) return [];

  const converted = legacyProvidersToPixels(record.providers as LegacyTrackingProviders);
  const existing = Array.isArray(record.pixels) ? (record.pixels as unknown[]) : [];
  record.pixels = [...existing, ...converted];
  delete record.providers;
  return [`${basePath}.providers`];
}

/**
 * Applies {@link convertTrackingProvidersInPlace} to every tracking location of a page or
 * project document: `tracking`, `metadata.tracking`, `artboards[i].document.*`.
 */
export function convertDocumentTrackingProvidersInPlace(doc: unknown): string[] {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [];
  const record = doc as Record<string, unknown>;
  const changed = convertTrackingProvidersInPlace(record.tracking, 'tracking');

  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    changed.push(
      ...convertTrackingProvidersInPlace(
        (metadata as Record<string, unknown>).tracking,
        'metadata.tracking',
      ),
    );
  }

  if (Array.isArray(record.artboards)) {
    record.artboards.forEach((artboard, index) => {
      if (artboard && typeof artboard === 'object') {
        for (const path of convertDocumentTrackingProvidersInPlace(
          (artboard as Record<string, unknown>).document,
        )) {
          changed.push(`artboards.${index}.document.${path}`);
        }
      }
    });
  }
  return changed;
}
