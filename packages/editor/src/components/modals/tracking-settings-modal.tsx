import React, { useState, useEffect } from 'react';
import type {
  PageDocument,
  TrackingConfig,
  TrackingDelivery,
  TrackingPixel,
  TrackingPixelInput,
  TrackingProviderType,
  PixelCredentialOption,
  ServerTrackingProviderType,
  TrackingProviderSecrets,
} from '@kubuild/schema';
import { normalizeTrackingPixel } from '@kubuild/core';
import { useEditorStore } from '../../store/index.js';
import { Activity, X, Check, AlertTriangle, Server, Plus, Trash2, KeyRound, Lock, Link2 } from 'lucide-react';
import {
  SERVER_CAPABLE_PROVIDERS,
  TEST_CODE_PROVIDERS,
  availableCredentials,
  buildTrackingConfig,
  credentialPublicId,
  initialPagePixels,
  newManualPixel,
  parseEventList,
  pixelFromCredential,
} from './tracking-pixel-list.js';

/**
 * Input handed to the host when the user enters a tracking secret in the editor.
 * The secret goes straight to the host — it is never written to the document.
 */
export interface SaveTrackingSecretInput {
  provider: ServerTrackingProviderType;
  secrets: TrackingProviderSecrets;
  /** Optional human-readable label for the stored credential. */
  name?: string;
}

/**
 * Host callback that stores a tracking secret server-side and returns the opaque
 * `credentialId` the document should reference.
 */
export type SaveTrackingSecretHandler = (input: SaveTrackingSecretInput) => Promise<{ credentialId: string }>;

export interface TrackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: PageDocument;
  /** Saved credentials (metadata only — never secrets) the author can add as page pixels. */
  credentials?: PixelCredentialOption[];
  /**
   * Pixels the host already applies to this document (public data only). Listed read-only
   * with a per-page on/off switch (`tracking.inherit`).
   */
  inheritedPixels?: readonly TrackingPixelInput[];
  /** Name of the host shown in the inherited-pixels section, e.g. "this funnel". */
  inheritedPixelsSource?: string;
  /** Opens the host's pixel library. */
  onManageCredentials?: () => void;
  /**
   * Stores a secret on the host and returns its `credentialId`. When omitted, secret
   * inputs are disabled (client-side pixels remain fully configurable).
   */
  onSaveTrackingSecret?: SaveTrackingSecretHandler;
  /** Host relay endpoint shown read-only for information. Host config, not document data. */
  trackingRelayUrl?: string;
}

interface SecretFieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

interface SecretVaultProps {
  provider: ServerTrackingProviderType;
  title: string;
  fields: SecretFieldSpec[];
  /** Custom webhook only: allow editing header key/value pairs. */
  allowHeaders?: boolean;
  credentialId: string;
  credential?: PixelCredentialOption;
  onSaveTrackingSecret?: SaveTrackingSecretHandler;
  onLinked: (credentialId: string) => void;
  disabled?: boolean;
}

/**
 * Write-only secret entry. Values live in local component state only and are sent to the
 * host via `onSaveTrackingSecret`; the returned `credentialId` is what the document stores.
 */
