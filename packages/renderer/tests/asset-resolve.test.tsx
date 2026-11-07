import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument, type AssetProvider, type Diagnostic } from '@kubuild/core';
import type { Node } from '@kubuild/schema';
import { KubuildRenderer, createRenderContext, resolveAssetSync } from '../src';

const registry = createDefaultComponentRegistry();

function renderImage(src: unknown, assetProvider: AssetProvider) {
  const doc = createBlankDocument('Assets');
  const image: Node = { id: 'img-1', type: 'image', props: { src, alt: 'Hero' } };
  doc.document.children = [image];
  const diagnostics: Diagnostic[] = [];
  const html = renderToString(
    <KubuildRenderer
      document={doc}
      registry={registry}
      context={createRenderContext({ assetProvider })}
      mode="runtime"
      onDiagnostic={(d) => diagnostics.push(d)}
    />,
  );
  return { html, diagnostics };
}

describe('asset resolution', () => {
  it('uses the URL returned by a synchronous resolve()', () => {
    const provider: AssetProvider = { resolve: (id) => `https://cdn.test/${id}` };
    const { html, diagnostics } = renderImage(
      { type: 'asset', assetId: 'img_1', fallbackUrl: 'https://fallback.test/a.png' },
      provider,
    );
    expect(html).toContain('https://cdn.test/img_1');
    expect(diagnostics.filter((d) => d.code === 'ASSET_RESOLVE_ASYNC')).toHaveLength(0);
  });

  it('falls back and reports ASSET_RESOLVE_ASYNC when resolve() returns a Promise', () => {
    const provider: AssetProvider = { resolve: async (id) => `https://cdn.test/${id}` };
    const { html, diagnostics } = renderImage(
      { type: 'asset', assetId: 'img_2', fallbackUrl: 'https://fallback.test/b.png' },
      provider,
    );
    expect(html).toContain('https://fallback.test/b.png');
    const asyncDiagnostics = diagnostics.filter((d) => d.code === 'ASSET_RESOLVE_ASYNC');
    expect(asyncDiagnostics).toHaveLength(1);
    expect(asyncDiagnostics[0]).toMatchObject({ nodeId: 'img-1', assetIdOrUri: 'img_2' });
  });

  it('reports each async value only once per provider', () => {
    const provider: AssetProvider = { resolve: (id) => Promise.resolve(id) };
    const calls: string[] = [];
    resolveAssetSync(provider, 'a', (v) => calls.push(v));
    resolveAssetSync(provider, 'a', (v) => calls.push(v));
    resolveAssetSync(provider, 'b', (v) => calls.push(v));
    expect(calls).toEqual(['a', 'b']);
  });

  it('does not surface a rejected async resolve() as an unhandled rejection', async () => {
    const provider: AssetProvider = { resolve: () => Promise.reject(new Error('boom')) };
    expect(resolveAssetSync(provider, 'c')).toBeUndefined();
    await new Promise((r) => setTimeout(r, 0));
  });
});
