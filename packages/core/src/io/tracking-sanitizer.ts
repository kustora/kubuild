import { LEGACY_TRACKING_SECRET_KEYS, type TrackingProviderType } from '@kubuild/schema';

/**
 * Removes host-owned secret / destination fields (e.g. Meta `capiAccessToken`, TikTok
 * `accessToken`, GA4 `measurementProtocolSecret`, `serverRelayUrl`, custom `endpointUrl` /
 * `headers`) from a tracking config object IN PLACE.
 *
 * Returns the dotted paths (relative to the tracking object) of every field removed.
 * Safe on untrusted input: non-object values are ignored.
 */
export function stripTrackingSecretsInPlace(tracking: unknown, basePath = 'tracking'): string[] {
  const removed: string[] = [];
  if (!tracking || typeof tracking !== 'object' || Array.isArray(tracking)) return removed;

  const providers = (tracking as Record<string, unknown>).providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) return removed;

  for (const provider of Object.keys(LEGACY_TRACKING_SECRET_KEYS) as TrackingProviderType[]) {
    const cfg = (providers as Record<string, unknown>)[provider];
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) continue;
    for (const key of LEGACY_TRACKING_SECRET_KEYS[provider]) {
      if (Object.prototype.hasOwnProperty.call(cfg, key)) {
        delete (cfg as Record<string, unknown>)[key];
        removed.push(`${basePath}.providers.${provider}.${key}`);
      }
    }
  }
  return removed;
}

/**
 * Strips tracking secrets from every place a document (page or project) can carry a
 * tracking config: `tracking`, `metadata.tracking`, and each `artboards[i].document.tracking`.
 * Mutates `doc` in place; pass a clone if the original must be preserved.
 */
export function stripDocumentTrackingSecretsInPlace(doc: unknown): string[] {
  const removed: string[] = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return removed;
  const record = doc as Record<string, unknown>;

  removed.push(...stripTrackingSecretsInPlace(record.tracking, 'tracking'));

  const metadata = record.metadata;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    removed.push(
      ...stripTrackingSecretsInPlace((metadata as Record<string, unknown>).tracking, 'metadata.tracking'),
    );
  }

  if (Array.isArray(record.artboards)) {
    record.artboards.forEach((artboard, index) => {
      if (artboard && typeof artboard === 'object') {
        const inner = (artboard as Record<string, unknown>).document;
        for (const path of stripDocumentTrackingSecretsInPlace(inner)) {
          removed.push(`artboards.${index}.document.${path}`);
        }
      }
    });
  }

  return removed;
}

/**
 * Non-mutating variant: returns a sanitized deep copy plus the removed field paths.
 */
export function sanitizeDocumentTracking<T>(doc: T): { document: T; removed: string[] } {
  if (!doc || typeof doc !== 'object') return { document: doc, removed: [] };
  const copy = JSON.parse(JSON.stringify(doc)) as T;
  const removed = stripDocumentTrackingSecretsInPlace(copy);
  return { document: copy, removed };
}
