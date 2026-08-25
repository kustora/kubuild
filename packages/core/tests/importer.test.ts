import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8, strFromU8 } from 'fflate';
import { PageDocument, SCHEMA_NAME, CURRENT_SCHEMA_VERSION, Manifest } from '@kubuild/schema';
import {
  exportPackage,
  sha256Sync,
  calculateChecksum,
} from '../src/exporter';
import {
  preflightPackage,
  inspectPackage,
  previewImportPackage,
  importPackage,
  importStoraPackage,
  isDangerousPath,
  defaultRenameAssetStrategy,
} from '../src/importer';
import {
  createBlankDocument,
  findMissingComponentNodes,
  remapAssetReferences,
} from '../src/document-utils';
import type { ComponentRegistryLike } from '../src/validator';
import type { AssetProvider, AssetInfo } from '../src/interfaces';


describe('STORA-062: Importer .stora dengan Preflight Validation', () => {
  const samplePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
  const sampleSvgBytes = new TextEncoder().encode('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');

  async function createValidPackageArchive(doc?: PageDocument, assets?: Record<string, Uint8Array>) {
    const pageDoc = doc || createBlankDocument('Test Import Page');
    const res = await exportPackage(pageDoc, {
      assets: assets || {},
    });
    if (!res.success) {
      throw new Error(`Failed to create fixture archive: ${res.diagnosticMessage}`);
    }
    return res;
  }

  describe('Acceptance Criteria 1: Rejection of invalid, corrupt, or dangerous archives', () => {
    it('rejects an empty archive (0 bytes)', async () => {
      const emptyArchive = new Uint8Array(0);
      const preflight = await preflightPackage(emptyArchive);

      expect(preflight.valid).toBe(false);
      expect(preflight.canImport).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'ARCHIVE_EMPTY')).toBe(true);

      const importRes = await importPackage(emptyArchive);
      expect(importRes.success).toBe(false);
      if (!importRes.success) {
        expect(importRes.errors.some((e) => e.code === 'ARCHIVE_EMPTY')).toBe(true);
      }
    });

    it('rejects a corrupted zip archive', async () => {
      const corruptBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0xff, 0xff]);
      const preflight = await preflightPackage(corruptBytes);

      expect(preflight.valid).toBe(false);
      expect(preflight.canImport).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'ARCHIVE_CORRUPT')).toBe(true);
    });

    it('rejects an archive missing manifest.json', async () => {
      const archiveFiles = {
        'page.json': strToU8(JSON.stringify(createBlankDocument())),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.canImport).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'MISSING_MANIFEST')).toBe(true);
    });

    it('rejects an archive missing page.json', async () => {
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [],
      };
      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.canImport).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'MISSING_PAGE_DOCUMENT')).toBe(true);
    });

    it('rejects Zip-Slip directory traversal attempts', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [
          {
            id: 'malicious',
            path: '../../etc/passwd',
            mimeType: 'text/plain',
            size: 11,
          },
        ],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
        '../../etc/passwd': strToU8('evil_payload'),
      };
      const archive = zipSync(archiveFiles);

      expect(isDangerousPath('../../etc/passwd')).toBe(true);
      expect(isDangerousPath('/etc/shadow')).toBe(true);
      expect(isDangerousPath('assets/../secret.txt')).toBe(true);
      expect(isDangerousPath('assets/safe.png')).toBe(false);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.canImport).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'ZIP_SLIP_DETECTED')).toBe(true);

      const importRes = await importPackage(archive);
      expect(importRes.success).toBe(false);
    });

    it('rejects archives exceeding size limits', async () => {
      const doc = createBlankDocument();
      const fixture = await createValidPackageArchive(doc);

      // Test small limit
      const preflight = await preflightPackage(fixture.archive, {
        securityLimits: {
          maxArchiveSize: 10, // 10 bytes limit
        },
      });

      expect(preflight.valid).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'SIZE_LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects archives with asset checksum mismatch', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [
          {
            id: 'tampered_asset',
            path: 'assets/image.png',
            mimeType: 'image/png',
            size: samplePngBytes.byteLength,
            checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', // Invalid checksum
          },
        ],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
        'assets/image.png': samplePngBytes,
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'ASSET_CHECKSUM_MISMATCH')).toBe(true);

      const importRes = await importPackage(archive);
      expect(importRes.success).toBe(false);
    });

    it('rejects archives with missing declared asset files', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [
          {
            id: 'missing_asset',
            path: 'assets/non_existent.png',
            mimeType: 'image/png',
            size: 100,
          },
        ],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'ASSET_FILE_MISSING')).toBe(true);
    });
  });

  describe('Acceptance Criteria 2: Preflight reports missing components/capabilities before host mutation', () => {
    it('detects missing custom components and reports them in preflight', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: ['custom.pricing-table', 'custom.countdown-timer'],
        requiredCapabilities: ['web-share'],
        assets: [],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive, {
        supportedCapabilities: ['web-share'],
        // No custom components registered
      });

      expect(preflight.valid).toBe(false);
      expect(preflight.missingComponents).toEqual(['custom.pricing-table', 'custom.countdown-timer']);
      expect(preflight.missingCapabilities).toEqual([]);
      expect(preflight.diagnostics.some((d) => d.code === 'MISSING_COMPONENTS')).toBe(true);

      // Verify import aborts without touching host
      const hostHook = vi.fn();
      const importRes = await importPackage(archive, {
        onAssetImport: hostHook,
      });

      expect(importRes.success).toBe(false);
      expect(hostHook).not.toHaveBeenCalled();
    });

    it('detects missing capabilities and reports them in preflight', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: ['advanced-analytics', 'payment-gateway'],
        assets: [],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive, {
        supportedCapabilities: ['advanced-analytics'], // missing payment-gateway
      });

      expect(preflight.valid).toBe(false);
      expect(preflight.missingCapabilities).toEqual(['payment-gateway']);
      expect(preflight.diagnostics.some((d) => d.code === 'MISSING_CAPABILITIES')).toBe(true);
    });

    it('passes preflight when all required components and capabilities are supported', async () => {
      const doc = createBlankDocument();
      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        packageVersion: '1.0.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: ['custom.product-card'],
        requiredCapabilities: ['audio-player'],
        assets: [],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(doc)),
      };
      const archive = zipSync(archiveFiles);

      const mockRegistry: ComponentRegistryLike = {
        has: (t) => t === 'custom.product-card',
        get: () => ({ type: 'custom.product-card' }),
      };

      const preflight = await preflightPackage(archive, {
        componentRegistry: mockRegistry,
        supportedCapabilities: ['audio-player'],
      });

      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.missingComponents).toEqual([]);
      expect(preflight.missingCapabilities).toEqual([]);
    });
  });

  describe('Acceptance Criteria 3: Legacy document migration during import', () => {
    it('detects legacy 0.1.0 schema version and migrates to 1.0.0', async () => {
      const legacyDoc = {
        schema: 'stora.page',
        version: '0.1.0',
        root: {
          id: 'root-page',
          type: 'page',
          styles: { backgroundColor: '#f0f0f0' }, // Flat styles in 0.1.0
          children: [
            {
              id: 'sec-1',
              type: 'section',
              styles: { padding: '20px' },
              children: [],
            },
          ],
        },
      };

      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: '0.1.0',
        packageVersion: '0.1.0',
        builderCompatibility: '>=0.1.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(legacyDoc)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.requiresMigration).toBe(true);
      expect(preflight.migrationPath).toEqual(['0.1.0', '1.0.0']);

      // Import should successfully migrate the document
      const importRes = await importPackage(archive);
      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      expect(importRes.document.version).toBe('1.0.0');
      expect(importRes.document.document.id).toBe('root-page');
      // Verify styles were migrated to responsive base
      expect(importRes.document.document.styles?.base?.backgroundColor).toBe('#f0f0f0');
    });

    it('rejects import if schema version is unsupported with no migration path', async () => {
      const unsupportedDoc = {
        schema: 'stora.page',
        version: '99.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [],
        },
      };

      const manifest: Manifest = {
        schema: SCHEMA_NAME,
        schemaVersion: '99.0.0',
        packageVersion: '99.0.0',
        builderCompatibility: '>=99.0.0',
        requiredComponents: [],
        requiredCapabilities: [],
        assets: [],
      };

      const archiveFiles = {
        'manifest.json': strToU8(JSON.stringify(manifest)),
        'page.json': strToU8(JSON.stringify(unsupportedDoc)),
      };
      const archive = zipSync(archiveFiles);

      const preflight = await preflightPackage(archive);
      expect(preflight.valid).toBe(false);
      expect(preflight.diagnostics.some((d) => d.code === 'NO_MIGRATION_PATH')).toBe(true);

      const importRes = await importPackage(archive);
      expect(importRes.success).toBe(false);
    });
  });

  describe('Round-trip Export -> Inspect -> Import with Asset Extraction', () => {
    it('successfully imports a complete package and extracts local assets', async () => {
      const doc: PageDocument = {
        schema: SCHEMA_NAME,
        version: CURRENT_SCHEMA_VERSION,
        metadata: {
          title: 'Roundtrip Test Page',
          description: 'Testing full lifecycle roundtrip',
          author: 'KUBUILD Builder',
          tags: ['roundtrip', 'portable'],
          category: 'marketing',
          version: '1.0.0',
        },
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'hero-sec',
              type: 'section',
              children: [
                {
                  id: 'hero-img',
                  type: 'image',
                  props: {
                    src: {
                      type: 'asset',
                      assetId: 'banner_asset',
                      filename: 'banner.png',
                      mimeType: 'image/png',
                    },
                  },
                },
                {
                  id: 'logo-img',
                  type: 'image',
                  props: {
                    src: {
                      type: 'asset',
                      assetId: 'logo_asset',
                      filename: 'logo.svg',
                      mimeType: 'image/svg+xml',
                    },
                  },
                },
              ],
            },
          ],
        },
      };

      const exportRes = await exportPackage(doc, {
        assets: {
          banner_asset: samplePngBytes,
          logo_asset: sampleSvgBytes,
        },
      });

      expect(exportRes.success).toBe(true);
      if (!exportRes.success) return;

      // 1. Inspect package
      const preflight = await inspectPackage(exportRes.archive);
      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.assetCount).toBe(2);
      expect(preflight.rawMetadata?.title).toBe('Roundtrip Test Page');

      // 2. Import with AssetProvider
      const uploadedAssets: Record<string, { name: string; size: number }> = {};
      const mockAssetProvider: AssetProvider = {
        resolve: (id) => `https://cdn.example.com/${id}`,
        upload: async (file, meta) => {
          const fileName = file instanceof File ? file.name : (meta?.filename as string) || 'asset';
          const assetId = (meta?.assetId as string) || fileName;
          uploadedAssets[assetId] = { name: fileName, size: file.size };
          return {
            id: assetId,
            url: `https://cdn.example.com/${fileName}`,
            mimeType: file.type,
            size: file.size,
          };
        },
      };

      const importRes = await importStoraPackage(exportRes.archive, {
        assetProvider: mockAssetProvider,
      });

      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      // Verify Document integrity
      expect(importRes.document.metadata?.title).toBe('Roundtrip Test Page');
      expect(importRes.document.document.children?.[0]?.id).toBe('hero-sec');

      // Verify Extracted Assets
      expect(importRes.extractedAssets.size).toBe(2);
      expect(importRes.extractedAssets.has('banner_asset')).toBe(true);
      expect(importRes.extractedAssets.has('logo_asset')).toBe(true);

      const bannerExtracted = importRes.extractedAssets.get('banner_asset')!;
      expect(bannerExtracted.bytes).toEqual(samplePngBytes);
      expect(bannerExtracted.meta.mimeType).toBe('image/png');

      // Verify Host Adapter upload received files
      expect(uploadedAssets['banner_asset']).toBeDefined();
      expect(uploadedAssets['banner_asset'].size).toBe(samplePngBytes.byteLength);
      expect(uploadedAssets['logo_asset']).toBeDefined();
      expect(uploadedAssets['logo_asset'].size).toBe(sampleSvgBytes.byteLength);
    });
  });
});

