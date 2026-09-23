import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import type { AssetProvider, RuntimeContext } from '@kubuild/core';
import type { ComponentNode, PageDocument } from '@kubuild/schema';
import * as editorApi from '../src';
import { useEditorStore } from '../src/store';
import {
  getTranslation,
  mergeTranslations,
  registerEditorLocale,
  unregisterEditorLocale,
  getAvailableEditorLocales,
  TranslationOverridesContext,
  en,
  id,
} from '../src/i18n';
import { EditorCanvas } from '../src/components/canvas/canvas';
import { InspectorPanel } from '../src/components/panels/inspector-panel';
import { TraitsPanel } from '../src/components/panels/traits-panel';
import { LanguageSwitcher } from '../src/components/ui/language-switcher';
import { buildEditorPreviewContext } from '../src/components/layout/preview-context';
import { createControlledStoreSync } from '../src/components/layout/controlled-store-sync';

const registry = createDefaultComponentRegistry();

function docWith(children: ComponentNode[]): PageDocument {
  const doc = createBlankDocument('Host Integration');
  doc.document.children = children;
  return doc;
}

const imageNode = (nodeId: string, src: string): ComponentNode => ({
  id: nodeId,
  type: 'image',
  props: { src, alt: 'Hero' },
  styles: { base: {} },
  children: [],
});

const assetProvider: AssetProvider = {
  resolve: (uri) => (uri === 'asset://hero' ? 'https://cdn.example.com/hero.png' : uri),
};

describe('KubuildEditor assetProvider → canvas render context', () => {
  it('forwards the assetProvider prop into the preview context', () => {
    const ctx = buildEditorPreviewContext(undefined, {}, assetProvider);
    expect(ctx?.assetProvider).toBe(assetProvider);
  });

  it('keeps a host-provided context.assetProvider over the prop', () => {
    const hostProvider: AssetProvider = { resolve: (uri) => `https://host.example.com/${uri}` };
    const host: RuntimeContext = { assetProvider: hostProvider, variables: { a: 1 } };
    const ctx = buildEditorPreviewContext(host, {}, assetProvider);
    expect(ctx?.assetProvider).toBe(hostProvider);
    expect(ctx?.variables).toEqual({ a: 1 });
  });

  it('merges catalog samples with host variables and still forwards the provider', () => {
    const ctx = buildEditorPreviewContext(
      { variables: { a: 'host' } },
      { a: 'sample', b: 'sample' },
      assetProvider,
    );
    expect(ctx?.variables).toEqual({ a: 'host', b: 'sample' });
    expect(ctx?.assetProvider).toBe(assetProvider);
  });

  it('returns the host context unchanged when there is nothing to add', () => {
    const host: RuntimeContext = { variables: { a: 1 } };
    expect(buildEditorPreviewContext(host, {}, undefined)).toBe(host);
    expect(buildEditorPreviewContext(undefined, {}, undefined)).toBeUndefined();
  });

  it('resolves asset:// image sources on the canvas through the forwarded provider', () => {
    const doc = docWith([imageNode('img-1', 'asset://hero')]);
    const html = renderToString(
      <EditorCanvas
        registry={registry}
        document={doc}
        viewport="desktop"
        context={buildEditorPreviewContext(undefined, {}, assetProvider)}
      />,
    );
    expect(html).toContain('https://cdn.example.com/hero.png');
  });
});

