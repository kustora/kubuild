import { describe, it, expect } from 'vitest';
import {
  PageDocument,
  VariableBinding,
  ActionBinding,
  AssetReference,
} from '@kubuild/schema';
import { createBlankDocument } from './document-utils';
import { exportPackage } from './exporter';
import { importPackage, preflightPackage } from './importer';
import {
  compareDocumentsSemantically,
  compareManifestsSemantically,
} from './round-trip-comparator';
import type { AssetProvider, AssetInfo } from './interfaces';

class InMemoryAssetProvider implements AssetProvider {
  private assets = new Map<string, { buffer: Uint8Array; info: AssetInfo }>();

  async upload(file: File | Blob, metadata?: Record<string, unknown>): Promise<AssetInfo> {
    const assetId = (metadata?.assetId as string) || `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const buffer =
      file instanceof Uint8Array
        ? file
        : file instanceof ArrayBuffer
        ? new Uint8Array(file)
        : new Uint8Array(await (file as Blob).arrayBuffer());

    const info: AssetInfo = {
      id: assetId,
      url: `https://cdn.example.com/assets/${assetId}`,
      mimeType: file.type || 'application/octet-stream',
      size: buffer.byteLength,
    };
    this.assets.set(assetId, { buffer, info });
    return info;
  }

  resolve(assetIdOrUri: string): string {
    return this.assets.get(assetIdOrUri)?.info.url ?? `https://cdn.example.com/assets/${assetIdOrUri}`;
  }

  async delete(assetId: string): Promise<boolean> {
    return this.assets.delete(assetId);
  }

  async list(): Promise<AssetInfo[]> {
    return Array.from(this.assets.values()).map((a) => a.info);
  }

  getAssetBytes(assetId: string): Uint8Array | undefined {
    return this.assets.get(assetId)?.buffer;
  }

  setAsset(assetId: string, buffer: Uint8Array, mimeType: string): void {
    this.assets.set(assetId, {
      buffer,
      info: {
        id: assetId,
        url: `https://cdn.example.com/assets/${assetId}`,
        mimeType,
        size: buffer.byteLength,
      },
    });
  }
}

const mockRegistry = {
  has: (type: string) =>
    ['page', 'section', 'container', 'columns', 'heading', 'text', 'image', 'button', 'collection', 'card', 'custom-widget'].includes(type),
  get: (type: string) => {
    if (!mockRegistry.has(type)) return undefined;
    const category = ['custom-widget', 'card'].includes(type)
      ? 'custom'
      : ['page', 'section', 'container', 'columns'].includes(type)
      ? 'layout'
      : 'content';
    const capabilities = type === 'image' ? ['assetProvider'] : type === 'collection' ? ['dataProvider'] : [];
    const acceptsChildren = ['page', 'section', 'container', 'columns', 'collection', 'card'].includes(type);
    return {
      type,
      label: type,
      category,
      capabilities,
      acceptsChildren,
    };
  },
  list: () => [],
};

