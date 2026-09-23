import React, { useState, useEffect } from 'react';
import type {
  PageDocument,
  TrackingConfig,
  TrackingDelivery,
  PixelCredentialOption,
  ServerTrackingProviderType,
  TrackingProviderSecrets,
} from '@kubuild/schema';
import { useEditorStore } from '../../store';
import { Activity, X, Check, AlertTriangle, Server, Plus, Trash2, KeyRound, Lock } from 'lucide-react';

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
  /** Saved credentials (metadata only — never secrets) available for selection. */
  credentials?: PixelCredentialOption[];
  /** Called when user clicks "Kelola Kredensial" link */
  onManageCredentials?: () => void;
  /**
   * Stores a secret on the host and returns its `credentialId`. When omitted, secret
   * inputs are disabled (client-side pixels remain fully configurable).
   */
  onSaveTrackingSecret?: SaveTrackingSecretHandler;
  /** Host relay endpoint shown read-only for information. Host config, not document data. */
  trackingRelayUrl?: string;
}

type ActiveTab = 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom';

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

interface CredentialSelectorProps {
  credentials: PixelCredentialOption[];
  credentialId: string;
  onSelect: (id: string, cred: PixelCredentialOption | null) => void;
  onManageCredentials?: () => void;
}

/** Metadata-only picker: selecting a credential stores its id and fills public ids. */
const CredentialSelector: React.FC<CredentialSelectorProps> = ({
  credentials,
  credentialId,
  onSelect,
  onManageCredentials,
}) => {
  if (credentials.length === 0) return null;

  return (
    <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-semibold text-emerald-800 block">Pilih Kredensial Tersimpan</label>
        {onManageCredentials && (
          <button
            type="button"
            onClick={onManageCredentials}
            className="text-[11px] text-emerald-600 hover:text-emerald-800 underline font-medium transition"
          >
            Kelola Kredensial
          </button>
        )}
      </div>
      <select
        value={credentialId}
        onChange={(e) => {
          const selectedId = e.target.value;
          const found = credentials.find((c) => c.id === selectedId) ?? null;
          onSelect(selectedId, found);
        }}
        className="w-full text-xs bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
      >
        <option value="">Manual (tidak terhubung)</option>
        {credentials.map((c) => {
          const publicId = c.pixelId || c.measurementId || c.containerId;
          return (
            <option key={c.id} value={c.id}>
              {c.name}
              {publicId ? ` (${publicId})` : ''}
              {c.hasSecret ? ' • secret stored' : ''}
            </option>
          );
        })}
      </select>
      {credentialId && (
        <p className="text-[10px] text-emerald-700">
          Public IDs are filled from the credential. Server secrets stay on the host and are resolved by
          credential ID.
        </p>
      )}
    </div>
  );
};

