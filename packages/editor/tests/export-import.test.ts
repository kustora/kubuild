import { describe, it, expect } from 'vitest';
import { sanitizeDocumentFilename } from '../src/utils/export-utils';
import { starterPageFixture } from '@kubuild/schema';
import { exportPackage, inspectPackage, importPackage } from '@kubuild/core';
import { createDefaultComponentRegistry } from '@kubuild/components';

describe('STORA-065: Export & Import Integration', () => {
  const registry = createDefaultComponentRegistry();
  const supportedCapabilities = ['assetProvider', 'actionRegistry', 'variableRegistry', 'dataProvider'];

  describe('sanitizeDocumentFilename', () => {
    it('creates safe filename slugs for packages and json', () => {
      expect(sanitizeDocumentFilename('Welcome to KUBUILD!', 'stora')).toBe('welcome-to-kubuild.stora');
      expect(sanitizeDocumentFilename('My Special $#% Page', 'json')).toBe('my-special-page.json');
      expect(sanitizeDocumentFilename('', 'stora')).toBe('page.stora');
    });
  });

  describe('Export to .stora and preflight inspection round-trip', () => {
    it('exports a page document, inspects preflight, and imports cleanly', async () => {
      const exportResult = await exportPackage(starterPageFixture, {
        componentRegistry: registry,
        assets: {
          asset_hero_graphic: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        },
      });

      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      expect(exportResult.archive).toBeDefined();
      expect(exportResult.archive.length).toBeGreaterThan(0);

      // Inspect package preflight
      const preflight = await inspectPackage(exportResult.archive, {
        componentRegistry: registry,
        supportedCapabilities,
      });

      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.missingComponents).toEqual([]);
      expect(preflight.missingCapabilities).toEqual([]);

      // Import package
      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: registry,
        supportedCapabilities,
      });

      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      expect(importResult.document.schema).toBe('stora.page');
      expect(importResult.document.document.type).toBe('page');
      expect(importResult.document.document.children?.length).toBe(1);
    });

    it('preflight detects missing custom components and allows placeholder policy decision', async () => {
      const customExporterRegistry = createDefaultComponentRegistry();
      customExporterRegistry.register({
        type: 'custom.video-hero',
        category: 'custom',
        label: 'Video Hero',
        renderer: () => null,
      });

      const docWithCustom = JSON.parse(JSON.stringify(starterPageFixture));
      docWithCustom.document.children[0].children[0].children.push({
        id: 'custom_widget_1',
        type: 'custom.video-hero',
        props: { videoUrl: 'https://cdn.example.com/video.mp4' },
      });

      const exportResult = await exportPackage(docWithCustom, {
        componentRegistry: customExporterRegistry,
        assets: {
          asset_hero_graphic: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        },
      });

      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      // Inspect with clean registry (missing custom.video-hero) in strict mode
      const preflightStrict = await inspectPackage(exportResult.archive, {
        componentRegistry: registry,
        supportedCapabilities,
        dependencyPolicy: 'cancel',
      });

      expect(preflightStrict.missingComponents).toContain('custom.video-hero');
      expect(preflightStrict.canImport).toBe(false);

      // Inspect with placeholder policy
      const preflightPlaceholder = await inspectPackage(exportResult.archive, {
        componentRegistry: registry,
        supportedCapabilities,
        dependencyPolicy: 'import-with-placeholder',
      });

      expect(preflightPlaceholder.missingComponents).toContain('custom.video-hero');
      expect(preflightPlaceholder.canImport).toBe(true);

      // Import with placeholder succeeds and keeps node
      const importResult = await importPackage(exportResult.archive, {
        componentRegistry: registry,
        supportedCapabilities,
        dependencyPolicy: 'import-with-placeholder',
      });

      expect(importResult.success).toBe(true);
      if (importResult.success) {
        const container = importResult.document.document.children?.[0]?.children?.[0];
        const customNode = container?.children?.find((c) => c.type === 'custom.video-hero');
        expect(customNode).toBeDefined();
        expect(customNode?.id).toBe('custom_widget_1');
      }
    });
  });
});
