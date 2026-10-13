import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createBlankDocument } from '@kubuild/core';
import { TrackingSettingsModal } from '../src/components/modals/tracking-settings-modal';
import { useEditorStore } from '../src/store';
import { getActionTypeMeta, ACTION_TYPES } from '../src/components/panels/action-prop-control';

describe('TrackingSettingsModal & Editor Integration', () => {
  beforeEach(() => {
    const blank = createBlankDocument('Test Tracking Page');
    useEditorStore.getState().setDocument(blank);
  });

  it('renders modal with master toggle, general policies, and provider tabs', () => {
    const doc = useEditorStore.getState().document;

    const html = renderToString(
      <TrackingSettingsModal
        isOpen={true}
        onClose={() => {}}
        document={doc}
      />,
    );

    expect(html).toContain('Pixel &amp; CAPI Tracking Settings');
    expect(html).toContain('Enable Tracking Feature');
    expect(html).toContain('tracking-master-toggle');
    expect(html).toContain('Auto Track PageView');
    expect(html).toContain('Debug / Test Mode');
    expect(html).toContain('Default Event Delivery Channel');
    expect(html).toContain('Meta (Facebook)');
    expect(html).toContain('Google Analytics 4');
    expect(html).toContain('TikTok');
    expect(html).toContain('Custom Webhook');
  });

  it('does not render anything when isOpen is false', () => {
    const doc = useEditorStore.getState().document;

    const html = renderToString(
      <TrackingSettingsModal
        isOpen={false}
        onClose={() => {}}
        document={doc}
      />,
    );

    expect(html).toBe('');
  });

  it('updates document tracking via store updateDocumentTracking action', () => {
    const store = useEditorStore.getState();
    expect(store.document.tracking).toBeUndefined();

    store.updateDocumentTracking({
      enabled: true,
      debugMode: true,
      autoPageView: true,
      providers: {
        meta: {
          enabled: true,
          pixelId: 'META_123456',
          capiEnabled: true,
          capiAccessToken: 'TOKEN_XYZ',
          testEventCode: 'TEST999',
          serverRelayUrl: '/api/tracking/meta',
        },
      },
    });

    const updated = useEditorStore.getState().document;
    expect(updated.tracking?.enabled).toBe(true);
    expect(updated.tracking?.debugMode).toBe(true);
    expect(updated.tracking?.providers.meta?.pixelId).toBe('META_123456');
    expect(updated.tracking?.providers.meta?.capiEnabled).toBe(true);
    // Secrets / relay URLs are never written into the document, even if a caller passes them.
    expect(JSON.stringify(updated)).not.toContain('TOKEN_XYZ');
    expect(JSON.stringify(updated)).not.toContain('/api/tracking/meta');
    expect(updated.tracking?.providers.meta?.testEventCode).toBe('TEST999');
    expect(useEditorStore.getState().canUndo).toBe(true);

    // Test Undo
    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().document;
    expect(undone.tracking).toBeUndefined();
  });

  const capiDoc = () => {
    const doc = createBlankDocument('CAPI Page');
    doc.tracking = {
      enabled: true,
      debugMode: false,
      autoPageView: true,
      defaultDelivery: 'both',
      providers: {
        meta: { enabled: true, credentialId: 'cred_meta', pixelId: '999', capiEnabled: true, testEventCode: '' },
      },
    };
    return doc;
  };

  it('disables secret inputs with an explanation when the host provides no onSaveTrackingSecret', () => {
    const html = renderToString(
      <TrackingSettingsModal isOpen={true} onClose={() => {}} document={capiDoc()} />,
    );
    expect(html).toContain('tracking-secret-meta');
    expect(html).toContain('tracking-secret-disabled-meta');
    expect(html).toContain('Secrets are never stored in the page');
    expect(html).not.toContain('tracking-secret-save-meta');
    // the password input is rendered disabled
    expect(html).toMatch(/type="password"[^>]*disabled=""/);
    // no relay URL / endpoint URL inputs for the document
    expect(html).not.toContain('Server Relay URL');
    expect(html).not.toContain('/api/tracking/meta');
  });

  it('enables secret entry for a pixel whose credential has no secret yet', () => {
    const onSave = vi.fn().mockResolvedValue({ credentialId: 'cred_new' });
    const html = renderToString(
      <TrackingSettingsModal
        isOpen={true}
        onClose={() => {}}
        document={capiDoc()}
        credentials={[{ id: 'cred_meta', name: 'Main Meta Pixel', provider: 'meta', pixelId: '999', hasSecret: false }]}
        onSaveTrackingSecret={onSave}
      />,
    );
    expect(html).toContain('tracking-secret-save-meta');
    expect(html).not.toContain('tracking-secret-disabled-meta');
    expect(html).toContain('Main Meta Pixel');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('needs no secret entry when the linked credential already holds its secret', () => {
    const html = renderToString(
      <TrackingSettingsModal
        isOpen={true}
        onClose={() => {}}
        document={capiDoc()}
        credentials={[{ id: 'cred_meta', name: 'Main Meta Pixel', provider: 'meta', pixelId: '999', hasSecret: true }]}
        onSaveTrackingSecret={vi.fn()}
      />,
    );
    expect(html).toContain('Secret stored on host');
    expect(html).not.toContain('tracking-secret-meta');
  });

  it('shows host relay info read-only (or explains server events are skipped without it)', () => {
    const withRelay = renderToString(
      <TrackingSettingsModal isOpen={true} onClose={() => {}} document={capiDoc()} trackingRelayUrl="/api/track" />,
    );
    expect(withRelay).toContain('tracking-relay-info');
    expect(withRelay).toContain('/api/track');

    const withoutRelay = renderToString(
      <TrackingSettingsModal isOpen={true} onClose={() => {}} document={capiDoc()} />,
    );
    expect(withoutRelay).toContain('No server relay is configured by the host');
  });

  it('registers track_event in ACTION_TYPES with correct metadata', () => {
    const meta = getActionTypeMeta('track_event');
    expect(meta).toBeDefined();
    expect(meta.type).toBe('track_event');
    expect(meta.shortLabel).toBe('Track Pixel');
    expect(meta.label).toContain('Track Event');
    expect(meta.defaultPayload.eventName).toBe('Lead');
    expect(meta.defaultPayload.delivery).toBe('both');

    const foundInList = ACTION_TYPES.some((a) => a.type === 'track_event');
    expect(foundInList).toBe(true);
  });
});

describe('TrackingSettingsModal — multiple pixels and host pixels', () => {
  const multiDoc = () => {
    const doc = createBlankDocument('Multi Pixel Page');
    doc.tracking = {
      enabled: true,
      debugMode: false,
      autoPageView: true,
      defaultDelivery: 'both',
      pixels: [
        { id: 'own', provider: 'meta', enabled: true, pixelId: '111', serverEnabled: false, testEventCode: '', disabledEvents: [] },
        { id: 'agency', provider: 'meta', enabled: true, pixelId: '222', serverEnabled: false, testEventCode: '', disabledEvents: ['Purchase'] },
      ],
      inherit: { enabled: true, excludedPixelIds: ['host-tt'] },
    };
    return doc;
  };

  it('lists every pixel of a provider and the skipped events', () => {
    const html = renderToString(<TrackingSettingsModal isOpen onClose={() => {}} document={multiDoc()} />);
    expect(html).toContain('tracking-pixel-own');
    expect(html).toContain('tracking-pixel-agency');
    expect(html).toContain('value="Purchase"');
    expect(html).toContain('tracking-add-manual');
  });

  it('shows host pixels with a per-page switch, unchecked when excluded', () => {
    const html = renderToString(
      <TrackingSettingsModal
        isOpen
        onClose={() => {}}
        document={multiDoc()}
        inheritedPixels={[
          { id: 'host-meta', provider: 'meta', pixelId: '999', label: 'Funnel pixel' },
          { id: 'host-tt', provider: 'tiktok', pixelId: 'TT1' },
        ]}
        inheritedPixelsSource="this funnel"
      />,
    );
    expect(html).toContain('Pixels from this funnel');
    expect(html).toContain('Funnel pixel');
    const row = (id: string) => html.slice(html.indexOf(`tracking-inherited-${id}`)).split('</li>')[0];
    expect(row('host-meta')).toContain('checked=""');
    expect(row('host-tt')).not.toContain('checked=""');
    expect(html).toContain('Extra pixels for this page');
  });

  it('offers saved pixels that are not on the page or applied by the host', () => {
    const html = renderToString(
      <TrackingSettingsModal
        isOpen
        onClose={() => {}}
        document={multiDoc()}
        inheritedPixels={[{ id: 'host-meta', provider: 'meta', pixelId: '999', credentialId: 'cred_host' }]}
        credentials={[
          { id: 'cred_host', name: 'Host pixel', provider: 'meta', pixelId: '999' },
          { id: 'cred_dup', name: 'Same id as page pixel', provider: 'meta', pixelId: '111' },
          { id: 'cred_free', name: 'Free pixel', provider: 'meta', pixelId: '555', hasSecret: true },
        ]}
      />,
    );
    expect(html).toContain('tracking-add-saved-select');
    expect(html).toContain('Free pixel');
    expect(html).not.toContain('Host pixel');
    expect(html).not.toContain('Same id as page pixel');
  });
});