const SecretVault: React.FC<SecretVaultProps> = ({
  provider,
  title,
  fields,
  allowHeaders,
  credentialId,
  credential,
  onSaveTrackingSecret,
  onLinked,
  disabled,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [headers, setHeaders] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({
    kind: 'idle',
  });

  const canSave = Boolean(onSaveTrackingSecret) && !disabled;
  const hasInput = fields.every((f) => (values[f.key] || '').trim().length > 0);

  const buildSecrets = (): TrackingProviderSecrets => {
    const v = (k: string) => (values[k] || '').trim();
    switch (provider) {
      case 'meta':
        return { capiAccessToken: v('capiAccessToken') };
      case 'google':
        return { measurementProtocolSecret: v('measurementProtocolSecret') };
      case 'tiktok':
        return { accessToken: v('accessToken') };
      case 'custom': {
        const hdrs: Record<string, string> = {};
        for (const h of headers) if (h.key.trim()) hdrs[h.key.trim()] = h.value;
        return { endpointUrl: v('endpointUrl'), ...(Object.keys(hdrs).length ? { headers: hdrs } : {}) };
      }
    }
  };

  const handleSave = async () => {
    if (!onSaveTrackingSecret || !hasInput) return;
    setStatus({ kind: 'saving' });
    try {
      const res = await onSaveTrackingSecret({
        provider,
        secrets: buildSecrets(),
        name: credential?.name,
      });
      setValues({});
      setHeaders([]);
      onLinked(res.credentialId);
      setStatus({ kind: 'saved', message: 'Secret saved to host. Credential linked.' });
    } catch (err: unknown) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200" data-testid={`tracking-secret-${provider}`}>
      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
        <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{title}</span>
      </div>

      {credentialId ? (
        <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
          Linked to host credential{' '}
          <code className="font-mono">{credential?.name || credentialId}</code>
          {credential?.hasSecret ? ' — secret stored on host' : ''}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">No credential linked yet.</p>
      )}

      {!onSaveTrackingSecret && (
        <p
          className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1"
          data-testid={`tracking-secret-disabled-${provider}`}
        >
          <Lock className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Secrets are never stored in the page. This editor host has not enabled secure secret storage, so
            server-side credentials must be linked from the host (select a saved credential above). Browser
            pixels still work without it.
          </span>
        </p>
      )}

      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-slate-600 font-medium mb-1">{f.label}</label>
          <input
            type={f.secret === false ? 'text' : 'password'}
            autoComplete="off"
            value={values[f.key] || ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={credentialId ? 'Enter a new value to replace the stored secret' : f.placeholder}
            disabled={!canSave}
            className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono text-xs disabled:bg-slate-100 disabled:text-slate-400"
          />
        </div>
      ))}

      {allowHeaders && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-slate-600 font-medium">Custom HTTP Headers (secret)</label>
            <button
              type="button"
              onClick={() => setHeaders((prev) => [...prev, { id: `hdr-${Date.now()}`, key: '', value: '' }])}
              disabled={!canSave}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 disabled:text-slate-400"
            >
              <Plus className="w-3 h-3" /> Add Header
            </button>
          </div>
          {headers.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
              No custom headers
            </div>
          ) : (
            <div className="space-y-2">
              {headers.map((hdr) => (
                <div key={hdr.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hdr.key}
                    onChange={(e) =>
                      setHeaders((prev) => prev.map((h) => (h.id === hdr.id ? { ...h, key: e.target.value } : h)))
                    }
                    placeholder="Header Name"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="password"
                    autoComplete="off"
                    value={hdr.value}
                    onChange={(e) =>
                      setHeaders((prev) => prev.map((h) => (h.id === hdr.id ? { ...h, value: e.target.value } : h)))
                    }
                    placeholder="Header Value"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setHeaders((prev) => prev.filter((h) => h.id !== hdr.id))}
                    className="p-1 text-slate-400 hover:text-red-600"
                    aria-label="Remove header"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onSaveTrackingSecret && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || !hasInput || status.kind === 'saving'}
            data-testid={`tracking-secret-save-${provider}`}
            className="px-3 py-1 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 rounded transition"
          >
            {status.kind === 'saving' ? 'Saving…' : credentialId ? 'Replace secret on host' : 'Save secret to host'}
          </button>
          {status.message && (
            <span className={`text-[11px] ${status.kind === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
              {status.message}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

type ActiveTab = TrackingProviderType;

const PROVIDER_TABS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'meta', label: 'Meta (Facebook)' },
  { id: 'google', label: 'Google Analytics 4' },
  { id: 'gtm', label: 'GTM' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'custom', label: 'Custom Webhook' },
];

const PUBLIC_ID_LABEL: Record<ActiveTab, { label: string; placeholder: string }> = {
  meta: { label: 'Meta Pixel ID', placeholder: 'e.g. 123456789012345' },
  google: { label: 'Measurement ID', placeholder: 'e.g. G-XXXXXXXXXX' },
  gtm: { label: 'GTM Container ID', placeholder: 'e.g. GTM-XXXXXXX' },
  tiktok: { label: 'TikTok Pixel ID', placeholder: 'e.g. C1234567890' },
  custom: { label: '', placeholder: '' },
};

const SERVER_LABEL: Record<ActiveTab, { title: string; hint: string }> = {
  meta: { title: 'Meta Conversions API (CAPI)', hint: 'Server-side delivery through the host relay, bypassing ad-blockers and iOS restrictions' },
  google: { title: 'GA4 Measurement Protocol', hint: 'Server-side delivery through the host relay' },
  gtm: { title: '', hint: '' },
  tiktok: { title: 'TikTok Events API', hint: 'Server-to-server tracking through the host relay' },
  custom: { title: 'Webhook delivery', hint: 'Events are posted to the host-stored webhook destination' },
};

const SECRET_FIELDS: Record<ServerTrackingProviderType, { title: string; fields: SecretFieldSpec[]; allowHeaders?: boolean }> = {
  meta: {
    title: 'CAPI Access Token (stored on host)',
    fields: [{ key: 'capiAccessToken', label: 'System User Access Token', placeholder: 'EAAB...' }],
  },
  google: {
    title: 'Measurement Protocol API Secret (stored on host)',
    fields: [{ key: 'measurementProtocolSecret', label: 'API Secret', placeholder: 'API Secret from GA4 Admin' }],
  },
  tiktok: {
    title: 'Events API Access Token (stored on host)',
    fields: [{ key: 'accessToken', label: 'Access Token', placeholder: 'Access Token...' }],
  },
  custom: {
    title: 'Webhook destination & headers (stored on host)',
    fields: [{ key: 'endpointUrl', label: 'Webhook Endpoint URL', placeholder: 'https://myapi.com/webhooks/tracking', secret: false }],
    allowHeaders: true,
  },
};

const INPUT_CLASS =
  'w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none disabled:text-slate-400';

interface PixelRowProps {
  pixel: TrackingPixel;
  credential?: PixelCredentialOption;
  disabled: boolean;
  onChange: (patch: Partial<TrackingPixel>) => void;
  onRemove: () => void;
  onSaveTrackingSecret?: SaveTrackingSecretHandler;
}

/** One page pixel: public id, server delivery, test code, skipped events. */
const PixelRow: React.FC<PixelRowProps> = ({ pixel, credential, disabled, onChange, onRemove, onSaveTrackingSecret }) => {
  const provider = pixel.provider;
  const linked = Boolean(credential);
  const rowDisabled = disabled || !pixel.enabled;
  const idSpec = PUBLIC_ID_LABEL[provider];
  const serverSpec = SERVER_LABEL[provider];
  const canServer = SERVER_CAPABLE_PROVIDERS.includes(provider);
  // A linked credential that already holds its secret needs no vault; anything else may.
  const showVault = canServer && pixel.serverEnabled && !credential?.hasSecret;
  const [eventsText, setEventsText] = useState(pixel.disabledEvents.join(', '));

  return (
    <div className="p-3 rounded-lg border border-slate-200 space-y-3 text-xs" data-testid={`tracking-pixel-${pixel.id}`}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={pixel.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          disabled={disabled}
          aria-label="Enable pixel"
          className="rounded border-slate-300 text-emerald-600"
        />
        <input
          type="text"
          value={pixel.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={credential?.name || 'Label (optional)'}
          disabled={disabled}
          className="flex-1 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-none font-semibold text-slate-800 px-1 py-0.5"
        />
        {linked && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Link2 className="w-3 h-3" aria-hidden="true" />
            Saved pixel
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove pixel"
          className="p-1 text-slate-400 hover:text-red-600 disabled:text-slate-300"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {provider !== 'custom' && (
          <div>
            <label className="block text-slate-600 font-medium mb-1">{idSpec.label}</label>
            <input
              type="text"
              value={pixel.pixelId}
              onChange={(e) => onChange({ pixelId: e.target.value })}
              placeholder={idSpec.placeholder}
              readOnly={linked}
              disabled={rowDisabled}
              className={`${INPUT_CLASS} ${linked ? 'bg-slate-100 text-slate-500' : ''}`}
            />
          </div>
        )}
        {TEST_CODE_PROVIDERS.includes(provider) && (
          <div>
            <label className="block text-slate-600 font-medium mb-1">Test Event Code (Optional)</label>
            <input
              type="text"
              value={pixel.testEventCode}
              onChange={(e) => onChange({ testEventCode: e.target.value })}
              placeholder="e.g. TEST12345"
              disabled={rowDisabled}
              className={INPUT_CLASS}
            />
          </div>
        )}
        <div className={provider === 'custom' || provider === 'gtm' ? 'sm:col-span-1' : 'sm:col-span-2'}>
          <label className="block text-slate-600 font-medium mb-1">Skip these events (optional)</label>
          <input
            type="text"
            value={eventsText}
            onChange={(e) => {
              setEventsText(e.target.value);
              onChange({ disabledEvents: parseEventList(e.target.value) });
            }}
            placeholder="e.g. Purchase, Lead"
            disabled={rowDisabled}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {provider === 'gtm' && (
        <span className="text-[10px] text-slate-500 block">
          GTM is client-side only: track_event steps push to <code>dataLayer</code>.
        </span>
      )}

      {canServer && (
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">{serverSpec.title}</span>
              <span className="text-[11px] text-slate-500">{serverSpec.hint}</span>
            </div>
            <input
              type="checkbox"
              checked={pixel.serverEnabled}
              onChange={(e) => onChange({ serverEnabled: e.target.checked })}
              disabled={rowDisabled}
              aria-label={serverSpec.title}
              className="rounded border-slate-300 text-emerald-600"
            />
          </div>
          {pixel.serverEnabled && credential?.hasSecret && (
            <p className="text-[11px] text-emerald-700">Secret stored on host — resolved by credential ID.</p>
          )}
          {showVault && (
            <SecretVault
              provider={provider as ServerTrackingProviderType}
              title={SECRET_FIELDS[provider as ServerTrackingProviderType].title}
              fields={SECRET_FIELDS[provider as ServerTrackingProviderType].fields}
              allowHeaders={SECRET_FIELDS[provider as ServerTrackingProviderType].allowHeaders}
              credentialId={pixel.credentialId || ''}
              credential={credential}
              onSaveTrackingSecret={onSaveTrackingSecret}
              onLinked={(credentialId) => onChange({ credentialId })}
              disabled={rowDisabled}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const TrackingSettingsModal: React.FC<TrackingSettingsModalProps> = ({
  isOpen,
  onClose,
  document: propDoc,
  credentials,
  inheritedPixels,
  inheritedPixelsSource,
  onManageCredentials,
  onSaveTrackingSecret,
  trackingRelayUrl,
}) => {
  const storeDoc = useEditorStore((state) => state.document);
  const updateDocumentTracking = useEditorStore((state) => state.updateDocumentTracking);
  const doc = propDoc || storeDoc;

  const currentTracking: Partial<TrackingConfig> | undefined =
    doc.tracking || (doc.metadata as { tracking?: TrackingConfig })?.tracking;

  const [activeTab, setActiveTab] = useState<ActiveTab>('meta');
  const [enabled, setEnabled] = useState<boolean>(currentTracking?.enabled ?? true);
  const [autoPageView, setAutoPageView] = useState<boolean>(currentTracking?.autoPageView ?? true);
  const [debugMode, setDebugMode] = useState<boolean>(currentTracking?.debugMode ?? false);
  const [defaultDelivery, setDefaultDelivery] = useState<TrackingDelivery>(currentTracking?.defaultDelivery || 'both');
  const [pixels, setPixels] = useState<TrackingPixel[]>(() => initialPagePixels(currentTracking));
  const [inheritEnabled, setInheritEnabled] = useState<boolean>(currentTracking?.inherit?.enabled ?? true);
  const [excludedPixelIds, setExcludedPixelIds] = useState<string[]>(currentTracking?.inherit?.excludedPixelIds ?? []);
  const [credentialToAdd, setCredentialToAdd] = useState('');

  // Re-sync when modal opens
  useEffect(() => {
    if (isOpen) {
      const tr = doc.tracking || (doc.metadata as { tracking?: TrackingConfig })?.tracking;
      setEnabled(tr?.enabled ?? true);
      setAutoPageView(tr?.autoPageView ?? true);
      setDebugMode(tr?.debugMode ?? false);
      setDefaultDelivery(tr?.defaultDelivery || 'both');
      setPixels(initialPagePixels(tr));
      setInheritEnabled(tr?.inherit?.enabled ?? true);
      setExcludedPixelIds(tr?.inherit?.excludedPixelIds ?? []);
    }
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const hostPixels = (inheritedPixels ?? []).map(normalizeTrackingPixel);

  const handleSave = () => {
    updateDocumentTracking(
      buildTrackingConfig({ enabled, autoPageView, debugMode, defaultDelivery, pixels, inheritEnabled, excludedPixelIds }),
    );
    onClose();
  };

  const findCredential = (id?: string) => (id ? credentials?.find((c) => c.id === id) : undefined);
  const updatePixel = (id: string, patch: Partial<TrackingPixel>) =>
    setPixels((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const removePixel = (id: string) => setPixels((prev) => prev.filter((p) => p.id !== id));
  const toggleInherited = (id: string, use: boolean) =>
    setExcludedPixelIds((prev) => (use ? prev.filter((x) => x !== id) : [...new Set([...prev, id])]));

  const tabPixels = pixels.filter((p) => p.provider === activeTab);
  const addable = availableCredentials(credentials, activeTab, pixels, hostPixels);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="tracking-modal-title" className="text-sm font-bold text-slate-900">
                Pixel & CAPI Tracking Settings
              </h2>
              <p className="text-xs text-slate-500">
                Configure browser pixels, server Conversions API, and event tracking policies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Master Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Enable Tracking Feature</span>
                {enabled ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                    Disabled
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Master switch to toggle all client-side pixel scripts and server-side tracking on or off dynamically.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
                data-testid="tracking-master-toggle"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {!enabled && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                Tracking is disabled. No pixel scripts will be loaded on the page, and no action steps will send tracking events.
              </span>
            </div>
          )}

          {/* General Tracking Policies */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">General Policies</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/60 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={autoPageView}
                  onChange={(e) => setAutoPageView(e.target.checked)}
                  disabled={!enabled}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Auto Track PageView</span>
                  <span className="text-slate-500 text-[11px]">
                    Fires one PageView per pixel on document load
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:bg-slate-50/60 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  disabled={!enabled}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-0"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Debug / Test Mode</span>
                  <span className="text-slate-500 text-[11px]">
                    Logs event payloads to the browser console for verification
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Event Delivery Channel
              </label>
              <select
                value={defaultDelivery}
                onChange={(e) => setDefaultDelivery(e.target.value as TrackingDelivery)}
                disabled={!enabled}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="both">Both (Browser Pixel + Server CAPI with Deduplication)</option>
                <option value="client_only">Browser Pixel Only (Client-side)</option>
                <option value="server_only">Server CAPI Only (Server-side)</option>
              </select>
            </div>

            {/* Host relay info — read-only, never stored in the document */}
            <div
              className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 text-[11px] text-slate-600"
              data-testid="tracking-relay-info"
            >
              <Server className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
              {trackingRelayUrl ? (
                <span>
                  Server-side events are delivered through the host relay{' '}
                  <code className="font-mono text-slate-800">{trackingRelayUrl}</code>. The relay is configured by
                  the host and resolves secrets by credential ID — nothing secret is stored in this page.
                </span>
              ) : (
                <span>
                  No server relay is configured by the host. Server-side events (CAPI, Events API, Measurement
                  Protocol, webhooks) will be skipped; browser pixels still fire.
                </span>
              )}
            </div>
          </div>

          {/* Pixels the host applies to this document */}
          {hostPixels.length > 0 && (
            <div className="space-y-3" data-testid="tracking-inherited-pixels">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {`Pixels from ${inheritedPixelsSource || 'the host'}`}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Applied automatically. Switch one off to skip it on this page only.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inheritEnabled}
                    onChange={(e) => setInheritEnabled(e.target.checked)}
                    disabled={!enabled}
                    data-testid="tracking-inherit-toggle"
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  Use these pixels
                </label>
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-xs">
                {hostPixels.map((p) => {
                  const used = !excludedPixelIds.includes(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2" data-testid={`tracking-inherited-${p.id}`}>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                        {PROVIDER_TABS.find((t) => t.id === p.provider)?.label ?? p.provider}
                      </span>
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-semibold text-slate-800">{p.label || p.pixelId}</span>
                        {p.label && p.pixelId ? <span className="text-slate-500 font-mono"> · {p.pixelId}</span> : null}
                      </span>
                      {p.serverEnabled && <span className="text-[10px] text-emerald-700 shrink-0">server-side</span>}
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={used}
                          onChange={(e) => toggleInherited(p.id, e.target.checked)}
                          disabled={!enabled || !inheritEnabled}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        On this page
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Page pixels per provider */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {hostPixels.length > 0 ? 'Extra pixels for this page' : 'Tracking Pixels'}
              </h3>
              {onManageCredentials && (
                <button
                  type="button"
                  onClick={onManageCredentials}
                  className="text-[11px] text-emerald-600 hover:text-emerald-800 underline font-medium transition"
                >
                  Manage saved pixels
                </button>
              )}
            </div>

            <div className="flex border-b border-slate-200 gap-2">
              {PROVIDER_TABS.map((tab) => {
                const count = pixels.filter((p) => p.provider === tab.id).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setCredentialToAdd('');
                    }}
                    className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                      activeTab === tab.id
                        ? 'border-emerald-600 text-emerald-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-emerald-600 text-white rounded-full">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 pt-1" data-testid={`tracking-tab-${activeTab}`}>
              {tabPixels.length === 0 ? (
                <div className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                  {`No ${PROVIDER_TABS.find((t) => t.id === activeTab)?.label} pixel on this page yet.`}
                </div>
              ) : (
                tabPixels.map((pixel) => (
                  <PixelRow
                    key={pixel.id}
                    pixel={pixel}
                    credential={findCredential(pixel.credentialId)}
                    disabled={!enabled}
                    onChange={(patch) => updatePixel(pixel.id, patch)}
                    onRemove={() => removePixel(pixel.id)}
                    onSaveTrackingSecret={onSaveTrackingSecret}
                  />
                ))
              )}

              <div className="flex flex-col sm:flex-row gap-2 text-xs">
                {addable.length > 0 && (
                  <div className="flex flex-1 gap-2">
                    <select
                      value={credentialToAdd}
                      onChange={(e) => setCredentialToAdd(e.target.value)}
                      disabled={!enabled}
                      aria-label="Saved pixel to add"
                      data-testid="tracking-add-saved-select"
                      className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="">Choose a saved pixel…</option>
                      {addable.map((c) => {
                        const publicId = credentialPublicId(c);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {publicId ? ` (${publicId})` : ''}
                            {c.hasSecret ? ' • server-side ready' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      disabled={!enabled || !credentialToAdd}
                      onClick={() => {
                        const credential = addable.find((c) => c.id === credentialToAdd);
                        if (credential) setPixels((prev) => [...prev, pixelFromCredential(credential)]);
                        setCredentialToAdd('');
                      }}
                      className="px-3 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 rounded-lg transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => setPixels((prev) => [...prev, newManualPixel(activeTab)])}
                  data-testid="tracking-add-manual"
                  className="px-3 py-1.5 font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 disabled:text-slate-400 disabled:border-slate-200 rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add manually
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
