import { describe, it, expect, vi } from 'vitest';
import { zipSync, strToU8, strFromU8 } from 'fflate';
import { PageDocument, SCHEMA_NAME, CURRENT_SCHEMA_VERSION, Manifest } from '@kubuild/schema';
import {
  exportPackage,
  sha256Sync,
  calculateChecksum,
} from './exporter';
import {
  preflightPackage,
  inspectPackage,
  importPackage,
  importStoraPackage,
  isDangerousPath,
} from './importer';
import { createBlankDocument } from './document-utils';
import type { ComponentRegistryLike } from './validator';
import type { AssetProvider, AssetInfo } from './interfaces';

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
