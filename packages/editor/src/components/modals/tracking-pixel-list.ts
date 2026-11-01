import type {
  PixelCredentialOption,
  TrackingConfig,
  TrackingDelivery,
  TrackingPixel,
  TrackingPixelInput,
  TrackingProviderType,
} from '@kubuild/schema';
import { legacyProvidersToPixels, normalizeTrackingPixel } from '@kubuild/core';

// Pure state helpers behind the Tracking Settings modal — kept out of the component so the
// list rules (what a saved credential becomes, what is offered, what gets saved) are testable.

export const SERVER_CAPABLE_PROVIDERS: readonly TrackingProviderType[] = [
  'meta',
  'tiktok',
  'google',
  'custom',
];
export const TEST_CODE_PROVIDERS: readonly TrackingProviderType[] = ['meta', 'tiktok'];

/** The document's own pixels as the modal edits them (legacy `providers` converted). */
export function initialPagePixels(tracking: Partial<TrackingConfig> | undefined): TrackingPixel[] {
  if (!tracking) return [];
  return [
    ...(tracking.pixels ?? []).map(normalizeTrackingPixel),
    ...legacyProvidersToPixels(tracking.providers),
  ];
}

/** Public id a saved credential carries, whatever the provider calls it. */
export function credentialPublicId(credential: PixelCredentialOption): string {
  return credential.pixelId || credential.measurementId || credential.containerId || '';
}

/** A page pixel linked to a host credential. The credential id doubles as the entry id. */
export function pixelFromCredential(credential: PixelCredentialOption): TrackingPixel {
  const provider = credential.provider as TrackingProviderType;
  return normalizeTrackingPixel({
    id: credential.id,
    provider,
    label: credential.name,
    credentialId: credential.id,
    pixelId: credentialPublicId(credential),
    serverEnabled: Boolean(credential.hasSecret) && SERVER_CAPABLE_PROVIDERS.includes(provider),
  });
}

/** An empty, manually entered pixel. */
export function newManualPixel(
  provider: TrackingProviderType,
  id = `px_${Math.random().toString(36).slice(2, 10)}`,
): TrackingPixel {
  return normalizeTrackingPixel({ id, provider, serverEnabled: provider === 'custom' });
}

/**
 * Saved credentials of `provider` that can still be added: active, and not already on the page
 * or applied by the host (same credential or same public id).
 */
export function availableCredentials(
  credentials: readonly PixelCredentialOption[] | undefined,
  provider: TrackingProviderType,
  pagePixels: readonly TrackingPixel[],
  inheritedPixels: readonly TrackingPixelInput[] = [],
): PixelCredentialOption[] {
  const taken = [...pagePixels, ...inheritedPixels];
  const takenCredentials = new Set(taken.map((p) => p.credentialId).filter(Boolean));
  const takenPublic = new Set(taken.map((p) => `${p.provider}:${(p.pixelId ?? '').toUpperCase()}`));
  return (credentials ?? []).filter(
    (c) =>
      c.provider === provider &&
      c.isActive !== false &&
      !takenCredentials.has(c.id) &&
      !(
        credentialPublicId(c) &&
        takenPublic.has(`${provider}:${credentialPublicId(c).toUpperCase()}`)
      ),
  );
}

export interface TrackingFormState {
  enabled: boolean;
  autoPageView: boolean;
  debugMode: boolean;
  defaultDelivery: TrackingDelivery;
  pixels: TrackingPixel[];
  inheritEnabled: boolean;
  excludedPixelIds: string[];
}

/**
 * The config the modal saves: pixels trimmed, half-filled manual rows dropped (no public id,
 * except a custom webhook linked to a credential), no legacy `providers`.
 */
export function buildTrackingConfig(state: TrackingFormState): TrackingConfig {
  const pixels = state.pixels
    .map((p) => ({
      ...p,
      ...(p.label?.trim() ? { label: p.label.trim() } : { label: undefined }),
      pixelId: p.pixelId.trim(),
      testEventCode: TEST_CODE_PROVIDERS.includes(p.provider) ? p.testEventCode.trim() : '',
      serverEnabled: SERVER_CAPABLE_PROVIDERS.includes(p.provider) ? p.serverEnabled : false,
      disabledEvents: p.disabledEvents.map((e) => e.trim()).filter(Boolean),
    }))
    .filter((p) => (p.provider === 'custom' ? Boolean(p.credentialId) : Boolean(p.pixelId)))
    .map(({ label, ...rest }) => (label ? { ...rest, label } : rest));

  return {
    enabled: state.enabled,
    autoPageView: state.autoPageView,
    debugMode: state.debugMode,
    defaultDelivery: state.defaultDelivery,
    pixels,
    inherit: { enabled: state.inheritEnabled, excludedPixelIds: state.excludedPixelIds },
  };
}

/** "Purchase, Lead" ⇄ ["Purchase", "Lead"] for the disabled-events input. */
export function parseEventList(value: string): string[] {
  return value
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}
