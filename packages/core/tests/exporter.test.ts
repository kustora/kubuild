import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { PageDocument, SCHEMA_NAME } from '@kubuild/schema';
import {

  exportPackage,
  exportStoraPackage,
  sha256Sync,
  calculateChecksum,
  sanitizeFilename,
} from '../src/io/exporter';
import { createBlankDocument } from '../src/document/document-utils';
import { ComponentRegistryLike } from '../src/validation/validator';

describe('STORA-061: Portable Package Exporter (.stora)', () => {
  const samplePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  const sampleSvgBytes = new TextEncoder().encode('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');

  describe('Acceptance Criteria 1: Valid archive contains mandatory files and local assets', () => {
    it('creates a valid .stora archive with manifest.json, page.json, and metadata.json for a blank document', async () => {
      const doc = createBlankDocument('Test Blank Page');
      const result = await exportPackage(doc);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.archive).toBeInstanceOf(Uint8Array);
      expect(result.archive.byteLength).toBeGreaterThan(0);
      expect(result.manifest.schema).toBe(SCHEMA_NAME);
      expect(result.manifest.packageVersion).toBe('1.0.0');
      expect(result.assetCount).toBe(0);

      // Unzip and verify contents
      const unzipped = unzipSync(result.archive);
      expect(unzipped['manifest.json']).toBeDefined();
      expect(unzipped['page.json']).toBeDefined();
      expect(unzipped['metadata.json']).toBeDefined();

      const manifestContent = JSON.parse(strFromU8(unzipped['manifest.json']));
      expect(manifestContent.schema).toBe(SCHEMA_NAME);
      expect(manifestContent.assets).toEqual([]);

      const pageContent = JSON.parse(strFromU8(unzipped['page.json']));
      expect(pageContent.document.id).toBe('root-page');

      const metadataContent = JSON.parse(strFromU8(unzipped['metadata.json']));
      expect(metadataContent.title).toBe('Test Blank Page');
    });

    it('packages local assets into assets/ directory in archive', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        metadata: {
          title: 'Page with Assets',
          description: 'Testing local asset packaging',
          author: 'Tester',
          tags: ['test'],
          category: 'landing',
          version: '1.0.0',
        },
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'hero-section',
              type: 'section',
              children: [
                {
                  id: 'hero-img',
                  type: 'image',
                  props: {
                    src: {
                      type: 'asset',
                      assetId: 'hero_banner',
                      filename: 'banner.png',
                      mimeType: 'image/png',
                    },
                    alt: 'Hero banner',
                  },
                },
                {
                  id: 'logo-img',
                  type: 'image',
                  props: {
                    src: {
                      type: 'asset',
                      assetId: 'company_logo',
                      filename: 'logo.svg',
                      mimeType: 'image/svg+xml',
                    },
                    alt: 'Logo',
                  },
                },
              ],
            },
          ],
        },
      };

      const result = await exportStoraPackage(doc, {
        assets: {
          hero_banner: samplePngBytes,
          company_logo: sampleSvgBytes,
        },
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.assetCount).toBe(2);

      const unzipped = unzipSync(result.archive);
      expect(unzipped['assets/banner.png']).toBeDefined();
      expect(unzipped['assets/logo.svg']).toBeDefined();

      expect(unzipped['assets/banner.png']).toEqual(samplePngBytes);
      expect(unzipped['assets/logo.svg']).toEqual(sampleSvgBytes);
    });
  });

  describe('Acceptance Criteria 2: Manifest asset inventory matches archive and checksums', () => {
    it('manifest asset items match file path, size, and SHA-256 checksum', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'test-img',
              type: 'image',
              props: {
                source: {
                  type: 'asset',
                  assetId: 'img_123',
                  filename: 'test.png',
                  mimeType: 'image/png',
                },
              },
            },
          ],
        },
      };

      const expectedChecksum = await calculateChecksum(samplePngBytes);

      const result = await exportPackage(doc, {
        assets: {
          img_123: {
            data: samplePngBytes,
            filename: 'custom_test.png',
            mimeType: 'image/png',
          },
        },
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.manifest.assets.length).toBe(1);
      const manifestItem = result.manifest.assets[0];

      expect(manifestItem.id).toBe('img_123');
      expect(manifestItem.path).toBe('assets/custom_test.png');
      expect(manifestItem.mimeType).toBe('image/png');
      expect(manifestItem.size).toBe(samplePngBytes.byteLength);
      expect(manifestItem.checksum).toBe(expectedChecksum);

      // Verify unzipped archive entry matches
      const unzipped = unzipSync(result.archive);
      const extractedBytes = unzipped['assets/custom_test.png'];
      expect(extractedBytes).toBeDefined();
      expect(extractedBytes.byteLength).toBe(manifestItem.size);

      const extractedChecksum = await calculateChecksum(extractedBytes);
      expect(extractedChecksum).toBe(manifestItem.checksum);
    });

    it('collects assets dynamically via getAssetBytes function', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'node-img',
              type: 'image',
              props: {
                asset: {
                  type: 'asset',
                  assetId: 'async_asset_1',
                  filename: 'async.png',
                },
              },
            },
          ],
        },
      };

      const result = await exportPackage(doc, {
        getAssetBytes: async (assetId) => {
          if (assetId === 'async_asset_1') {
            return samplePngBytes;
          }
          return null;
        },
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.manifest.assets.length).toBe(1);
      expect(result.manifest.assets[0].id).toBe('async_asset_1');
    });
  });

  describe('Acceptance Criteria 3: Export fails with diagnostic when document invalid or required asset missing', () => {
    it('fails export when document is invalid with structured validation errors', async () => {
      const invalidDoc = {
        schema: 'invalid.schema',
        version: '1.0.0',
        document: {
          id: 'root',
          type: 'container', // Invalid: root must be 'page'
        },
      };

      const result = await exportPackage(invalidDoc);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.diagnosticMessage).toContain('Document validation failed');
    });

    it('fails export when document has duplicate node IDs', async () => {
      const docWithDuplicateIds: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            { id: 'dup-id', type: 'section' },
            { id: 'dup-id', type: 'section' },
          ],
        },
      };

      const result = await exportPackage(docWithDuplicateIds);
      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.errors.some((e) => e.code === 'DUPLICATE_NODE_ID')).toBe(true);
    });

    it('fails export when a required local asset cannot be collected and has no external fallback', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'img-1',
              type: 'image',
              props: {
                src: {
                  type: 'asset',
                  assetId: 'missing_asset_123',
                  filename: 'missing.png',
                },
              },
            },
          ],
        },
      };

      const result = await exportPackage(doc, {
        assets: {}, // Empty assets provided
      });

      expect(result.success).toBe(false);
      if (result.success) return;

      expect(result.errors.some((e) => e.code === 'INVALID_ASSET_REFERENCE')).toBe(true);
      expect(result.diagnosticMessage).toContain('missing_asset_123');
    });

    it('allows external asset fallback when fallbackUrl is present', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'img-external',
              type: 'image',
              props: {
                src: {
                  type: 'asset',
                  assetId: 'external_asset_1',
                  filename: 'external.png',
                  fallbackUrl: 'https://example.com/external.png',
                },
              },
            },
          ],
        },
      };

      const result = await exportPackage(doc);
      expect(result.success).toBe(true);
      if (!result.success) return;

      // External asset is not packaged in archive assets, but export succeeds
      expect(result.assetCount).toBe(0);
    });
  });

  describe('Requirements Extraction & Manifest Specification (STORA-060)', () => {
    it('extracts custom components and required capabilities from registry', async () => {
      const mockRegistry: ComponentRegistryLike = {
        get(type: string) {
          if (type === 'custom.product-card') {
            return {
              type: 'custom.product-card',
              category: 'custom',
              capabilities: ['ecommerce', 'cart-action'],
            };
          }
          if (type === 'section' || type === 'page') {
            return {
              type,
              category: 'layout',
              capabilities: [],
            };
          }
          return undefined;
        },
        has(type: string) {
          return type === 'custom.product-card' || type === 'section' || type === 'page';
        },
      };

      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'card-1',
              type: 'custom.product-card',
              props: { name: 'Super Widget' },
            },
          ],
        },
      };

      const result = await exportPackage(doc, {
        componentRegistry: mockRegistry,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.manifest.requiredComponents).toContain('custom.product-card');
      expect(result.manifest.requiredCapabilities).toContain('ecommerce');
      expect(result.manifest.requiredCapabilities).toContain('cart-action');
    });
  });

  describe('Security and Path Traversal Sanitization', () => {
    it('sanitizes dangerous filenames against zip-slip / directory traversal', () => {
      expect(sanitizeFilename('../../etc/passwd', 'asset1', 'image/png')).toBe('etc_passwd');
      expect(sanitizeFilename('..\\..\\windows\\system32', 'asset2')).toBe('windows_system32');
      expect(sanitizeFilename('', 'asset3', 'image/jpeg')).toBe('asset3.jpg');
      expect(sanitizeFilename('../../../', 'asset4', 'image/png')).toBe('asset4.png');
    });

    it('computes deterministic pure TypeScript SHA-256 matching crypto', async () => {
      const data = new TextEncoder().encode('Hello KUBUILD Portable Package');
      const syncHash = `sha256:${sha256Sync(data)}`;
      const asyncHash = await calculateChecksum(data);
      expect(syncHash).toBe(asyncHash);
    });
  });
});

