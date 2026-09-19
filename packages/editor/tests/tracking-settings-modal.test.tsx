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
    expect(useEditorStore.getState().canUndo).toBe(true);

    // Test Undo
    useEditorStore.getState().undo();
    const undone = useEditorStore.getState().document;
    expect(undone.tracking).toBeUndefined();
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
