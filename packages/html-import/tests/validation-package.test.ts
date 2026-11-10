import { describe, expect, it } from 'vitest';
import {
  PageDocumentSchema,
  SCHEMA_NAME,
  CURRENT_SCHEMA_VERSION,
  type PageDocument,
} from '@kubuild/schema';
import {
  preflightPackage,
  importPackage,
  validateDocumentSecurity,
} from '@kubuild/core';
import {
  assemblePageDocument,
  createEmptyReport,
  importHtml,
  importHtmlToStoraPackage,
  validatePageDocument,
  type HtmlImportReport,
  type HtmlMappingRule,
  type PageNode,
} from '../src/index.js';

describe('Final Validation & .stora Export (STORA-614)', () => {
  describe('assemblePageDocument and validatePageDocument', () => {
    it('assembles a well-formed PageDocument from root page node and metadata', () => {
      const rootNode: PageNode & { type: 'page' } = {
        id: 'root-page',
        type: 'page',
        props: { title: 'Test Title' },
        styles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
        children: [
          {
            id: 'heading-1',
            type: 'heading',
            props: { text: 'Hello World', level: 1 },
          },
        ],
      };

      const doc = assemblePageDocument({
        rootNode,
        title: 'Custom Page',
        description: 'Page description',
        metadata: {
          author: 'Alice',
          tags: ['landing', 'promo'],
          category: 'marketing',
        },
      });

      expect(doc.schema).toBe(SCHEMA_NAME);
      expect(doc.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(doc.metadata?.title).toBe('Custom Page');
      expect(doc.metadata?.description).toBe('Page description');
      expect(doc.metadata?.author).toBe('Alice');
      expect(doc.metadata?.tags).toEqual(['landing', 'promo']);
      expect(doc.metadata?.category).toBe('marketing');
      expect(doc.document).toBe(rootNode);

      const validation = validatePageDocument(doc);
      expect(validation.valid).toBe(true);
      expect(validation.document).toBeDefined();
      expect(validation.errors).toHaveLength(0);
    });

    it('rejects an invalid document schema (e.g. wrong schema name or missing required fields)', () => {
      const report: HtmlImportReport = createEmptyReport();
      const invalidDoc = {
        schema: 'wrong.schema',
        version: CURRENT_SCHEMA_VERSION,
        document: {
          id: 'root-page',
          type: 'page',
          props: {},
          children: [],
        },
      };

      const result = validatePageDocument(invalidDoc, undefined, report);
      expect(result.valid).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('schema'))).toBe(true);
      expect(report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects a document with invalid child node structure', () => {
      const report: HtmlImportReport = createEmptyReport();
      const docWithInvalidNode = {
        schema: SCHEMA_NAME,
        version: CURRENT_SCHEMA_VERSION,
        document: {
          id: 'root-page',
          type: 'page',
          props: { title: 'Invalid Node Test' },
          children: [
            {
              id: 'bad-node',
              type: 99999, // Invalid type! Must be a string
              props: {},
            },
          ],
        },
      };

      const result = validatePageDocument(docWithInvalidNode, undefined, report);
      expect(result.valid).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(report.diagnostics.length).toBeGreaterThan(0);
    });

    it('rejects a document that exceeds tree depth security limits', () => {
      const report: HtmlImportReport = createEmptyReport();

      // Create a deeply nested chain of container nodes (depth 10)
      let innerNode: PageNode = {
        id: 'leaf-node',
        type: 'text',
        props: { text: 'Deep leaf' },
      };
      for (let i = 10; i >= 1; i--) {
        innerNode = {
          id: `node-depth-${i}`,
          type: 'container',
          props: {},
          children: [innerNode],
        };
      }

      const deepDoc: PageDocument = {
        schema: SCHEMA_NAME,
        version: CURRENT_SCHEMA_VERSION,
        document: {
          id: 'root-page',
          type: 'page',
          props: { title: 'Deep Page' },
          children: [innerNode],
        },
      };

      const result = validatePageDocument(deepDoc, { maxTreeDepth: 4 }, report);
      expect(result.valid).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.errors.some((e) => e.includes('MAX_TREE_DEPTH_EXCEEDED'))).toBe(true);
      expect(report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects a document that contains prototype pollution properties', () => {
      const report: HtmlImportReport = createEmptyReport();
      const maliciousDoc = {
        schema: SCHEMA_NAME,
        version: CURRENT_SCHEMA_VERSION,
        __proto__: { injected: true },
        document: {
          id: 'root-page',
          type: 'page',
          props: { title: 'Pollution Test' },
          children: [],
        },
      };

      // Explicitly define __proto__ property
      Object.defineProperty(maliciousDoc, '__proto__', {
        value: { polluted: true },
        enumerable: true,
        configurable: true,
      });

      const result = validatePageDocument(maliciousDoc, undefined, report);
      expect(result.valid).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.errors.some((e) => e.includes('PROTOTYPE_POLLUTION_DETECTED'))).toBe(true);
      expect(report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });
  });

  describe('importHtml validation enforcement', () => {
    it('successfully imports valid HTML and passes PageDocumentSchema and validateDocumentSecurity', async () => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Stora Landing Page</title>
            <meta name="description" content="A fast, modern builder test" />
            <style>
              .hero { padding: 40px; background-color: #f8fafc; }
              .hero h1 { color: #0f172a; font-size: 32px; }
              .cta { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: #ffffff; }
            </style>
          </head>
          <body>
            <section class="hero">
              <h1>Build faster with KUBUILD</h1>
              <p>Import and export with zero friction.</p>
              <a href="https://kubuild.dev" class="cta">Get Started</a>
            </section>
          </body>
        </html>
      `;

      const result = await importHtml(html, {
        metadata: { author: 'KUBUILD Team' },
      });

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const doc = result.document!;
      expect(doc.schema).toBe(SCHEMA_NAME);
      expect(doc.version).toBe(CURRENT_SCHEMA_VERSION);
      expect(doc.metadata?.title).toBe('Stora Landing Page');
      expect(doc.metadata?.description).toBe('A fast, modern builder test');
      expect(doc.metadata?.author).toBe('KUBUILD Team');

      // Double-check with PageDocumentSchema.safeParse
      const schemaCheck = PageDocumentSchema.safeParse(doc);
      expect(schemaCheck.success).toBe(true);

      // Double-check with validateDocumentSecurity
      const securityCheck = validateDocumentSecurity(doc);
      expect(securityCheck.safe).toBe(true);
      expect(securityCheck.errors).toHaveLength(0);
    });

    it('never returns success: true if a rule injects a schema-violating node', async () => {
      // Injects a node with an invalid structure (e.g. invalid action pipeline schema)
      const invalidNodeRule: HtmlMappingRule = {
        id: 'inject-invalid-node',
        priority: 100,
        match: (el) => el.tagName === 'p',
        convert: () => [
          {
            id: 'p-node',
            type: 'paragraph',
            props: { text: 'Malicious Action Test' },
            actions: [{ invalidActionTrigger: 12345 }] as any,
          },
        ],
      };

      const result = await importHtml('<p>Test Paragraph</p>', {
        rules: [invalidNodeRule],
      });

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Schema validation failed');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('fails import and returns success: false if security maxTreeDepth is exceeded', async () => {
      const html = '<p>Nesting check</p>';

      const result = await importHtml(html, {
        limits: { maxTreeDepth: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toContain('MAX_TREE_DEPTH_EXCEEDED');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('fails import and returns success: false if maxStringLength is exceeded', async () => {
      const longText = 'A'.repeat(500);
      const html = `<p>${longText}</p>`;

      const result = await importHtml(html, {
        limits: { maxStringLength: 50 },
      });

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toContain('MAX_STRING_LENGTH_EXCEEDED');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });
  });

  describe('importHtmlToStoraPackage', () => {
    it('exports a valid imported HTML to a valid .stora package buffer', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Stora Export Test</title>
          </head>
          <body>
            <header>
              <h1>Stora Ready Page</h1>
            </header>
            <main>
              <p>Ready to package into .stora format!</p>
            </main>
          </body>
        </html>
      `;

      const result = await importHtmlToStoraPackage(html, {
        packageName: 'Stora Export Package',
      });

      expect(result.success).toBe(true);
      expect(result.packageBuffer).toBeDefined();
      expect(result.packageBuffer instanceof Uint8Array).toBe(true);
      expect(result.packageBuffer!.byteLength).toBeGreaterThan(0);
      expect(result.document).toBeDefined();
      expect(result.document?.metadata?.title).toBe('Stora Export Test');

      // Verify the package buffer passes preflightPackage from @kubuild/core
      const preflight = await preflightPackage(result.packageBuffer!);
      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
      expect(preflight.manifest).toBeDefined();

      // Verify the package buffer passes importPackage from @kubuild/core
      const imported = await importPackage(result.packageBuffer!);
      expect(imported.success).toBe(true);
      expect(imported.document).toBeDefined();
      expect(imported.document?.schema).toBe(SCHEMA_NAME);
      expect(imported.document?.document?.type).toBe('page');
    });

    it('exports .stora package with binary assets attached', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Asset Package Test</title></head>
          <body>
            <img src="asset://logo-image" alt="Logo" />
            <p>Welcome to KUBUILD</p>
          </body>
        </html>
      `;

      const fakeImageBytes = new TextEncoder().encode('PNG_MOCK_IMAGE_DATA');
      const result = await importHtmlToStoraPackage(html, {
        packageName: 'Asset Package Test',
        assets: [
          {
            assetId: 'logo-image',
            data: fakeImageBytes,
            filename: 'logo.png',
            mimeType: 'image/png',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.packageBuffer).toBeDefined();

      // Inspect via preflight
      const preflight = await preflightPackage(result.packageBuffer!);
      expect(preflight.valid).toBe(true);
      expect(preflight.canImport).toBe(true);
      expect(preflight.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);

      // Verify import with assets
      const imported = await importPackage(result.packageBuffer!);
      expect(imported.success).toBe(true);
      expect(imported.document).toBeDefined();
    });

    it('returns failure when HTML compilation fails due to security limits', async () => {
      const html = '<p>Deep Content</p>';
      const result = await importHtmlToStoraPackage(html, {
        limits: { maxTreeDepth: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.packageBuffer).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.report.diagnostics.length).toBeGreaterThan(0);
    });
  });
});