describe('STORA-063: Import Policy untuk Dependency dan Conflict Asset', () => {
  const sampleImgBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

  function createPackageWithCustomNodeAndAsset(options: {
    componentType?: string;
    capability?: string;
    assetId?: string;
  }) {
    const compType = options.componentType || 'custom.product-card';
    const assetId = options.assetId || 'brand_logo';
    const capability = options.capability || 'payment-gateway';

    const doc: PageDocument = {
      schema: SCHEMA_NAME,
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        title: 'Custom Product Page',
        description: 'Page with custom components and assets',
        author: 'Tester',
        tags: ['custom', 'ecommerce'],
        category: 'ecommerce',
        version: '1.0.0',
      },
      document: {
        id: 'root-page',
        type: 'page',
        children: [
          {
            id: 'sec-custom',
            type: 'section',
            children: [
              {
                id: 'custom-prod-1',
                type: compType,
                props: {
                  sku: 'PROD-999',
                  price: 199.99,
                  currency: 'USD',
                  details: {
                    featured: true,
                    rating: 4.8,
                  },
                  thumbnail: {
                    type: 'asset',
                    assetId,
                    filename: 'logo.png',
                    mimeType: 'image/png',
                  },
                },
                styles: {
                  base: {
                    padding: '16px',
                    borderRadius: '8px',
                  },
                },
                children: [
                  {
                    id: 'nested-text',
                    type: 'text',
                    props: { content: 'Limited Edition' },
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const manifest: Manifest = {
      schema: SCHEMA_NAME,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      packageVersion: '1.0.0',
      builderCompatibility: '>=0.1.0',
      requiredComponents: [compType],
      requiredCapabilities: [capability],
      assets: [
        {
          id: assetId,
          path: `assets/${assetId}.png`,
          mimeType: 'image/png',
          size: sampleImgBytes.byteLength,
        },
      ],
    };

    const archiveFiles: Record<string, Uint8Array> = {
      'manifest.json': strToU8(JSON.stringify(manifest)),
      'page.json': strToU8(JSON.stringify(doc)),
      [`assets/${assetId}.png`]: sampleImgBytes,
    };

    return {
      doc,
      manifest,
      archive: zipSync(archiveFiles),
    };
  }

  describe('Acceptance Criteria 1: Import preview menampilkan missing dependency dengan key spesifik', () => {
    it('preflight / preview lists missing custom components and capabilities with exact keys', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.pricing-table',
        capability: 'advanced-analytics',
      });

      const preview = await previewImportPackage(fixture.archive, {
        dependencyPolicy: 'cancel',
        supportedCapabilities: [], // none supported
      });

      expect(preview.valid).toBe(false);
      expect(preview.canImport).toBe(false);
      expect(preview.missingComponents).toEqual(['custom.pricing-table']);
      expect(preview.missingCapabilities).toEqual(['advanced-analytics']);

      const compDiag = preview.diagnostics.find((d) => d.code === 'MISSING_COMPONENTS');
      expect(compDiag).toBeDefined();
      expect(compDiag?.severity).toBe('error');
      expect(compDiag?.details?.missingComponents).toEqual(['custom.pricing-table']);

      const capDiag = preview.diagnostics.find((d) => d.code === 'MISSING_CAPABILITIES');
      expect(capDiag).toBeDefined();
      expect(capDiag?.severity).toBe('error');
      expect(capDiag?.details?.missingCapabilities).toEqual(['advanced-analytics']);
    });

    it('preview displays detected asset conflicts with exact asset IDs', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'hero_banner',
      });

      const preview = await previewImportPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: ['hero_banner', 'existing_avatar'],
      });

      expect(preview.assetConflicts.length).toBe(1);
      expect(preview.assetConflicts[0].assetId).toBe('hero_banner');
      expect(preview.assetConflicts[0].path).toBe('assets/hero_banner.png');
      expect(preview.canImport).toBe(false); // Default strategy is reject

      const conflictDiag = preview.diagnostics.find((d) => d.code === 'ASSET_CONFLICT');
      expect(conflictDiag).toBeDefined();
      expect(conflictDiag?.severity).toBe('error');
      expect(conflictDiag?.message).toContain('hero_banner');
    });
  });

  describe('Acceptance Criteria 2: Mode placeholder mempertahankan node dan props asli', () => {
    it('import-with-placeholder succeeds and preserves original nodes, types, styles, and props completely', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.unregistered-widget',
        capability: 'unknown-capability',
        assetId: 'widget_icon',
      });

      // 1. Preview with placeholder policy
      const preview = await preflightPackage(fixture.archive, {
        dependencyPolicy: 'import-with-placeholder',
      });

      expect(preview.canImport).toBe(true);
      expect(preview.dependencyPolicy).toBe('import-with-placeholder');
      expect(preview.missingComponents).toEqual(['custom.unregistered-widget']);
      expect(preview.missingCapabilities).toEqual(['unknown-capability']);

      // Diagnostics should be non-blocking warnings
      const compDiag = preview.diagnostics.find((d) => d.code === 'MISSING_COMPONENTS');
      expect(compDiag?.severity).toBe('warning');

      // 2. Perform import
      const importRes = await importPackage(fixture.archive, {
        dependencyPolicy: 'import-with-placeholder',
      });

      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      // 3. Verify node and props preservation
      const root = importRes.document.document;
      const sectionNode = root.children?.[0];
      const customNode = sectionNode?.children?.[0];

      expect(customNode).toBeDefined();
      expect(customNode?.id).toBe('custom-prod-1');
      expect(customNode?.type).toBe('custom.unregistered-widget');
      expect(customNode?.props?.sku).toBe('PROD-999');
      expect(customNode?.props?.price).toBe(199.99);
      expect(customNode?.props?.currency).toBe('USD');
      expect(customNode?.props?.details).toEqual({ featured: true, rating: 4.8 });
      expect(customNode?.styles?.base?.padding).toBe('16px');
      expect(customNode?.children?.[0]?.props?.content).toBe('Limited Edition');

      // 4. Verify findMissingComponentNodes helper
      const missingNodes = findMissingComponentNodes(root);
      expect(missingNodes.length).toBe(1);
      expect(missingNodes[0].nodeId).toBe('custom-prod-1');
      expect(missingNodes[0].componentType).toBe('custom.unregistered-widget');
      expect(missingNodes[0].props.sku).toBe('PROD-999');
    });

    it('rejects import when dependencyPolicy is "cancel" (default strict mode)', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.mandatory-form',
      });

      const importRes = await importPackage(fixture.archive, {
        dependencyPolicy: 'cancel',
      });

      expect(importRes.success).toBe(false);
      if (!importRes.success) {
        expect(importRes.errors.some((e) => e.code === 'MISSING_COMPONENTS')).toBe(true);
      }
    });
  });

  describe('Acceptance Criteria 3: Policy install-or-register-before-import', () => {
    it('invokes onMissingDependency hook to register missing components/capabilities before finalizing import', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.video-player',
        capability: 'hls-stream',
      });

      const standardTypes = new Set(['page', 'section', 'container', 'columns', 'heading', 'text', 'image', 'button', 'collection']);
      const registeredTypes = new Set<string>();
      const registeredCaps = new Set<string>();

      const mockRegistry: ComponentRegistryLike = {
        has: vi.fn((t) => standardTypes.has(t) || registeredTypes.has(t)),
        get: vi.fn((t) => {
          if (registeredTypes.has(t)) return { type: t, category: 'custom' };
          if (standardTypes.has(t)) return { type: t, category: 'core' };
          return undefined;
        }),
      };

      const onMissingDependency = vi.fn(async (missing) => {
        expect(missing.components).toContain('custom.video-player');
        expect(missing.capabilities).toContain('hls-stream');
        registeredTypes.add('custom.video-player');
        registeredCaps.add('hls-stream');
      });

      const importRes = await importPackage(fixture.archive, {
        dependencyPolicy: 'install-or-register-before-import',
        componentRegistry: mockRegistry,
        supportedCapabilities: registeredCaps,
        onMissingDependency,
      });

      expect(onMissingDependency).toHaveBeenCalledTimes(1);
      expect(importRes.success).toBe(true);
    });

    it('returns error if dynamic registration fails', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.fail-to-install',
      });

      const onMissingDependency = vi.fn(async () => {
        throw new Error('Network error downloading component definition');
      });

      const importRes = await importPackage(fixture.archive, {
        dependencyPolicy: 'install-or-register-before-import',
        onMissingDependency,
      });

      expect(importRes.success).toBe(false);
      if (!importRes.success) {
        expect(importRes.errors.some((e) => e.code === 'HOST_ADAPTER_ERROR')).toBe(true);
      }
    });
  });

  describe('Acceptance Criteria 4: Asset collision tidak menimpa host tanpa explicit strategy', () => {
    it('rejects import by default when asset ID collides with existing host asset', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        componentType: 'custom.product-card',
        assetId: 'company_logo',
      });

      const hostAssetStore = new Map<string, string>();
      hostAssetStore.set('company_logo', 'https://host.cdn/original_logo.png');

      const mockAssetProvider: AssetProvider = {
        resolve: (id) => hostAssetStore.get(id) || `https://host.cdn/${id}`,
        list: async () => [{ id: 'company_logo', url: 'https://host.cdn/original_logo.png', mimeType: 'image/png' }],
        upload: vi.fn(),
      };

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        assetProvider: mockAssetProvider,
        // No explicit strategy provided (defaults to 'reject')
      });

      expect(importRes.success).toBe(false);
      if (!importRes.success) {
        expect(importRes.errors.some((e) => e.code === 'ASSET_CONFLICT')).toBe(true);
        expect(importRes.diagnosticMessage).toContain('company_logo');
      }

      // Verify host asset was NOT overwritten
      expect(mockAssetProvider.upload).not.toHaveBeenCalled();
      expect(hostAssetStore.get('company_logo')).toBe('https://host.cdn/original_logo.png');
    });

    it('rejects import when existingAssetIds function reports collision', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'banner_bg',
      });

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: (id) => id === 'banner_bg',
        assetCollisionStrategy: 'reject',
      });

      expect(importRes.success).toBe(false);
      if (!importRes.success) {
        expect(importRes.errors.some((e) => e.code === 'ASSET_CONFLICT')).toBe(true);
      }
    });
  });

  describe('Acceptance Criteria 5: Host menentukan strategy penamaan asset conflict (rename)', () => {
    it('renames colliding asset and automatically remaps all document node props to new asset ID', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'colliding_banner',
      });

      const uploadedFiles: Record<string, string> = {};
      const mockAssetProvider: AssetProvider = {
        resolve: (id) => `https://cdn.example.com/${id}`,
        upload: async (file, meta) => {
          const id = (meta?.assetId as string) || 'unknown';
          uploadedFiles[id] = id;
          return { id, url: `https://cdn.example.com/${id}`, mimeType: file.type };
        },
      };

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: ['colliding_banner'],
        assetCollisionStrategy: 'rename',
        assetProvider: mockAssetProvider,
      });

      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      // 1. Verify asset was uploaded under renamed ID
      const expectedRenamedId = 'colliding_banner_imported';
      expect(importRes.extractedAssets.has(expectedRenamedId)).toBe(true);
      expect(uploadedFiles[expectedRenamedId]).toBe(expectedRenamedId);

      // 2. Verify document node prop was remapped to renamed asset ID
      const customNode = importRes.document.document.children?.[0]?.children?.[0];
      const thumbnailProp = customNode?.props?.thumbnail as { type: string; assetId: string };
      expect(thumbnailProp).toBeDefined();
      expect(thumbnailProp.assetId).toBe(expectedRenamedId);

      // 3. Verify renamedAssets mapping returned in result
      expect(importRes.renamedAssets).toEqual({
        colliding_banner: expectedRenamedId,
      });
    });

    it('uses custom renameAssetStrategy if provided by host', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'avatar_icon',
      });

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: new Set(['avatar_icon']),
        assetCollisionStrategy: 'rename',
        renameAssetStrategy: (incoming) => `tenant_prefix_${incoming.id}`,
      });

      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      expect(importRes.extractedAssets.has('tenant_prefix_avatar_icon')).toBe(true);
      const customNode = importRes.document.document.children?.[0]?.children?.[0];
      const thumbnailProp = customNode?.props?.thumbnail as { assetId: string };
      expect(thumbnailProp.assetId).toBe('tenant_prefix_avatar_icon');
    });
  });

  describe('Acceptance Criteria 6: Host strategies (overwrite, reuse-existing, and onAssetConflict hook)', () => {
    it('overwrites host asset when explicit "overwrite" strategy is selected', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'override_logo',
      });

      const uploaded: string[] = [];
      const mockAssetProvider: AssetProvider = {
        resolve: (id) => `https://cdn.example.com/${id}`,
        upload: async (_file, meta) => {
          uploaded.push(meta?.assetId as string);
          return { id: meta?.assetId as string, url: '', mimeType: 'image/png' };
        },
      };

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: ['override_logo'],
        assetCollisionStrategy: 'overwrite',
        assetProvider: mockAssetProvider,
      });

      expect(importRes.success).toBe(true);
      expect(uploaded).toContain('override_logo');
    });

    it('reuses existing host asset when "reuse-existing" strategy is selected without re-uploading', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'shared_icon',
      });

      const uploadMock = vi.fn();
      const mockAssetProvider: AssetProvider = {
        resolve: vi.fn((id) => `https://cdn.example.com/${id}`),
        upload: uploadMock,
      };

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: ['shared_icon'],
        assetCollisionStrategy: 'reuse-existing',
        assetProvider: mockAssetProvider,
      });

      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      // Upload should NOT be called since asset is reused
      expect(uploadMock).not.toHaveBeenCalled();

      // Document keeps pointing to existing shared_icon
      const customNode = importRes.document.document.children?.[0]?.children?.[0];
      const thumbnailProp = customNode?.props?.thumbnail as { assetId: string };
      expect(thumbnailProp.assetId).toBe('shared_icon');
    });

    it('supports onAssetConflict hook for fine-grained per-asset resolution', async () => {
      const fixture = createPackageWithCustomNodeAndAsset({
        assetId: 'dynamic_conflict',
      });

      const onAssetConflict = vi.fn(async (conflict) => {
        expect(conflict.assetId).toBe('dynamic_conflict');
        return {
          action: 'rename' as const,
          newAssetId: 'custom_renamed_id',
        };
      });

      const importRes = await importPackage(fixture.archive, {
        knownComponentTypes: ['custom.product-card'],
        supportedCapabilities: ['payment-gateway'],
        existingAssetIds: ['dynamic_conflict'],
        onAssetConflict,
      });

      expect(onAssetConflict).toHaveBeenCalledTimes(1);
      expect(importRes.success).toBe(true);
      if (!importRes.success) return;

      expect(importRes.extractedAssets.has('custom_renamed_id')).toBe(true);
      const customNode = importRes.document.document.children?.[0]?.children?.[0];
      const thumbnailProp = customNode?.props?.thumbnail as { assetId: string };
      expect(thumbnailProp.assetId).toBe('custom_renamed_id');
    });
  });
});

