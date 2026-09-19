import React, { useState, useEffect } from 'react';
import type { PageDocument, TrackingConfig, TrackingDelivery } from '@kubuild/schema';
import type { PixelCredentialOption } from '@kubuild/schema';
import { useEditorStore } from '../../store';
import {
  Activity,
  X,
  Check,
  Globe,
  Radio,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Terminal,
  Server,
  Plus,
  Trash2,
} from 'lucide-react';

export interface TrackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document?: PageDocument;
  /** Saved pixel credentials available for selection (from account/workspace) */
  credentials?: PixelCredentialOption[];
  /** Called when user clicks "Kelola Kredensial" link */
  onManageCredentials?: () => void;
}

type ActiveTab = 'meta' | 'google' | 'gtm' | 'tiktok' | 'custom';

export const TrackingSettingsModal: React.FC<TrackingSettingsModalProps> = ({
  isOpen,
  onClose,
  document: propDoc,
  credentials,
  onManageCredentials,
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
  const [metaEnabled, setMetaEnabled] = useState<boolean>(
    currentTracking.providers?.meta?.enabled ?? true,
  );
  const [metaPixelId, setMetaPixelId] = useState<string>(
    currentTracking.providers?.meta?.pixelId || '',
  );
  const [metaCapiEnabled, setMetaCapiEnabled] = useState<boolean>(
    currentTracking.providers?.meta?.capiEnabled ?? false,
  );
  const [metaCapiToken, setMetaCapiToken] = useState<string>(
    currentTracking.providers?.meta?.capiAccessToken || '',
  );
  const [metaTestCode, setMetaTestCode] = useState<string>(
    currentTracking.providers?.meta?.testEventCode || '',
  );
  const [metaRelayUrl, setMetaRelayUrl] = useState<string>(
    currentTracking.providers?.meta?.serverRelayUrl || '',
  );

  // Google config
  const [googleCredentialId, setGoogleCredentialId] = useState<string>(
    currentTracking.providers?.google?.credentialId || '',
  );
  const [googleEnabled, setGoogleEnabled] = useState<boolean>(
    currentTracking.providers?.google?.enabled ?? true,
  );
  const [googleMeasurementId, setGoogleMeasurementId] = useState<string>(
    currentTracking.providers?.google?.measurementId || '',
  );
  const [googleSecret, setGoogleSecret] = useState<string>(
    currentTracking.providers?.google?.measurementProtocolSecret || '',
  );
  const [googleRelayUrl, setGoogleRelayUrl] = useState<string>(
    currentTracking.providers?.google?.serverRelayUrl || '',
  );

  // GTM config
  const [gtmCredentialId, setGtmCredentialId] = useState<string>(
    currentTracking.providers?.gtm?.credentialId || '',
  );
  const [gtmEnabled, setGtmEnabled] = useState<boolean>(
    currentTracking.providers?.gtm?.enabled ?? true,
  );
  const [gtmContainerId, setGtmContainerId] = useState<string>(
    currentTracking.providers?.gtm?.containerId || '',
  );
  const [gtmRelayUrl, setGtmRelayUrl] = useState<string>(
    currentTracking.providers?.gtm?.serverRelayUrl || '',
  );

  // TikTok config
  const [tiktokCredentialId, setTiktokCredentialId] = useState<string>(
    currentTracking.providers?.tiktok?.credentialId || '',
  );
  const [tiktokEnabled, setTiktokEnabled] = useState<boolean>(
    currentTracking.providers?.tiktok?.enabled ?? true,
  );
  const [tiktokPixelId, setTiktokPixelId] = useState<string>(
    currentTracking.providers?.tiktok?.pixelId || '',
  );
  const [tiktokEventsApiEnabled, setTiktokEventsApiEnabled] = useState<boolean>(
    currentTracking.providers?.tiktok?.eventsApiEnabled ?? false,
  );
  const [tiktokAccessToken, setTiktokAccessToken] = useState<string>(
    currentTracking.providers?.tiktok?.accessToken || '',
  );
  const [tiktokTestCode, setTiktokTestCode] = useState<string>(
    currentTracking.providers?.tiktok?.testEventCode || '',
  );
  const [tiktokRelayUrl, setTiktokRelayUrl] = useState<string>(
    currentTracking.providers?.tiktok?.serverRelayUrl || '',
  );

  // Custom Webhook config
  const [customCredentialId, setCustomCredentialId] = useState<string>(
    currentTracking.providers?.custom?.credentialId || '',
  );
  const [customEnabled, setCustomEnabled] = useState<boolean>(
    currentTracking.providers?.custom?.enabled ?? true,
  );
  const [customEndpoint, setCustomEndpoint] = useState<string>(
    currentTracking.providers?.custom?.endpointUrl || '',
  );
  const [customHeaders, setCustomHeaders] = useState<Array<{ id: string; key: string; value: string }>>(() => {
    const hdrs = currentTracking.providers?.custom?.headers || {};
    return Object.entries(hdrs).map(([k, v], i) => ({ id: `hdr-${i}`, key: k, value: v }));
  });

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
        setMetaCapiToken(tr.providers?.meta?.capiAccessToken || '');
        setMetaTestCode(tr.providers?.meta?.testEventCode || '');
        setMetaRelayUrl(tr.providers?.meta?.serverRelayUrl || '');

        setGoogleCredentialId(tr.providers?.google?.credentialId || '');
        setGoogleEnabled(tr.providers?.google?.enabled ?? true);
        setGoogleMeasurementId(tr.providers?.google?.measurementId || '');
        setGoogleSecret(tr.providers?.google?.measurementProtocolSecret || '');
        setGoogleRelayUrl(tr.providers?.google?.serverRelayUrl || '');

        setGtmCredentialId(tr.providers?.gtm?.credentialId || '');
        setGtmEnabled(tr.providers?.gtm?.enabled ?? true);
        setGtmContainerId(tr.providers?.gtm?.containerId || '');
        setGtmRelayUrl(tr.providers?.gtm?.serverRelayUrl || '');

        setTiktokCredentialId(tr.providers?.tiktok?.credentialId || '');
        setTiktokEnabled(tr.providers?.tiktok?.enabled ?? true);
        setTiktokPixelId(tr.providers?.tiktok?.pixelId || '');
        setTiktokEventsApiEnabled(tr.providers?.tiktok?.eventsApiEnabled ?? false);
        setTiktokAccessToken(tr.providers?.tiktok?.accessToken || '');
        setTiktokTestCode(tr.providers?.tiktok?.testEventCode || '');
        setTiktokRelayUrl(tr.providers?.tiktok?.serverRelayUrl || '');

        setCustomCredentialId(tr.providers?.custom?.credentialId || '');
        setCustomEnabled(tr.providers?.custom?.enabled ?? true);
        setCustomEndpoint(tr.providers?.custom?.endpointUrl || '');
        const hdrs = tr.providers?.custom?.headers || {};
        setCustomHeaders(Object.entries(hdrs).map(([k, v], i) => ({ id: `hdr-${i}`, key: k, value: v })));
      }
    }
  }, [isOpen, doc]);

  if (!isOpen) return null;

  const handleSave = () => {
    const headersMap: Record<string, string> = {};
    for (const h of customHeaders) {
      if (h.key.trim()) headersMap[h.key.trim()] = h.value;
    }

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
          capiAccessToken: metaCapiToken.trim(),
          testEventCode: metaTestCode.trim(),
          serverRelayUrl: metaRelayUrl.trim(),
        },
        google: {
          enabled: googleEnabled,
          credentialId: googleCredentialId || undefined,
          measurementId: googleMeasurementId.trim(),
          measurementProtocolSecret: googleSecret.trim(),
          serverRelayUrl: googleRelayUrl.trim(),
        },
        gtm: {
          enabled: gtmEnabled,
          credentialId: gtmCredentialId || undefined,
          containerId: gtmContainerId.trim(),
          serverRelayUrl: gtmRelayUrl.trim(),
        },
        tiktok: {
          enabled: tiktokEnabled,
          credentialId: tiktokCredentialId || undefined,
          pixelId: tiktokPixelId.trim(),
          eventsApiEnabled: tiktokEventsApiEnabled,
          accessToken: tiktokAccessToken.trim(),
          testEventCode: tiktokTestCode.trim(),
          serverRelayUrl: tiktokRelayUrl.trim(),
        },
        custom: {
          enabled: customEnabled,
          credentialId: customCredentialId || undefined,
          endpointUrl: customEndpoint.trim(),
          headers: headersMap,
        },
      },
    };

    updateDocumentTracking(updatedConfig);
    onClose();
  };

  const handleAddHeader = () => {
    setCustomHeaders((prev) => [...prev, { id: `hdr-${Date.now()}`, key: '', value: '' }]);
  };

  const handleRemoveHeader = (id: string) => {
    setCustomHeaders((prev) => prev.filter((h) => h.id !== id));
  };

  const handleHeaderChange = (id: string, keyOrVal: 'key' | 'value', val: string) => {
    setCustomHeaders((prev) =>
      prev.map((h) => (h.id === id ? { ...h, [keyOrVal]: val } : h)),
    );
  };

  // Helper: filter credentials by provider type
  const credentialsFor = (provider: string) =>
    credentials?.filter((c) => c.provider === provider) ?? [];

  // Shared credential selector section rendered at the top of each provider tab
  const CredentialSelector = ({
    provider,
    credentialId,
    onSelect,
  }: {
    provider: string;
    credentialId: string;
    onSelect: (id: string, cred: PixelCredentialOption | null) => void;
  }) => {
    const filtered = credentialsFor(provider);
    if (filtered.length === 0) return null;

    return (
      <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-emerald-800 block">
            Pilih Kredensial Tersimpan
          </label>
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
            const found = filtered.find((c) => c.id === selectedId) ?? null;
            onSelect(selectedId, found);
          }}
          className="w-full text-xs bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
        >
          <option value="">Manual (tidak terhubung)</option>
          {filtered.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.pixelId ? `(${c.pixelId})` : ''}
            </option>
          ))}
        </select>
        {credentialId && (
          <p className="text-[10px] text-emerald-700">
            Field di bawah diisi otomatis dari kredensial. Anda tetap bisa mengubah secara manual.
          </p>
        )}
      </div>
    );
  };

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
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              General Policies
            </h3>
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
          </div>

          {/* Providers Tabs */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Tracking Providers
              </h3>
            </div>

            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('meta')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'meta'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Meta (Facebook)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('google')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'google'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Google Analytics 4
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gtm')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'gtm'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                GTM
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('tiktok')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'tiktok'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                TikTok
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('custom')}
                className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'custom'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Custom Webhook
              </button>
            </div>

            {/* TAB CONTENT: META */}
            {activeTab === 'meta' && (
              <div className="space-y-4 pt-1">
                {/* Credential selector */}
                <CredentialSelector
                  provider="meta"
                  credentialId={metaCredentialId}
                  onSelect={(id, cred) => {
                    setMetaCredentialId(id);
                    if (cred) {
                      setMetaPixelId(cred.pixelId || '');
                      setMetaCapiToken(cred.capiAccessToken || '');
                      setMetaTestCode(cred.testEventCode || '');
                      setMetaRelayUrl(cred.serverRelayUrl || '');
                    }
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
                    <label className="block text-slate-600 font-medium mb-1">
                      Meta Pixel ID
                    </label>
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
                    <label className="block text-slate-600 font-medium mb-1">
                      Test Event Code (Optional)
                    </label>
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

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Meta Conversions API (CAPI)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Enables reliable server-side tracking bypassing ad-blockers and iOS restrictions
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
                    <div className="space-y-3 pt-2 text-xs border-t border-slate-200">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          Server Relay URL (Recommended for Client-Side)
                        </label>
                        <input
                          type="text"
                          value={metaRelayUrl}
                          onChange={(e) => setMetaRelayUrl(e.target.value)}
                          placeholder="e.g. /api/tracking/meta"
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          Client browser calls this endpoint, allowing your server backend to dispatch CAPI securely without exposing your API token.
                        </span>
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          Direct CAPI Access Token (Server / Testing Only)
                        </label>
                        <input
                          type="password"
                          value={metaCapiToken}
                          onChange={(e) => setMetaCapiToken(e.target.value)}
                          placeholder="EAAB..."
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono text-xs"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                          System User Access Token from Meta Business Suite.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: GOOGLE */}
            {activeTab === 'google' && (
              <div className="space-y-4 pt-1 text-xs">
                {/* Credential selector */}
                <CredentialSelector
                  provider="google"
                  credentialId={googleCredentialId}
                  onSelect={(id, cred) => {
                    setGoogleCredentialId(id);
                    if (cred) {
                      setGoogleMeasurementId(cred.pixelId || '');
                      setGoogleSecret(cred.measurementProtocolSecret || '');
                      setGoogleRelayUrl(cred.serverRelayUrl || '');
                    }
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Measurement ID
                    </label>
                    <input
                      type="text"
                      value={googleMeasurementId}
                      onChange={(e) => setGoogleMeasurementId(e.target.value)}
                      placeholder="e.g. G-XXXXXXXXXX"
                      disabled={!enabled || !googleEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Measurement Protocol Secret (Server-Side)
                    </label>
                    <input
                      type="password"
                      value={googleSecret}
                      onChange={(e) => setGoogleSecret(e.target.value)}
                      placeholder="API Secret from GA4 Admin"
                      disabled={!enabled || !googleEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Server Relay URL
                  </label>
                  <input
                    type="text"
                    value={googleRelayUrl}
                    onChange={(e) => setGoogleRelayUrl(e.target.value)}
                    placeholder="e.g. /api/tracking/ga4"
                    disabled={!enabled || !googleEnabled}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* TAB CONTENT: GTM */}
            {activeTab === 'gtm' && (
              <div className="space-y-4 pt-1 text-xs">
                {/* Credential selector */}
                <CredentialSelector
                  provider="gtm"
                  credentialId={gtmCredentialId}
                  onSelect={(id, cred) => {
                    setGtmCredentialId(id);
                    if (cred) {
                      // GTM container IDs are stored in pixelId field of the credential
                      setGtmContainerId(cred.pixelId || '');
                      setGtmRelayUrl(cred.serverRelayUrl || '');
                    }
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      GTM Container ID
                    </label>
                    <input
                      type="text"
                      value={gtmContainerId}
                      onChange={(e) => setGtmContainerId(e.target.value)}
                      placeholder="e.g. GTM-XXXXXXX"
                      disabled={!enabled || !gtmEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">
                      Server Relay URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={gtmRelayUrl}
                      onChange={(e) => setGtmRelayUrl(e.target.value)}
                      placeholder="e.g. /api/tracking/gtm"
                      disabled={!enabled || !gtmEnabled}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: TIKTOK */}
            {activeTab === 'tiktok' && (
              <div className="space-y-4 pt-1 text-xs">
                {/* Credential selector */}
                <CredentialSelector
                  provider="tiktok"
                  credentialId={tiktokCredentialId}
                  onSelect={(id, cred) => {
                    setTiktokCredentialId(id);
                    if (cred) {
                      setTiktokPixelId(cred.pixelId || '');
                      setTiktokAccessToken(cred.capiAccessToken || '');
                      setTiktokTestCode(cred.testEventCode || '');
                      setTiktokRelayUrl(cred.serverRelayUrl || '');
                    }
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
                    <label className="block text-slate-600 font-medium mb-1">
                      TikTok Pixel ID
                    </label>
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
                    <label className="block text-slate-600 font-medium mb-1">
                      Test Event Code (Optional)
                    </label>
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
                      <span className="text-xs font-bold text-slate-800 block">
                        TikTok Events API
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Direct server-to-server tracking for TikTok campaigns
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
                    <div className="space-y-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          Server Relay URL
                        </label>
                        <input
                          type="text"
                          value={tiktokRelayUrl}
                          onChange={(e) => setTiktokRelayUrl(e.target.value)}
                          placeholder="e.g. /api/tracking/tiktok"
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          TikTok Events API Access Token
                        </label>
                        <input
                          type="password"
                          value={tiktokAccessToken}
                          onChange={(e) => setTiktokAccessToken(e.target.value)}
                          placeholder="Access Token..."
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CUSTOM WEBHOOK */}
            {activeTab === 'custom' && (
              <div className="space-y-4 pt-1 text-xs">
                {/* Credential selector */}
                <CredentialSelector
                  provider="custom"
                  credentialId={customCredentialId}
                  onSelect={(id, cred) => {
                    setCustomCredentialId(id);
                    if (cred) {
                      setCustomEndpoint(cred.serverRelayUrl || '');
                      if (cred.customHeaders) {
                        const entries = Object.entries(cred.customHeaders).map(([k, v], i) => ({
                          id: `hdr-cred-${i}`,
                          key: k,
                          value: v,
                        }));
                        setCustomHeaders(entries);
                      }
                    }
                  }}
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

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Webhook Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="https://myapi.com/webhooks/tracking"
                    disabled={!enabled || !customEnabled}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-slate-600 font-medium">
                      Custom HTTP Headers
                    </label>
                    <button
                      type="button"
                      onClick={handleAddHeader}
                      disabled={!enabled || !customEnabled}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Header
                    </button>
                  </div>

                  {customHeaders.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                      No custom headers configured
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customHeaders.map((hdr) => (
                        <div key={hdr.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={hdr.key}
                            onChange={(e) => handleHeaderChange(hdr.id, 'key', e.target.value)}
                            placeholder="Header Name"
                            className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                          <input
                            type="text"
                            value={hdr.value}
                            onChange={(e) => handleHeaderChange(hdr.id, 'value', e.target.value)}
                            placeholder="Header Value"
                            className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveHeader(hdr.id)}
                            className="p-1 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
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
