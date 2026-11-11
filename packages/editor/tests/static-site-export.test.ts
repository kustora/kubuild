import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createBlankDocument, createEffectRegistry, defineEffectPlugin } from '@kubuild/core';
import type { Node, PageDocument } from '@kubuild/schema';
import { KUBUILD_RUNTIME_SOURCE } from '@kubuild/runtime-dom/source';
import { buildStaticSiteArchive } from '../src/utils/export-utils';

const drift = defineEffectPlugin<{ speed: number }>({
  id: 'parallax-scroll',
  label: 'Drift',
  description: 'Test effect',
  defaults: { speed: 0.3 },
  configJsonSchema: { type: 'object' },
  fields: [],
  parse: () => ({ success: true, config: { speed: 0.3 } }),
  mount: () => {},
});

function doc(withEffect: boolean) {
  const d = createBlankDocument('My Page');
  d.document.children = [
    {
      id: 'hero',
      type: 'section',
      props: {},
      styles: {},
      effects: withEffect ? [{ plugin: 'parallax-scroll', enabled: true, config: {} }] : undefined,
      children: [],
    },
  ];
  return d;
}

describe('buildStaticSiteArchive', () => {
  it('ships index.html plus the runtime when the page has effects', async () => {
    const result = await buildStaticSiteArchive(doc(true), { effectRegistry: createEffectRegistry([drift]) });
    expect(result.files).toEqual(['index.html', 'kubuild-runtime.js']);

    const files = unzipSync(result.archive);
    const html = strFromU8(files['index.html']);
    expect(html).toContain('<script src="kubuild-runtime.js" defer></script>');
    expect(html).toContain('data-kb-node="hero"');
    expect(strFromU8(files['kubuild-runtime.js'])).toBe(KUBUILD_RUNTIME_SOURCE);
  });

  it('is plain HTML + CSS when there is nothing to run or no registry', async () => {
    const registry = createEffectRegistry([drift]);
    expect((await buildStaticSiteArchive(doc(false), { effectRegistry: registry })).files).toEqual(['index.html']);
    const noRegistry = await buildStaticSiteArchive(doc(true));
    expect(noRegistry.files).toEqual(['index.html']);
    expect(strFromU8(unzipSync(noRegistry.archive)['index.html'])).not.toContain('<script');
  });

  it('reports effects it could not ship', async () => {
    const d = doc(true);
    d.document.children![0].effects = [{ plugin: 'unknown-fx', enabled: true, config: {} }];
    const result = await buildStaticSiteArchive(d, { effectRegistry: createEffectRegistry([drift]) });
    expect(result.skippedEffects).toEqual([{ nodeId: 'hero', plugin: 'unknown-fx', reason: 'unknown-plugin' }]);
    expect(result.files).toEqual(['index.html']);
  });
});

