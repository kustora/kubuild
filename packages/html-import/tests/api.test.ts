import { describe, expect, it } from 'vitest';
import { PageDocumentSchema } from '@kubuild/schema';
import {
  HTML_IMPORT_DIAGNOSTIC_CODES,
  HTML_IMPORT_VERSION,
  addDiagnostic,
  computeFidelityScore,
  createEmptyReport,
  htmlToNodes,
  importHtml,
  type HtmlImportDiagnostic,
  type HtmlImportDiagnosticCode,
  type HtmlImportReport,
  type HtmlImportStats,
} from '../src/index.js';

describe('Public API and HtmlImportReport (STORA-601)', () => {
  describe('Constants and Diagnostic Codes', () => {
    it('exports HTML_IMPORT_VERSION', () => {
      expect(typeof HTML_IMPORT_VERSION).toBe('string');
      expect(HTML_IMPORT_VERSION).toBe('0.1.0');
    });

    it('defines all 10 required diagnostic codes', () => {
      const expectedCodes: HtmlImportDiagnosticCode[] = [
        'ELEMENT_DROPPED',
        'ELEMENT_FALLBACK_EMBED',
        'ELEMENT_REMAPPED',
        'CSS_UNSUPPORTED_SELECTOR',
        'CSS_UNSUPPORTED_PROPERTY',
        'CSS_MEDIA_APPROXIMATED',
        'ASSET_UNRESOLVED',
        'URL_BLOCKED',
        'DEPTH_FLATTENED',
        'LIMIT_EXCEEDED',
      ];

      expect(HTML_IMPORT_DIAGNOSTIC_CODES).toEqual(expectedCodes);
    });
  });

  describe('Report and Helper Functions', () => {
    it('creates an empty report with initial defaults', () => {
      const report = createEmptyReport();
      expect(report.diagnostics).toEqual([]);
      expect(report.stats).toEqual({
        nodeCount: 0,
        fallbackCount: 0,
        droppedCount: 0,
        fidelityScore: 100,
      });
    });

    describe('computeFidelityScore', () => {
      it('returns 100 when there are no nodes or drops', () => {
        expect(computeFidelityScore({ nodeCount: 0, fallbackCount: 0, droppedCount: 0 })).toBe(100);
      });

      it('returns 100 when all nodes are native (0 fallbacks, 0 drops)', () => {
        expect(computeFidelityScore({ nodeCount: 10, fallbackCount: 0, droppedCount: 0 })).toBe(100);
      });

      it('computes weighted score when fallback embeds exist', () => {
        // 8 native (weight 1.0) + 2 fallback (weight 0.5) = 9.0; total = 10; score = 90
        const score = computeFidelityScore({ nodeCount: 10, fallbackCount: 2, droppedCount: 0 });
        expect(score).toBe(90);
      });

      it('returns 50 when all nodes are fallbacks', () => {
        // 0 native + 5 fallback (weight 0.5) = 2.5; total = 5; score = 50
        const score = computeFidelityScore({ nodeCount: 5, fallbackCount: 5, droppedCount: 0 });
        expect(score).toBe(50);
      });

      it('penalizes dropped elements with zero weight', () => {
        // 5 native (weight 1.0) + 0 fallback + 5 dropped (weight 0.0) = 5.0; total = 10; score = 50
        const score = computeFidelityScore({ nodeCount: 5, fallbackCount: 0, droppedCount: 5 });
        expect(score).toBe(50);
      });

      it('returns 0 when all elements were dropped and none converted', () => {
        const score = computeFidelityScore({ nodeCount: 0, fallbackCount: 0, droppedCount: 10 });
        expect(score).toBe(0);
      });

      it('clamps scores between 0 and 100 and handles negative numbers gracefully', () => {
        expect(computeFidelityScore({ nodeCount: -5, fallbackCount: -2, droppedCount: -1 })).toBe(100);
      });
    });

    describe('addDiagnostic', () => {
      it('records diagnostic and updates droppedCount and fidelityScore', () => {
        const report: HtmlImportReport = {
          diagnostics: [],
          stats: {
            nodeCount: 10,
            fallbackCount: 0,
            droppedCount: 0,
            fidelityScore: 100,
          },
        };

        const diag: HtmlImportDiagnostic = {
          code: 'ELEMENT_DROPPED',
          severity: 'warning',
          message: 'Script tag dropped',
          location: { line: 12, column: 5, tagName: 'script' },
        };

        addDiagnostic(report, diag);
        expect(report.diagnostics).toHaveLength(1);
        expect(report.diagnostics[0]).toBe(diag);
        expect(report.stats.droppedCount).toBe(1);
        // native = 10, dropped = 1 -> (10 / 11) * 100 = 90.9
        expect(report.stats.fidelityScore).toBe(90.9);
      });

      it('records diagnostic and updates fallbackCount and fidelityScore', () => {
        const report: HtmlImportReport = {
          diagnostics: [],
          stats: {
            nodeCount: 10,
            fallbackCount: 0,
            droppedCount: 0,
            fidelityScore: 100,
          },
        };

        const diag: HtmlImportDiagnostic = {
          code: 'ELEMENT_FALLBACK_EMBED',
          severity: 'info',
          message: 'Canvas element converted to embed',
          location: { tagName: 'canvas' },
        };

        addDiagnostic(report, diag);
        expect(report.stats.fallbackCount).toBe(1);
        // native = 9, fallback = 1 -> (9 + 0.5) / 10 * 100 = 95
        expect(report.stats.fidelityScore).toBe(95);
      });

      it('records other diagnostics without mutating counts', () => {
        const report = createEmptyReport();
        const diag: HtmlImportDiagnostic = {
          code: 'CSS_UNSUPPORTED_PROPERTY',
          severity: 'warning',
          message: 'Unsupported filter property',
          location: { selector: '.card' },
        };

        addDiagnostic(report, diag);
        expect(report.diagnostics).toEqual([diag]);
        expect(report.stats.droppedCount).toBe(0);
        expect(report.stats.fallbackCount).toBe(0);
      });
    });
  });

  describe('importHtml', () => {
    it('successfully imports valid HTML and produces a valid PageDocument', async () => {
      const html = '<!DOCTYPE html><html><head><title>Test Page</title></head><body><h1>Hello</h1></body></html>';
      const result = await importHtml(html, {
        metadata: { title: 'Test Landing' },
      });

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.error).toBeUndefined();

      // Ensure result.document conforms to official PageDocumentSchema
      const parseResult = PageDocumentSchema.safeParse(result.document);
      expect(parseResult.success).toBe(true);

      expect(result.document?.metadata?.title).toBe('Test Landing');
      expect(result.document?.document.type).toBe('page');
      expect(result.report.stats.nodeCount).toBe(2);
      expect(result.report.stats.fidelityScore).toBe(100);
      expect(typeof result.report.stats.durationMs).toBe('number');
    });

    it('handles empty string without throwing', async () => {
      const result = await importHtml('');
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document?.schema).toBe('stora.page');
      expect(result.report.stats.nodeCount).toBe(1);
    });

    it('handles malformed HTML without throwing', async () => {
      const malformed = '<div><p>Unclosed paragraph<span>Nested without closing tags';
      const result = await importHtml(malformed);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      const parseResult = PageDocumentSchema.safeParse(result.document);
      expect(parseResult.success).toBe(true);
    });

    it('safely handles non-string input without throwing', async () => {
      // @ts-expect-error Testing runtime invalid input
      const result = await importHtml(null);

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toContain('HTML input must be a string');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects input exceeding maxDocumentSizeBytes with LIMIT_EXCEEDED diagnostic', async () => {
      const html = '<p>Hello world</p>';
      const result = await importHtml(html, {
        limits: { maxDocumentSizeBytes: 5 },
      });

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toContain('Input size limit exceeded');
      expect(result.report.diagnostics).toHaveLength(1);
      expect(result.report.diagnostics[0].code).toBe('LIMIT_EXCEEDED');
      expect(result.report.diagnostics[0].severity).toBe('error');
    });

    it('rejects document when node count exceeds maxNodeCount limit', async () => {
      const html = '<p>Hello</p>';
      const result = await importHtml(html, {
        limits: { maxNodeCount: 0 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Node count limit exceeded');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });
  });

  describe('htmlToNodes', () => {
    it('successfully imports valid HTML fragment and returns nodes array', async () => {
      const fragment = '<div class="banner"><h2>Title</h2><p>Description</p></div>';
      const result = await htmlToNodes(fragment);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report.stats.fidelityScore).toBe(100);
      expect(typeof result.report.stats.durationMs).toBe('number');
    });

    it('handles empty string without throwing', async () => {
      const result = await htmlToNodes('');
      expect(result.success).toBe(true);
      expect(result.nodes).toEqual([]);
      expect(result.report.stats.nodeCount).toBe(0);
    });

    it('handles malformed HTML fragment without throwing', async () => {
      const malformed = '<div><span>Broken <b>unclosed tag</div>';
      const result = await htmlToNodes(malformed);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.nodes)).toBe(true);
    });

    it('safely handles non-string input without throwing', async () => {
      // @ts-expect-error Testing runtime invalid input
      const result = await htmlToNodes(undefined);

      expect(result.success).toBe(false);
      expect(result.nodes).toEqual([]);
      expect(result.error).toContain('HTML input must be a string');
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects fragment exceeding maxDocumentSizeBytes', async () => {
      const fragment = '<p>Exceeding limit test</p>';
      const result = await htmlToNodes(fragment, {
        limits: { maxDocumentSizeBytes: 10 },
      });

      expect(result.success).toBe(false);
      expect(result.nodes).toEqual([]);
      expect(result.error).toContain('Input size limit exceeded');
      expect(result.report.diagnostics[0].code).toBe('LIMIT_EXCEEDED');
    });
  });
});