export const TrackingSettingsModal: React.FC<TrackingSettingsModalProps> = ({
  isOpen,
  onClose,
  document: propDoc,
  credentials,
  onManageCredentials,
  onSaveTrackingSecret,
  trackingRelayUrl,
}) => {
  const storeDoc = useEditorStore((state) => state.document);
  const updateDocumentTracking = useEditorStore((state) => state.updateDocumentTracking);
  const doc = propDoc || storeDoc;

  const currentTracking: TrackingConfig = doc.tracking ||
    (doc.metadata as { tracking?: TrackingConfig })?.tracking || {
      enabled: true,
      autoPageView: true,
      debugMode: false,
      defaultDelivery: 'both',
      providers: {},
    };

  const [activeTab, setActiveTab] = useState<ActiveTab>('meta');
  const [enabled, setEnabled] = useState<boolean>(currentTracking.enabled ?? true);
  const [autoPageView, setAutoPageView] = useState<boolean>(currentTracking.autoPageView ?? true);
  const [debugMode, setDebugMode] = useState<boolean>(currentTracking.debugMode ?? false);
  const [defaultDelivery, setDefaultDelivery] = useState<TrackingDelivery>(
    currentTracking.defaultDelivery || 'both',
  );

  // Meta config
  const [metaCredentialId, setMetaCredentialId] = useState<string>(
    currentTracking.providers?.meta?.credentialId || '',
  );
  const [metaEnabled, setMetaEnabled] = useState<boolean>(currentTracking.providers?.meta?.enabled ?? true);
  const [metaPixelId, setMetaPixelId] = useState<string>(currentTracking.providers?.meta?.pixelId || '');
  const [metaCapiEnabled, setMetaCapiEnabled] = useState<boolean>(
    currentTracking.providers?.meta?.capiEnabled ?? false,
  );
  const [metaTestCode, setMetaTestCode] = useState<string>(currentTracking.providers?.meta?.testEventCode || '');

  // Google config
  const [googleCredentialId, setGoogleCredentialId] = useState<string>(
    currentTracking.providers?.google?.credentialId || '',
  );
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(currentTracking.providers?.google?.enabled ?? true);
  const [googleMeasurementId, setGoogleMeasurementId] = useState<string>(
    currentTracking.providers?.google?.measurementId || '',
  );

  // GTM config
  const [gtmCredentialId, setGtmCredentialId] = useState<string>(currentTracking.providers?.gtm?.credentialId || '');
  const [gtmEnabled, setGtmEnabled] = useState<boolean>(currentTracking.providers?.gtm?.enabled ?? true);
  const [gtmContainerId, setGtmContainerId] = useState<string>(currentTracking.providers?.gtm?.containerId || '');

  // TikTok config
  const [tiktokCredentialId, setTiktokCredentialId] = useState<string>(
    currentTracking.providers?.tiktok?.credentialId || '',
  );
  const [tiktokEnabled, setTiktokEnabled] = useState<boolean>(currentTracking.providers?.tiktok?.enabled ?? true);
  const [tiktokPixelId, setTiktokPixelId] = useState<string>(currentTracking.providers?.tiktok?.pixelId || '');
  const [tiktokEventsApiEnabled, setTiktokEventsApiEnabled] = useState<boolean>(
    currentTracking.providers?.tiktok?.eventsApiEnabled ?? false,
  );
  const [tiktokTestCode, setTiktokTestCode] = useState<string>(
    currentTracking.providers?.tiktok?.testEventCode || '',
  );

  // Custom Webhook config (destination + headers are host secrets)
  const [customCredentialId, setCustomCredentialId] = useState<string>(
    currentTracking.providers?.custom?.credentialId || '',
  );
  const [customEnabled, setCustomEnabled] = useState<boolean>(currentTracking.providers?.custom?.enabled ?? true);

  // Re-sync when modal opens
  useEffect(() => {
    if (isOpen) {
      const tr = doc.tracking || (doc.metadata as { tracking?: TrackingConfig })?.tracking;
      if (tr) {
        setEnabled(tr.enabled ?? true);
        setAutoPageView(tr.autoPageView ?? true);
        setDebugMode(tr.debugMode ?? false);
        setDefaultDelivery(tr.defaultDelivery || 'both');

        setMetaCredentialId(tr.providers?.meta?.credentialId || '');
        setMetaEnabled(tr.providers?.meta?.enabled ?? true);
        setMetaPixelId(tr.providers?.meta?.pixelId || '');
        setMetaCapiEnabled(tr.providers?.meta?.capiEnabled ?? false);
        setMetaTestCode(tr.providers?.meta?.testEventCode || '');

        setGoogleCredentialId(tr.providers?.google?.credentialId || '');
        setGoogleEnabled(tr.providers?.google?.enabled ?? true);
        setGoogleMeasurementId(tr.providers?.google?.measurementId || '');

        setGtmCredentialId(tr.providers?.gtm?.credentialId || '');
        setGtmEnabled(tr.providers?.gtm?.enabled ?? true);
        setGtmContainerId(tr.providers?.gtm?.containerId || '');

        setTiktokCredentialId(tr.providers?.tiktok?.credentialId || '');
        setTiktokEnabled(tr.providers?.tiktok?.enabled ?? true);
        setTiktokPixelId(tr.providers?.tiktok?.pixelId || '');
        setTiktokEventsApiEnabled(tr.providers?.tiktok?.eventsApiEnabled ?? false);
        setTiktokTestCode(tr.providers?.tiktok?.testEventCode || '');

        setCustomCredentialId(tr.providers?.custom?.credentialId || '');
        setCustomEnabled(tr.providers?.custom?.enabled ?? true);
      }
    }
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updatedConfig: TrackingConfig = {
      enabled,
      autoPageView,
      debugMode,
      defaultDelivery,
      providers: {
        meta: {
          enabled: metaEnabled,
          credentialId: metaCredentialId || undefined,
          pixelId: metaPixelId.trim(),
          capiEnabled: metaCapiEnabled,
          testEventCode: metaTestCode.trim(),
        },
        google: {
          enabled: googleEnabled,
          credentialId: googleCredentialId || undefined,
          measurementId: googleMeasurementId.trim(),
        },
        gtm: {
          enabled: gtmEnabled,
          credentialId: gtmCredentialId || undefined,
          containerId: gtmContainerId.trim(),
        },
        tiktok: {
          enabled: tiktokEnabled,
          credentialId: tiktokCredentialId || undefined,
          pixelId: tiktokPixelId.trim(),
          eventsApiEnabled: tiktokEventsApiEnabled,
          testEventCode: tiktokTestCode.trim(),
        },
        custom: {
          enabled: customEnabled,
          credentialId: customCredentialId || undefined,
        },
      },
    };

    updateDocumentTracking(updatedConfig);
    onClose();
  };

  const credentialsFor = (provider: string) => credentials?.filter((c) => c.provider === provider) ?? [];
  const findCredential = (id: string) => (id ? credentials?.find((c) => c.id === id) : undefined);

  const tabButton = (tab: ActiveTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
        activeTab === tab
          ? 'border-emerald-600 text-emerald-700'
          : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {label}
    </button>
  );

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
                    Automatically fires a PageView event on document load
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

          {/* Providers Tabs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tracking Providers</h3>
            </div>

            <div className="flex border-b border-slate-200 gap-2">
              {tabButton('meta', 'Meta (Facebook)')}
              {tabButton('google', 'Google Analytics 4')}
              {tabButton('gtm', 'GTM')}
              {tabButton('tiktok', 'TikTok')}
              {tabButton('custom', 'Custom Webhook')}
            </div>

            {/* TAB CONTENT: META */}
            {activeTab === 'meta' && (
              <div className="space-y-4 pt-1">
                <CredentialSelector
                  credentials={credentialsFor('meta')}
                  credentialId={metaCredentialId}
                  onManageCredentials={onManageCredentials}
                  onSelect={(id, cred) => {
                    setMetaCredentialId(id);
                    if (cred?.pixelId) setMetaPixelId(cred.pixelId);
                  }}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={metaEnabled}
                      onChange={(e) => setMetaEnabled(e.target.checked)}
                      disabled={!enabled}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>Enable Meta Tracking Provider</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Meta Pixel ID</label>
                    <input
                      type="text"
                      value={metaPixelId}
                      onChange={(e) => setMetaPixelId(e.target.value)}
                      placeholder="e.g. 123456789012345"
                      disabled={!enabled || !metaEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Test Event Code (Optional)</label>
                    <input
                      type="text"
                      value={metaTestCode}
                      onChange={(e) => setMetaTestCode(e.target.value)}
                      placeholder="e.g. TEST12345"
                      disabled={!enabled || !metaEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Meta Conversions API (CAPI)</span>
                      <span className="text-[11px] text-slate-500">
                        Server-side delivery through the host relay, bypassing ad-blockers and iOS restrictions
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={metaCapiEnabled}
                      onChange={(e) => setMetaCapiEnabled(e.target.checked)}
                      disabled={!enabled || !metaEnabled}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                  </div>

                  {metaCapiEnabled && (
                    <SecretVault
                      provider="meta"
                      title="CAPI Access Token (stored on host)"
                      fields={[{ key: 'capiAccessToken', label: 'System User Access Token', placeholder: 'EAAB...' }]}
                      credentialId={metaCredentialId}
                      credential={findCredential(metaCredentialId)}
                      onSaveTrackingSecret={onSaveTrackingSecret}
                      onLinked={setMetaCredentialId}
                      disabled={!enabled || !metaEnabled}
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: GOOGLE */}
            {activeTab === 'google' && (
              <div className="space-y-4 pt-1 text-xs">
                <CredentialSelector
                  credentials={credentialsFor('google')}
                  credentialId={googleCredentialId}
                  onManageCredentials={onManageCredentials}
                  onSelect={(id, cred) => {
                    setGoogleCredentialId(id);
                    const mid = cred?.measurementId || cred?.pixelId;
                    if (mid) setGoogleMeasurementId(mid);
                  }}
                />

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={googleEnabled}
                    onChange={(e) => setGoogleEnabled(e.target.checked)}
                    disabled={!enabled}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Enable Google Analytics 4</span>
                </label>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">Measurement ID</label>
                  <input
                    type="text"
                    value={googleMeasurementId}
                    onChange={(e) => setGoogleMeasurementId(e.target.value)}
                    placeholder="e.g. G-XXXXXXXXXX"
                    disabled={!enabled || !googleEnabled}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <SecretVault
                    provider="google"
                    title="Measurement Protocol API Secret (stored on host)"
                    fields={[
                      {
                        key: 'measurementProtocolSecret',
                        label: 'API Secret',
                        placeholder: 'API Secret from GA4 Admin',
                      },
                    ]}
                    credentialId={googleCredentialId}
                    credential={findCredential(googleCredentialId)}
                    onSaveTrackingSecret={onSaveTrackingSecret}
                    onLinked={setGoogleCredentialId}
                    disabled={!enabled || !googleEnabled}
                  />
                </div>
              </div>
            )}

            {/* TAB CONTENT: GTM */}
            {activeTab === 'gtm' && (
              <div className="space-y-4 pt-1 text-xs">
                <CredentialSelector
                  credentials={credentialsFor('gtm')}
                  credentialId={gtmCredentialId}
                  onManageCredentials={onManageCredentials}
                  onSelect={(id, cred) => {
                    setGtmCredentialId(id);
                    const cid = cred?.containerId || cred?.pixelId;
                    if (cid) setGtmContainerId(cid);
                  }}
                />

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={gtmEnabled}
                    onChange={(e) => setGtmEnabled(e.target.checked)}
                    disabled={!enabled}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Enable Google Tag Manager</span>
                </label>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">GTM Container ID</label>
                  <input
                    type="text"
                    value={gtmContainerId}
                    onChange={(e) => setGtmContainerId(e.target.value)}
                    placeholder="e.g. GTM-XXXXXXX"
                    disabled={!enabled || !gtmEnabled}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    GTM is client-side only: track_event steps push to <code>dataLayer</code>.
                  </span>
                </div>
              </div>
            )}

            {/* TAB CONTENT: TIKTOK */}
            {activeTab === 'tiktok' && (
              <div className="space-y-4 pt-1 text-xs">
                <CredentialSelector
                  credentials={credentialsFor('tiktok')}
                  credentialId={tiktokCredentialId}
                  onManageCredentials={onManageCredentials}
                  onSelect={(id, cred) => {
                    setTiktokCredentialId(id);
                    if (cred?.pixelId) setTiktokPixelId(cred.pixelId);
                  }}
                />

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={tiktokEnabled}
                    onChange={(e) => setTiktokEnabled(e.target.checked)}
                    disabled={!enabled}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Enable TikTok Tracking Provider</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">TikTok Pixel ID</label>
                    <input
                      type="text"
                      value={tiktokPixelId}
                      onChange={(e) => setTiktokPixelId(e.target.value)}
                      placeholder="e.g. C1234567890"
                      disabled={!enabled || !tiktokEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Test Event Code (Optional)</label>
                    <input
                      type="text"
                      value={tiktokTestCode}
                      onChange={(e) => setTiktokTestCode(e.target.value)}
                      placeholder="e.g. TEST12345"
                      disabled={!enabled || !tiktokEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">TikTok Events API</span>
                      <span className="text-[11px] text-slate-500">
                        Server-to-server tracking through the host relay
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tiktokEventsApiEnabled}
                      onChange={(e) => setTiktokEventsApiEnabled(e.target.checked)}
                      disabled={!enabled || !tiktokEnabled}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                  </div>

                  {tiktokEventsApiEnabled && (
                    <SecretVault
                      provider="tiktok"
                      title="Events API Access Token (stored on host)"
                      fields={[{ key: 'accessToken', label: 'Access Token', placeholder: 'Access Token...' }]}
                      credentialId={tiktokCredentialId}
                      credential={findCredential(tiktokCredentialId)}
                      onSaveTrackingSecret={onSaveTrackingSecret}
                      onLinked={setTiktokCredentialId}
                      disabled={!enabled || !tiktokEnabled}
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CUSTOM WEBHOOK */}
            {activeTab === 'custom' && (
              <div className="space-y-4 pt-1 text-xs">
                <CredentialSelector
                  credentials={credentialsFor('custom')}
                  credentialId={customCredentialId}
                  onManageCredentials={onManageCredentials}
                  onSelect={(id) => setCustomCredentialId(id)}
                />

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={customEnabled}
                    onChange={(e) => setCustomEnabled(e.target.checked)}
                    disabled={!enabled}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>Enable Custom Webhook / Analytics Endpoint</span>
                </label>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60">
                  <SecretVault
                    provider="custom"
                    title="Webhook destination & headers (stored on host)"
                    fields={[
                      {
                        key: 'endpointUrl',
                        label: 'Webhook Endpoint URL',
                        placeholder: 'https://myapi.com/webhooks/tracking',
                        secret: false,
                      },
                    ]}
                    allowHeaders
                    credentialId={customCredentialId}
                    credential={findCredential(customCredentialId)}
                    onSaveTrackingSecret={onSaveTrackingSecret}
                    onLinked={setCustomCredentialId}
                    disabled={!enabled || !customEnabled}
                  />
                </div>
              </div>
            )}
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