describe('buildStaticSiteArchive — local assets (STORA-657)', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

  function page(children: Node[]): PageDocument {
    const d = createBlankDocument('Assets');
    d.document.children = children;
    return d;
  }
  const image = (id: string, src: unknown): Node => ({ id, type: 'image', props: { src, alt: id }, styles: {}, children: [] });
  const htmlOf = (archive: Uint8Array) => strFromU8(unzipSync(archive)['index.html']);

  it('copies blob: uploads into assets/ once and points every use at the relative path', async () => {
    const fetched: string[] = [];
    const fetchAsset = async (url: string) => {
      fetched.push(url);
      return url === 'blob:http://x/1' ? { data: PNG } : null; // no content type: sniffed
    };
    const result = await buildStaticSiteArchive(
      page([image('a', 'blob:http://x/1'), image('b', 'blob:http://x/1')]),
      { fetchAsset },
    );
    expect(fetched).toEqual(['blob:http://x/1']);
    expect(result.files).toEqual(['index.html', 'assets/asset-1.png']);
    expect(unzipSync(result.archive)['assets/asset-1.png']).toEqual(PNG);
    expect(htmlOf(result.archive).match(/src="assets\/asset-1\.png"/g)).toHaveLength(2);
    expect(result.assetFailures).toEqual([]);
  });

  it('resolves asset references from host bytes, the provider, or the fallback URL', async () => {
    const result = await buildStaticSiteArchive(
      page([
        image('bytes', { type: 'asset', assetId: 'logo', filename: 'Logo Final.jpg', mimeType: 'image/jpeg' }),
        image('provider', { type: 'asset', assetId: 'cdn-photo' }),
        image('fallback', { type: 'asset', assetId: 'gone', fallbackUrl: 'https://cdn.example.com/gone.png' }),
      ]),
      {
        assets: { logo: JPG },
        assetProvider: { resolve: (id) => (id === 'cdn-photo' ? 'https://cdn.example.com/photo.webp' : 'asset://unknown') },
      },
    );
    const html = htmlOf(result.archive);
    expect(result.files).toContain('assets/Logo_Final.jpg');
    expect(html).toContain('src="assets/Logo_Final.jpg"');
    expect(html).toContain('src="https://cdn.example.com/photo.webp"');
    expect(html).toContain('src="https://cdn.example.com/gone.png"');
    expect(html).not.toContain('[object Object]');
  });

  it('resolves asset: URIs through the provider, downloading only what a static host could not reach', async () => {
    const result = await buildStaticSiteArchive(
      page([image('remote', 'asset://hero'), image('local', 'asset://draft')]),
      {
        assetProvider: { resolve: (uri) => (uri === 'asset://hero' ? 'https://cdn.example.com/hero.png' : 'blob:http://x/draft') },
        fetchAsset: async (url) => (url === 'blob:http://x/draft' ? { data: JPG, mimeType: 'image/jpeg' } : null),
      },
    );
    const html = htmlOf(result.archive);
    expect(html).toContain('src="https://cdn.example.com/hero.png"');
    expect(html).toMatch(/src="assets\/asset-\d\.jpg"/);
  });

  it('rewrites url() in styles and leaves http(s) and data: URLs alone', async () => {
    const section: Node = {
      id: 's',
      type: 'section',
      props: {},
      styles: {
        base: { backgroundImage: 'linear-gradient(red, blue), url("blob:http://x/bg")' },
        mobile: { backgroundImage: 'url(https://cdn.example.com/m.png)' },
      },
      children: [image('data', 'data:image/png;base64,AAAA')],
    };
    const result = await buildStaticSiteArchive(page([section]), {
      fetchAsset: async () => ({ data: PNG, mimeType: 'image/png' }),
    });
    const html = htmlOf(result.archive);
    expect(html).toMatch(/background-image: linear-gradient\(red, blue\), url\("assets\/asset-\d\.png"\)/);
    expect(html).toContain('url(https://cdn.example.com/m.png)');
    expect(html).toContain('src="data:image/png;base64,AAAA"');
  });

  it('clears and reports what it cannot read instead of shipping dead references', async () => {
    const section: Node = {
      id: 's',
      type: 'section',
      props: {},
      styles: { base: { backgroundImage: 'url(blob:http://x/dead-bg)' } },
      children: [image('dead', 'blob:http://x/dead'), image('ref', { type: 'asset', assetId: 'missing' })],
    };
    const result = await buildStaticSiteArchive(page([section]), {
      fetchAsset: async () => {
        throw new Error('revoked');
      },
    });
    const html = htmlOf(result.archive);
    expect(html).not.toContain('blob:');
    expect(html).toContain('background-image: none');
    expect(result.assetFailures.map((f) => [f.nodeId, f.source])).toEqual(
      expect.arrayContaining([
        ['dead', 'blob:http://x/dead'],
        ['ref', 'missing'],
        ['s', 'blob:http://x/dead-bg'],
      ]),
    );
    expect(result.files).toEqual(['index.html']);
  });

  it('never touches the document it was given', async () => {
    const original = page([image('a', 'blob:http://x/1')]);
    const before = JSON.stringify(original);
    await buildStaticSiteArchive(original, { fetchAsset: async () => ({ data: PNG }) });
    expect(JSON.stringify(original)).toBe(before);
  });
});

describe('buildStaticSiteArchive — text asset content', () => {
  it('stores raw text from the host (e.g. SVG markup) as the file, like .stora export', async () => {
    const d = createBlankDocument('Svg');
    d.document.children = [
      { id: 'i', type: 'image', props: { src: { type: 'asset', assetId: 'logo', filename: 'logo.svg', mimeType: 'image/svg+xml' } }, styles: {}, children: [] },
    ];
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const result = await buildStaticSiteArchive(d, { assets: { logo: svg } });
    expect(strFromU8(unzipSync(result.archive)['assets/logo.svg'])).toBe(svg);
    expect(strFromU8(unzipSync(result.archive)['index.html'])).toContain('src="assets/logo.svg"');
  });
});
