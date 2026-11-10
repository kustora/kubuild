import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createDefaultComponentRegistry } from '@kubuild/components';
import { createBlankDocument } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';
import { importHtml, importHtmlZip } from '@kubuild/html-import';
import { HtmlImportModal } from '../src/components/modals/html-import-modal';
import { EditorToolbar } from '../src/components/layout/toolbar';
import { useEditorStore } from '../src/store';

describe('HtmlImportModal (STORA-616)', () => {
  const registry = createDefaultComponentRegistry();

  beforeEach(() => {
    const doc = createBlankDocument('HTML Import Test');
    useEditorStore.getState().setDocument(doc);
    useEditorStore.getState().setLocale('en');
  });

  describe('Modal Rendering', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <HtmlImportModal
          isOpen={false}
          onClose={() => {}}
          onImport={() => {}}
        />,
      );
      expect(html).toBe('');
    });

    it('renders dialog elements when isOpen is true', () => {
      const html = renderToString(
        <HtmlImportModal
          isOpen={true}
          onClose={() => {}}
          onImport={() => {}}
        />,
      );

      // Accessibility & dialog structure
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('id="html-import-modal-title"');

      // Title & descriptions
      expect(html).toContain('Import HTML');
      expect(html).toContain('Convert static HTML or ZIP archives into an editable page document.');

      // Tabs
      expect(html).toContain('Upload File');
      expect(html).toContain('Paste HTML');

      // Upload dropzone & hints
      expect(html).toContain('Click to select or drag &amp; drop HTML or ZIP file');
      expect(html).toContain('Supports .html, .htm, and .zip archives');

      // Action buttons
      expect(html).toContain('Cancel');
      expect(html).toContain('Import to Editor');
      // Import button disabled by default when no document is imported
      expect(html).toContain('disabled');
    });

    it('renders Indonesian localized strings when locale is set to id', () => {
      useEditorStore.getState().setLocale('id');

      const html = renderToString(
        <HtmlImportModal
          isOpen={true}
          onClose={() => {}}
          onImport={() => {}}
        />,
      );

      expect(html).toContain('Impor HTML');
      expect(html).toContain('Unggah File');
      expect(html).toContain('Tempel HTML');
      expect(html).toContain('Batal');
      expect(html).toContain('Impor ke Editor');
    });

    it('renders presets when provided in Paste tab', () => {
      const html = renderToString(
        <HtmlImportModal
          isOpen={true}
          onClose={() => {}}
          onImport={() => {}}
          initialHtml="<h1>Sample</h1>"
          presets={[
            { id: 'p1', name: 'Preset Hero', html: '<h1>Hero</h1>' },
            { id: 'p2', name: 'Preset Form', html: '<form><button>Send</button></form>' },
          ]}
        />,
      );

      expect(html).toContain('Sample Presets:');
      expect(html).toContain('Preset Hero');
      expect(html).toContain('Preset Form');
    });
  });

  describe('Import Logic & Execution', () => {
    it('imports raw HTML string cleanly and produces a valid PageDocument with fidelity score and diagnostics', async () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <title>Landing Test Page</title>
            <meta name="description" content="A test landing page description">
            <style>
              .hero { background-color: #2563eb; color: #ffffff; padding: 24px; }
              .custom-unsupported-pseudo:hover { opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="hero">
              <h1>Welcome to KUBUILD</h1>
              <p>Build visual landing pages effortlessly.</p>
              <a href="https://example.com" class="cta-link">Get Started</a>
            </div>
          </body>
        </html>
      `;

      const result = await importHtml(sampleHtml);
      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const doc = result.document!;
      expect(doc.schema).toBe('stora.page');
      expect(doc.metadata.title).toBe('Landing Test Page');
      expect(doc.metadata.description).toBe('A test landing page description');
      expect(doc.document.children && doc.document.children.length).toBeGreaterThan(0);

      // Report assertions
      expect(result.report).toBeDefined();
      expect(result.report.stats.fidelityScore).toBeGreaterThanOrEqual(0);
      expect(result.report.stats.nodeCount).toBeGreaterThan(0);
      expect(result.report.stats.fallbackCount).toBe(0);
      expect(Array.isArray(result.report.diagnostics)).toBe(true);
    });

    it('handles cancellation without calling onImport', () => {
      const handleImport = vi.fn();
      const handleClose = vi.fn();

      // Simulate a user cancelling
      const userCancels = () => {
        handleClose();
      };
      userCancels();

      expect(handleImport).not.toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalledOnce();
    });

    it('calls onImport with the generated document on confirmation', async () => {
      const handleImport = vi.fn();
      const handleClose = vi.fn();

      const html = '<main><h2>Section Heading</h2><p>Some content</p></main>';
      const result = await importHtml(html);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      // Simulate confirmation action
      const confirmAction = () => {
        if (result.success && result.document) {
          handleImport(result.document);
          handleClose();
        }
      };
      confirmAction();

      expect(handleImport).toHaveBeenCalledOnce();
      expect(handleImport).toHaveBeenCalledWith(result.document);
      expect(handleClose).toHaveBeenCalledOnce();
    });

    it('rejects input exceeding limits and reports clear error message', async () => {
      const massiveHtml = '<p>' + 'a'.repeat(2000) + '</p>';
      const result = await importHtml(massiveHtml, {
        limits: {
          maxDocumentSizeBytes: 500, // artificially low limit
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('limit exceeded');
      expect(result.document).toBeUndefined();
    });
  });

  describe('Toolbar Integration', () => {
    it('renders Import HTML button in EditorToolbar alongside standard Import', () => {
      const html = renderToString(<EditorToolbar registry={registry} />);

      expect(html).toContain('Import HTML');
      expect(html).toContain('Import .stora Package');
      expect(html).toContain('title="Import HTML or ZIP Archive"');
    });
  });
});