describe('exportPackage — asset provider URLs are downloaded, never packaged as text', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7]);

  function docWithAsset(asset: Record<string, unknown>): PageDocument {
    return {
      schema: SCHEMA_NAME,
      version: '1.0.0',
      document: {
        id: 'root-page',
        type: 'page',
        children: [{ id: 'img', type: 'image', props: { asset: { type: 'asset', ...asset } } }],
      },
    } as PageDocument;
  }

  it('downloads the URL the provider resolves to and keeps its content type', async () => {
    const fetched: string[] = [];
    const result = await exportPackage(docWithAsset({ assetId: 'hero', filename: 'hero.png' }), {
      assetProvider: { resolve: (id) => `https://cdn.example.com/${id}` },
      fetchAsset: async (url) => {
        fetched.push(url);
        return { data: PNG, mimeType: 'image/png' };
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(fetched).toEqual(['https://cdn.example.com/hero']);
    expect(result.manifest.assets).toEqual([
      expect.objectContaining({ id: 'hero', path: 'assets/hero.png', mimeType: 'image/png', size: PNG.byteLength }),
    ]);
    expect(unzipSync(result.archive)['assets/hero.png']).toEqual(PNG);
  });

  it('treats a failed download as uncollected instead of storing the URL text', async () => {
    const options = {
      assetProvider: { resolve: () => 'https://cdn.example.com/gone.png' },
      fetchAsset: async () => null,
    };
    const strict = await exportPackage(docWithAsset({ assetId: 'gone' }), options);
    expect(strict.success).toBe(false);
    if (!strict.success) expect(strict.errors[0].code).toBe('INVALID_ASSET_REFERENCE');

    const lenient = await exportPackage(docWithAsset({ assetId: 'gone' }), { ...options, allowExternalFallback: true });
    expect(lenient.success).toBe(true);
    if (lenient.success) expect(lenient.manifest.assets).toEqual([]);
  });

  it('never packages a non-URL provider result as file content', async () => {
    const result = await exportPackage(docWithAsset({ assetId: 'x' }), {
      assetProvider: { resolve: () => 'asset://x' },
      allowExternalFallback: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.manifest.assets).toEqual([]);
  });

  it('decodes percent-encoded data URLs and still accepts raw text content from the host', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const fromDataUrl = await exportPackage(docWithAsset({ assetId: 'icon', filename: 'icon.svg' }), {
      getAssetBytes: () => `data:image/svg+xml,${encodeURIComponent(svg)}`,
    });
    expect(fromDataUrl.success).toBe(true);
    if (fromDataUrl.success) {
      expect(strFromU8(unzipSync(fromDataUrl.archive)['assets/icon.svg'])).toBe(svg);
      expect(fromDataUrl.manifest.assets[0].mimeType).toBe('image/svg+xml');
    }

    const fromText = await exportPackage(docWithAsset({ assetId: 'icon', filename: 'icon.svg', mimeType: 'image/svg+xml' }), {
      assets: { icon: svg },
    });
    expect(fromText.success).toBe(true);
    if (fromText.success) expect(strFromU8(unzipSync(fromText.archive)['assets/icon.svg'])).toBe(svg);
  });
});