describe('Round-Trip Compatibility Suite (STORA-064)', () => {
  describe('1. Starter Page Round-Trip', () => {
    function createStarterPageFixture(): PageDocument {
      const doc = createBlankDocument('Starter Landing Page');
      doc.metadata = {
        title: 'Starter Landing Page',
        description: 'A clean, modern landing page starter template',
        author: 'Kustora Team',
        tags: ['landing', 'starter', 'marketing'],
        category: 'marketing',
        version: '1.0.0',
      };
      doc.document = {
        id: 'root-page',
        type: 'page',
        props: { title: 'Starter Landing Page' },
        styles: {
          base: { minHeight: '100vh', backgroundColor: '#f8fafc' },
        },
        children: [
          {
            id: 'hero-section',
            type: 'section',
            props: {},
            styles: {
              base: { paddingTop: '64px', paddingBottom: '64px', paddingLeft: '24px', paddingRight: '24px' },
              tablet: { paddingTop: '48px', paddingBottom: '48px' },
              mobile: { paddingTop: '32px', paddingBottom: '32px' },
            },
            children: [
              {
                id: 'hero-container',
                type: 'container',
                props: { maxWidth: '1200px' },
                styles: {
                  base: { maxWidth: '1200px', margin: '0 auto', width: '100%' },
                },
                children: [
                  {
                    id: 'hero-title',
                    type: 'heading',
                    props: { text: 'Build Fast with Kustora', level: 1 },
                    styles: {
                      base: { fontSize: '48px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' },
                      mobile: { fontSize: '32px' },
                    },
                  },
                  {
                    id: 'hero-description',
                    type: 'text',
                    props: { content: 'Next generation web page builder designed for high fidelity design and speed.' },
                    styles: {
                      base: { fontSize: '18px', color: '#475569', lineHeight: '1.6', marginBottom: '24px' },
                    },
                  },
                  {
                    id: 'cta-button',
                    type: 'button',
                    props: {
                      label: 'Get Started Today',
                      href: '/signup',
                      disabled: false,
                    },
                    styles: {
                      base: {
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        paddingTop: '12px',
                        paddingBottom: '12px',
                        paddingLeft: '24px',
                        paddingRight: '24px',
                        borderRadius: '8px',
                        fontWeight: '600',
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      };
      return doc;
    }

    it('exports and re-imports starter page with exact semantic equivalence', async () => {
      const original = createStarterPageFixture();

      // Export
      const exportResult = await exportPackage(original, {
        componentRegistry: mockRegistry,
      });
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      expect(exportResult.archive).toBeInstanceOf(Uint8Array);

      // Import
      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: mockRegistry,
      });

      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      expect(importResult.document).toBeDefined();

      // Semantic Comparator check
      const comp = compareDocumentsSemantically(original, importResult.document);
      expect(comp.equivalent).toBe(true);
      expect(comp.differences).toHaveLength(0);

      // Manifest Comparator check
      const manifestComp = compareManifestsSemantically(exportResult.manifest, importResult.manifest);
      expect(manifestComp.equivalent).toBe(true);
      expect(manifestComp.differences).toHaveLength(0);
    });
  });

  describe('2. Collection, Action & Dynamic Variable Bindings Round-Trip', () => {
    function createComplexPageFixture(): PageDocument {
      const doc = createBlankDocument('E-Commerce Product Showcase');
      doc.metadata = {
        title: 'E-Commerce Product Showcase',
        description: 'Dynamic products catalog with filter actions and variable bindings',
        author: 'Store Admin',
        tags: ['ecommerce', 'catalog', 'dynamic'],
        category: 'ecommerce',
        version: '1.2.0',
      };

      const titleBinding: VariableBinding = {
        type: 'variable',
        key: 'site.storeName',
        fallback: 'Official Store',
      };

      const categoryBinding: VariableBinding = {
        type: 'variable',
        key: 'currentCategory.label',
        fallback: 'All Products',
      };

      const navAction: ActionBinding = {
        type: 'NAVIGATE',
        payload: {
          path: '/cart',
          openInNewTab: false,
        },
      };

      const filterAction: ActionBinding = {
        type: 'APPLY_FILTER',
        payload: {
          category: 'electronics',
          inStockOnly: true,
        },
      };

      doc.document = {
        id: 'root-page',
        type: 'page',
        props: {},
        styles: { base: { backgroundColor: '#ffffff' } },
        children: [
          {
            id: 'catalog-section',
            type: 'section',
            props: {},
            styles: {
              base: { paddingTop: '40px', paddingBottom: '60px' },
            },
            children: [
              {
                id: 'catalog-header',
                type: 'heading',
                props: {
                  text: titleBinding,
                  level: 1,
                },
                styles: {
                  base: { fontSize: '36px', color: '#1e293b' },
                },
              },
              {
                id: 'category-subtitle',
                type: 'text',
                props: {
                  content: categoryBinding,
                },
                styles: {
                  base: { fontSize: '16px', color: '#64748b' },
                },
              },
              {
                id: 'filter-btn',
                type: 'button',
                props: {
                  label: 'Filter Electronics',
                  action: filterAction,
                },
                styles: {
                  base: { backgroundColor: '#e2e8f0', color: '#334155', borderRadius: '6px' },
                },
              },
              {
                id: 'products-grid',
                type: 'collection',
                props: {
                  source: 'products',
                  limit: 12,
                  orderBy: 'price_asc',
                },
                styles: {
                  base: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' },
                  tablet: { gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
                  mobile: { gridTemplateColumns: '1fr', gap: '12px' },
                },
                children: [
                  {
                    id: 'product-card',
                    type: 'card',
                    props: { title: 'Product 1' },
                    children: [
                      {
                        id: 'checkout-btn',
                        type: 'button',
                        props: {
                          label: 'View Cart',
                          action: navAction,
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      return doc;
    }

    it('preserves all nested bindings, action payloads, and responsive overrides after round-trip', async () => {
      const original = createComplexPageFixture();

      const exportResult = await exportPackage(original, {
        componentRegistry: mockRegistry,
      });
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      expect(exportResult.manifest.requiredComponents).toContain('card');
      expect(exportResult.manifest.requiredCapabilities).toContain('dataProvider');

      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: mockRegistry,
        supportedCapabilities: ['dataProvider'],
      });

      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      const comp = compareDocumentsSemantically(original, importResult.document);
      expect(comp.equivalent).toBe(true);
      expect(comp.differences).toHaveLength(0);

      // Verify specific deep elements in imported document
      const section = importResult.document.document.children![0];
      const headingNode = section.children![0];
      expect(headingNode.props?.text).toEqual({
        type: 'variable',
        key: 'site.storeName',
        fallback: 'Official Store',
      });

      const buttonNode = section.children![2];
      expect(buttonNode.props?.action).toEqual({
        type: 'APPLY_FILTER',
        payload: {
          category: 'electronics',
          inStockOnly: true,
        },
      });

      const collectionNode = section.children![3];
      expect(collectionNode.styles?.tablet?.gridTemplateColumns).toBe('repeat(2, 1fr)');
      expect(collectionNode.styles?.mobile?.gridTemplateColumns).toBe('1fr');
    });
  });

  describe('3. Asset References & Binary Integrity Round-Trip', () => {
    function createPageWithAssets(): { doc: PageDocument; asset1: Uint8Array; asset2: Uint8Array } {
      const doc = createBlankDocument('Page With Media');
      const asset1Data = new TextEncoder().encode('PNG_MOCK_BANNER_IMAGE_DATA_12345');
      const asset2Data = new TextEncoder().encode('SVG_MOCK_ICON_DATA_67890');

      const heroAssetRef: AssetReference = {
        type: 'asset',
        assetId: 'banner-hero-1',
        filename: 'banner-hero.png',
        mimeType: 'image/png',
        fallbackUrl: 'https://cdn.example.com/fallback.png',
      };

      const iconAssetRef: AssetReference = {
        type: 'asset',
        assetId: 'logo-icon-2',
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
      };

      doc.document = {
        id: 'root-page',
        type: 'page',
        props: {},
        children: [
          {
            id: 'hero-image',
            type: 'image',
            props: {
              asset: heroAssetRef,
              alt: 'Hero Banner',
              width: 1200,
              height: 600,
            },
            styles: {
              base: { maxWidth: '100%', height: 'auto', borderRadius: '12px' },
            },
          },
          {
            id: 'brand-logo',
            type: 'image',
            props: {
              asset: iconAssetRef,
              alt: 'Company Logo',
              width: 120,
              height: 40,
            },
          },
        ],
      };

      return { doc, asset1: asset1Data, asset2: asset2Data };
    }

    it('exports package with binaries and imports into host AssetProvider with exact binary fidelity', async () => {
      const { doc: original, asset1, asset2 } = createPageWithAssets();

      // Export with directly supplied assets
      const exportResult = await exportPackage(original, {
        componentRegistry: mockRegistry,
        assets: {
          'banner-hero-1': {
            data: asset1,
            mimeType: 'image/png',
            filename: 'banner-hero.png',
          },
          'logo-icon-2': {
            data: asset2,
            mimeType: 'image/svg+xml',
            filename: 'logo.svg',
          },
        },
      });
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      expect(exportResult.manifest.assets).toHaveLength(2);

      // Preflight check
      const preflight = await preflightPackage(exportResult.archive, {
        componentRegistry: mockRegistry,
        supportedCapabilities: ['assetProvider'],
      });
      expect(preflight.valid).toBe(true);
      expect(preflight.manifest?.assets).toHaveLength(2);

      // Import into host with an in-memory AssetProvider
      const hostProvider = new InMemoryAssetProvider();
      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: mockRegistry,
        supportedCapabilities: ['assetProvider'],
        assetProvider: hostProvider,
      });

      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      // Verify document semantic equivalence
      const comp = compareDocumentsSemantically(original, importResult.document);
      expect(comp.equivalent).toBe(true);
      expect(comp.differences).toHaveLength(0);

      // Verify binary data integrity in host asset provider
      const importedAssets = await hostProvider.list();
      expect(importedAssets.length).toBeGreaterThanOrEqual(2);

      const heroImportedBytes = hostProvider.getAssetBytes('banner-hero-1');
      expect(heroImportedBytes).toBeDefined();
      expect(new TextDecoder().decode(heroImportedBytes)).toBe('PNG_MOCK_BANNER_IMAGE_DATA_12345');

      const logoImportedBytes = hostProvider.getAssetBytes('logo-icon-2');
      expect(logoImportedBytes).toBeDefined();
      expect(new TextDecoder().decode(logoImportedBytes)).toBe('SVG_MOCK_ICON_DATA_67890');
    });

    it('supports host asset collision rename strategy and preserves semantic equivalence under assetIdMap', async () => {
      const { doc: original, asset1, asset2 } = createPageWithAssets();

      const exportResult = await exportPackage(original, {
        componentRegistry: mockRegistry,
        assets: {
          'banner-hero-1': { data: asset1, mimeType: 'image/png', filename: 'banner-hero.png' },
          'logo-icon-2': { data: asset2, mimeType: 'image/svg+xml', filename: 'logo.svg' },
        },
      });
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      // Host already has existing asset with same ID 'banner-hero-1'
      const hostProvider = new InMemoryAssetProvider();
      hostProvider.setAsset('banner-hero-1', new TextEncoder().encode('EXISTING_HOST_DATA'), 'image/png');

      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: mockRegistry,
        supportedCapabilities: ['assetProvider'],
        assetProvider: hostProvider,
        assetCollisionStrategy: 'rename',
      });

      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      expect(importResult.renamedAssets).toBeDefined();
      expect(importResult.renamedAssets!['banner-hero-1']).toMatch(/^banner-hero-1_/);

      // The comparator should recognize remapped asset IDs when provided in options.assetIdMap
      const compWithMap = compareDocumentsSemantically(original, importResult.document, {
        assetIdMap: importResult.renamedAssets,
      });
      expect(compWithMap.equivalent).toBe(true);
      expect(compWithMap.differences).toHaveLength(0);

      // But without the assetIdMap, the comparator strictly reports ASSET_MISMATCH
      const compWithoutMap = compareDocumentsSemantically(original, importResult.document);
      expect(compWithoutMap.equivalent).toBe(false);
      expect(compWithoutMap.differences.some((d) => d.kind === 'ASSET_MISMATCH')).toBe(true);
    });
  });

  describe('4. Strict Failure Verifications on Corrupted / Altered Data', () => {
    function getBaseDocument(): PageDocument {
      const doc = createBlankDocument('Test Base');
      doc.metadata = {
        ...doc.metadata,
        title: 'Base Title',
        description: 'Base Description',
        author: 'Author',
        tags: ['a', 'b'],
        category: 'general',
        version: '1.0.0',
      };
      doc.document = {
        id: 'root-page',
        type: 'page',
        props: {},
        children: [
          {
            id: 'node-1',
            type: 'heading',
            props: { text: 'Heading 1', level: 2 },
            styles: { base: { color: '#ff0000', fontSize: '24px' } },
          },
          {
            id: 'node-2',
            type: 'text',
            props: { content: 'Paragraph 2' },
            styles: { base: { color: '#000000' } },
          },
        ],
      };
      return doc;
    }

    it('fails when node order is swapped', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      // Swap children
      docB.document.children = [docA.document.children![1], docA.document.children![0]];

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'NODE_ORDER')).toBe(true);
    });

    it('fails when a node is missing or extra', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docB.document.children = [docA.document.children![0]]; // node-2 deleted

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'NODE_ORDER' || d.kind === 'NODE_MISSING')).toBe(true);
    });

    it('fails when node type is changed', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docB.document.children![0].type = 'button';

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'NODE_TYPE')).toBe(true);
    });

    it('fails when props are modified or dropped', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docB.document.children![0].props = { text: 'Different Text', level: 2 };

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'PROP_MISMATCH')).toBe(true);
    });

    it('fails when styles are altered in any breakpoint', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docB.document.children![0].styles = { base: { color: '#0000ff', fontSize: '24px' } };

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'STYLE_MISMATCH')).toBe(true);
    });

    it('fails when variable bindings are altered', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docA.document.children![0].props = { text: { type: 'variable', key: 'user.name', fallback: 'Guest' }, level: 2 };
      docB.document.children![0].props = { text: { type: 'variable', key: 'user.email', fallback: 'Guest' }, level: 2 };

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'BINDING_MISMATCH')).toBe(true);
    });

    it('fails when action bindings or payloads are altered', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docA.document.children![0].props = { action: { type: 'SUBMIT', payload: { id: 1 } }, level: 2 };
      docB.document.children![0].props = { action: { type: 'SUBMIT', payload: { id: 2 } }, level: 2 };

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'ACTION_MISMATCH')).toBe(true);
    });

    it('fails when asset reference is altered without mapping', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docA.document.children![0].props = { asset: { type: 'asset', assetId: 'img-1', filename: '1.jpg', mimeType: 'image/jpeg' }, level: 2 };
      docB.document.children![0].props = { asset: { type: 'asset', assetId: 'img-2', filename: '1.jpg', mimeType: 'image/jpeg' }, level: 2 };

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'ASSET_MISMATCH')).toBe(true);
    });

    it('fails when document metadata is altered', () => {
      const docA = getBaseDocument();
      const docB = getBaseDocument();
      docB.metadata!.title = 'Changed Title';

      const comp = compareDocumentsSemantically(docA, docB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'METADATA_MISMATCH')).toBe(true);
    });

    it('fails when manifest dependencies are mismatched', () => {
      const manifestA = {
        schema: 'stora.page' as const,
        schemaVersion: '1.0.0',
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: ['page', 'heading'],
        requiredCapabilities: ['assetProvider'],
        assets: [],
      };
      const manifestB = {
        ...manifestA,
        requiredComponents: ['page', 'heading', 'custom-plugin'],
      };

      const comp = compareManifestsSemantically(manifestA, manifestB);
      expect(comp.equivalent).toBe(false);
      expect(comp.differences.some((d) => d.kind === 'DEPENDENCY_MISMATCH')).toBe(true);
    });
  });
});