describe('Controlled selection sync (selectedNodeId / onSelectionChange)', () => {
  beforeEach(() => {
    useEditorStore
      .getState()
      .setDocument(docWith([imageNode('a', 'x.png'), imageNode('b', 'y.png')]));
  });

  it('pushes the prop value into the store without echoing it back', () => {
    const onChange = vi.fn();
    const sync = createControlledStoreSync(useEditorStore, {
      select: (s) => s.selectedNodeId,
      write: (s, nodeId) => s.selectNode(nodeId),
      onChange: () => onChange,
    });

    sync.apply('a');
    expect(useEditorStore.getState().selectedNodeId).toBe('a');
    expect(useEditorStore.getState().selectedNodeIds).toEqual(['a']);
    expect(onChange).not.toHaveBeenCalled();

    // Re-applying the same value is a no-op.
    sync.apply('a');
    expect(onChange).not.toHaveBeenCalled();
    sync.dispose();
  });

  it('reports selection changes made inside the editor', () => {
    const onChange = vi.fn();
    const sync = createControlledStoreSync(useEditorStore, {
      select: (s) => s.selectedNodeId,
      write: (s, nodeId) => s.selectNode(nodeId),
      onChange: () => onChange,
    });

    useEditorStore.getState().selectNode('b');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('b');

    // Host feeds the reported value straight back into the prop → no loop.
    sync.apply('b');
    expect(onChange).toHaveBeenCalledTimes(1);

    // Unrelated store updates don't fire.
    useEditorStore.getState().hoverNode('a');
    expect(onChange).toHaveBeenCalledTimes(1);

    useEditorStore.getState().selectNode(null);
    expect(onChange).toHaveBeenLastCalledWith(null);

    sync.dispose();
    useEditorStore.getState().selectNode('a');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('reads the latest callback on every change', () => {
    let current = vi.fn();
    const first = current;
    const sync = createControlledStoreSync(useEditorStore, {
      select: (s) => s.selectedNodeId,
      write: (s, nodeId) => s.selectNode(nodeId),
      onChange: () => current,
    });
    current = vi.fn();
    useEditorStore.getState().selectNode('a');
    expect(first).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledWith('a');
    sync.dispose();
  });
});

describe('Translation overrides', () => {
  beforeEach(() => {
    useEditorStore.getState().setLocale('en');
  });
  afterEach(() => {
    unregisterEditorLocale('fr');
    useEditorStore.getState().setLocale('en');
  });

  it('deep-merges per-key overrides over built-ins and falls back per key', () => {
    const overrides = { en: { styleTab: 'Looks', media: { replace: 'Swap' } } };
    const t = getTranslation('en', overrides);
    expect(t.styleTab).toBe('Looks');
    expect(t.settingsTab).toBe(en.settingsTab);
    expect(t.media.replace).toBe('Swap');
    expect(t.media.removeImage).toBe(en.media.removeImage);
    // Built-ins untouched, other locales unaffected.
    expect(getTranslation('en').styleTab).toBe('Style');
    expect(getTranslation('id', overrides).styleTab).toBe(id.styleTab);
    // Cached per overrides object.
    expect(getTranslation('en', overrides)).toBe(t);
  });

  it('lets function-valued keys be overridden', () => {
    const t = getTranslation('id', {
      id: { componentSettings: (label: string) => `Atur ${label}` },
    });
    expect(t.componentSettings('Tombol')).toBe('Atur Tombol');
  });

  it('falls back to English for unknown / partially translated custom locales', () => {
    expect(getTranslation('xx').styleTab).toBe('Style');
    const t = getTranslation('fr', { fr: { styleTab: 'Style (fr)' } });
    expect(t.styleTab).toBe('Style (fr)');
    expect(t.settingsTab).toBe(en.settingsTab);
  });

  it('registers custom locales with English fallback', () => {
    registerEditorLocale('fr', { settingsTab: 'Paramètres', media: { replace: 'Remplacer' } });
    expect(getAvailableEditorLocales()).toContain('fr');
    const t = getTranslation('fr');
    expect(t.settingsTab).toBe('Paramètres');
    expect(t.media.replace).toBe('Remplacer');
    expect(t.media.removeImage).toBe(en.media.removeImage);
    unregisterEditorLocale('fr');
    expect(getTranslation('fr').settingsTab).toBe(en.settingsTab);
  });

  it('mergeTranslations ignores undefined keys', () => {
    expect(mergeTranslations(en, { styleTab: undefined }).styleTab).toBe('Style');
  });

  it('applies overrides from TranslationOverridesContext to panels', () => {
    const doc = docWith([
      {
        id: 'h1',
        type: 'heading',
        props: { text: 'Hi', level: 1 },
        styles: { base: {} },
        children: [],
      },
    ]);
    const html = renderToString(
      <TranslationOverridesContext.Provider
        value={{ en: { styleTab: 'Looks', settingsTab: 'Knobs' } }}
      >
        <InspectorPanel registry={registry} document={doc} selectedNodeId="h1" />
      </TranslationOverridesContext.Provider>,
    );
    expect(html).toContain('Looks');
    expect(html).toContain('Knobs');
  });

  it('LanguageSwitcher accepts custom locale options', () => {
    const html = renderToString(
      <LanguageSwitcher
        locales={[
          { code: 'en', label: 'EN' },
          { code: 'fr', label: 'FR', title: 'Français' },
        ]}
      />,
    );
    expect(html).toContain('data-testid="lang-switch-fr"');
    expect(html).not.toContain('data-testid="lang-switch-id"');
  });
});

describe('Media controls i18n', () => {
  afterEach(() => {
    useEditorStore.getState().setLocale('en');
  });

  const renderTraits = () =>
    renderToString(
      <TraitsPanel
        registry={registry}
        document={docWith([imageNode('img-1', 'https://example.com/img.jpg')])}
        selectedNodeId="img-1"
        onCommitTrait={() => {}}
      />,
    );

  it('renders English media labels by default', () => {
    const html = renderTraits();
    expect(html).toContain(en.media.replace);
    expect(html).toContain(en.media.removeImage);
    expect(html).toContain(en.media.useManualUrl);
    expect(html).not.toContain('Hapus gambar');
  });

  it('renders Indonesian media labels when locale is "id"', () => {
    useEditorStore.getState().setLocale('id');
    const html = renderTraits();
    expect(html).toContain('Ganti');
    expect(html).toContain('Hapus gambar');
    expect(html).toContain('Gunakan URL manual');
  });

  it('applies media overrides via context', () => {
    const html = renderToString(
      <TranslationOverridesContext.Provider
        value={{ en: { media: { useManualUrl: 'Paste a link' } } }}
      >
        <TraitsPanel
          registry={registry}
          document={docWith([imageNode('img-1', 'https://example.com/img.jpg')])}
          selectedNodeId="img-1"
          onCommitTrait={() => {}}
        />
      </TranslationOverridesContext.Provider>,
    );
    expect(html).toContain('Paste a link');
  });
});

describe('@kubuild/editor public exports', () => {
  it('exports LanguageSwitcher and the i18n extension API', () => {
    expect(editorApi.LanguageSwitcher).toBe(LanguageSwitcher);
    expect(editorApi.DEFAULT_LANGUAGE_SWITCHER_OPTIONS).toBeDefined();
    expect(editorApi.registerEditorLocale).toBe(registerEditorLocale);
    expect(editorApi.unregisterEditorLocale).toBeDefined();
    expect(editorApi.getAvailableEditorLocales).toBeDefined();
    expect(editorApi.mergeTranslations).toBeDefined();
    expect(editorApi.TranslationOverridesContext).toBe(TranslationOverridesContext);
    expect(editorApi.getTranslation).toBe(getTranslation);
    expect(editorApi.useTranslation).toBeDefined();
  });
});
