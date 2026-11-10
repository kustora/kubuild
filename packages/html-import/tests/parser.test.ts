import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_DOCUMENT_SIZE_BYTES,
  isFullHtmlDocument,
  parseHtml,
  importHtml,
  type ParsedHtmlDocument,
} from '../src/index.js';

describe('HTML Parser and AST Extraction (STORA-602)', () => {
  describe('Full HTML document parsing', () => {
    it('correctly parses a complete HTML document with metadata, styles, and links', () => {
      const html = `<!DOCTYPE html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>Halaman Landing Kustora</title>
    <meta name="description" content="Platform website builder modern untuk bisnis Anda" />
    <link rel="stylesheet" href="https://cdn.example.com/theme.css" />
    <link rel="stylesheet" href="/assets/custom.css" />
    <link rel="icon" href="/favicon.ico" />
    <style>
      body {
        margin: 0;
        font-family: sans-serif;
      }
    </style>
    <style media="print">
      .hide-on-print {
        display: none;
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Selamat Datang</h1>
    </header>
    <main>
      <p>Konten utama di sini.</p>
    </main>
  </body>
</html>`;

      const result = parseHtml(html);

      expect(result.success).toBe(true);
      expect(result.isFragment).toBe(false);
      expect(result.title).toBe('Halaman Landing Kustora');
      expect(result.description).toBe('Platform website builder modern untuk bisnis Anda');
      expect(result.lang).toBe('id');

      // Check external stylesheets
      expect(result.stylesheetUrls).toEqual([
        'https://cdn.example.com/theme.css',
        '/assets/custom.css',
      ]);

      // Check embedded styles
      expect(result.styles).toHaveLength(2);
      expect(result.styles[0].content).toContain('font-family: sans-serif;');
      expect(result.styles[0].media).toBeUndefined();
      expect(result.styles[1].content).toContain('.hide-on-print');
      expect(result.styles[1].media).toBe('print');

      // Check body and root elements
      expect(result.rootElement).toBeDefined();
      expect(result.rootElement?.nodeName).toBe('#document');
      expect(result.bodyElement).toBeDefined();
      expect(result.bodyElement?.tagName).toBe('body');

      // Result also exposes document/parsed object
      expect(result.parsed).toBeDefined();
      expect(result.parsed?.title).toBe('Halaman Landing Kustora');
      expect(result.document).toBe(result.parsed);
    });

    it('handles uppercase tags and attributes (case insensitivity)', () => {
      const html = `<HTML LANG="en-US">
  <HEAD>
    <TITLE>Case Test</TITLE>
    <META NAME="DESCRIPTION" CONTENT="Case insensitive metadata">
    <LINK REL="STYLESHEET" HREF="/style.css">
    <STYLE MEDIA="SCREEN">p { color: red; }</STYLE>
  </HEAD>
  <BODY>
    <DIV>Hello</DIV>
  </BODY>
</HTML>`;

      const result = parseHtml(html);

      expect(result.success).toBe(true);
      expect(result.isFragment).toBe(false);
      expect(result.title).toBe('Case Test');
      expect(result.description).toBe('Case insensitive metadata');
      expect(result.lang).toBe('en-US');
      expect(result.stylesheetUrls).toEqual(['/style.css']);
      expect(result.styles).toEqual([{ content: 'p { color: red; }', media: 'SCREEN' }]);
      expect(result.bodyElement?.tagName).toBe('body');
    });

    it('extracts xml:lang when lang is missing', () => {
      const html = '<html xml:lang="de"><head><title>German</title></head><body>Guten Tag</body></html>';
      const result = parseHtml(html);
      expect(result.lang).toBe('de');
    });

    it('handles missing metadata gracefully', () => {
      const html = '<!DOCTYPE html><html><head></head><body><h1>No meta</h1></body></html>';
      const result = parseHtml(html);

      expect(result.success).toBe(true);
      expect(result.isFragment).toBe(false);
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.lang).toBeUndefined();
      expect(result.styles).toEqual([]);
      expect(result.stylesheetUrls).toEqual([]);
      expect(result.bodyElement?.tagName).toBe('body');
    });
  });

  describe('Fragment parsing without <head>/<body>', () => {
    it('parses a basic HTML fragment without head or body', () => {
      const fragment = '<div class="hero"><h2>Welcome</h2><p>Subtitle</p></div>';
      const result = parseHtml(fragment);

      expect(result.success).toBe(true);
      expect(result.isFragment).toBe(true);
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.lang).toBeUndefined();
      expect(result.bodyElement).toBeUndefined();
      expect(result.rootElement?.nodeName).toBe('#document-fragment');
      expect(result.styles).toEqual([]);
      expect(result.stylesheetUrls).toEqual([]);
    });

    it('extracts styles and stylesheet links inside an HTML fragment', () => {
      const fragment = `<style>.badge { background: blue; }</style>
<link rel="stylesheet" href="/badge.css" />
<div class="badge">New</div>`;

      const result = parseHtml(fragment);

      expect(result.success).toBe(true);
      expect(result.isFragment).toBe(true);
      expect(result.styles).toHaveLength(1);
      expect(result.styles[0].content).toContain('.badge { background: blue; }');
      expect(result.stylesheetUrls).toEqual(['/badge.css']);
    });
  });

  describe('isFullHtmlDocument detection', () => {
    it('detects doctype as full document', () => {
      expect(isFullHtmlDocument('<!DOCTYPE html><html>')).toBe(true);
      expect(isFullHtmlDocument('<!doctype html><p>Simple</p>')).toBe(true);
    });

    it('detects html tag as full document', () => {
      expect(isFullHtmlDocument('<html lang="en"><div>Content</div></html>')).toBe(true);
      expect(isFullHtmlDocument('<html><body>Hi</body></html>')).toBe(true);
    });

    it('detects head or body tag as full document', () => {
      expect(isFullHtmlDocument('<head><title>Head only</title></head>')).toBe(true);
      expect(isFullHtmlDocument('<body><div>Body only</div></body>')).toBe(true);
    });

    it('identifies non-full documents as fragments', () => {
      expect(isFullHtmlDocument('<header class="navbar">Nav</header>')).toBe(false);
      expect(isFullHtmlDocument('<div class="container"><h1>Test</h1></div>')).toBe(false);
      expect(isFullHtmlDocument('<p>Simple paragraph</p>')).toBe(false);
      expect(isFullHtmlDocument('<html-tag-custom>Custom</html-tag-custom>')).toBe(false);
      expect(isFullHtmlDocument('')).toBe(false);
    });
  });

  describe('Malformed HTML resilience', () => {
    it('handles unclosed tags without throwing', () => {
      const malformed = '<div><p>Unclosed paragraph<span>Unclosed span<b>Bold';
      const result = parseHtml(malformed);

      expect(result.success).toBe(true);
      expect(result.rootElement).toBeDefined();
    });

    it('handles broken tables without throwing', () => {
      const brokenTable = '<table><tr><td>Cell 1<td>Cell 2</tr>';
      const result = parseHtml(brokenTable);

      expect(result.success).toBe(true);
      expect(result.rootElement).toBeDefined();
    });

    it('handles mismatched nested tags gracefully', () => {
      const mismatched = '<b><i>Bold and italic</b></i><p>Another unclosed';
      const result = parseHtml(mismatched);

      expect(result.success).toBe(true);
      expect(result.rootElement).toBeDefined();
    });

    it('handles stray closing tags gracefully', () => {
      const stray = '</div></span></td></tr><p>Normal text</p>';
      const result = parseHtml(stray);

      expect(result.success).toBe(true);
      expect(result.rootElement).toBeDefined();
    });
  });

  describe('Input size limits and validation', () => {
    it('rejects input exceeding custom maxDocumentSizeBytes limit', () => {
      const html = '<p>Exceeding custom limit</p>';
      const result = parseHtml(html, {
        limits: { maxDocumentSizeBytes: 10 },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input size limit exceeded');
      expect(result.report.diagnostics).toHaveLength(1);
      expect(result.report.diagnostics[0].code).toBe('LIMIT_EXCEEDED');
      expect(result.report.diagnostics[0].severity).toBe('error');
    });

    it('enforces default limit of 5MB', () => {
      expect(DEFAULT_MAX_DOCUMENT_SIZE_BYTES).toBe(5 * 1024 * 1024);

      // Create a string that exceeds 5MB
      const fiveMegabytesPlus = 'a'.repeat(5 * 1024 * 1024 + 1);
      const result = parseHtml(fiveMegabytesPlus);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Input size limit exceeded');
      expect(result.report.diagnostics[0].code).toBe('LIMIT_EXCEEDED');
      expect(result.report.diagnostics[0].severity).toBe('error');
    });

    it('rejects non-string input safely', () => {
      // @ts-expect-error Testing invalid runtime input
      const result = parseHtml(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTML input must be a string');
      expect(result.report.diagnostics[0].code).toBe('LIMIT_EXCEEDED');
      expect(result.report.diagnostics[0].severity).toBe('error');
    });
  });

  describe('Integration into importHtml metadata', () => {
    it('populates document metadata title and description from HTML', async () => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Auto Extracted Title</title>
    <meta name="description" content="Auto extracted description text" />
  </head>
  <body>
    <h1>Content</h1>
  </body>
</html>`;

      const result = await importHtml(html);

      expect(result.success).toBe(true);
      expect(result.document?.metadata?.title).toBe('Auto Extracted Title');
      expect(result.document?.metadata?.description).toBe('Auto extracted description text');
      expect(result.document?.document.props.title).toBe('Auto Extracted Title');
    });

    it('allows options.metadata to override extracted title and description', async () => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Extracted Title</title>
    <meta name="description" content="Extracted description" />
  </head>
  <body>
    <h1>Content</h1>
  </body>
</html>`;

      const result = await importHtml(html, {
        metadata: {
          title: 'Overridden Title',
          description: 'Overridden description',
        },
      });

      expect(result.success).toBe(true);
      expect(result.document?.metadata?.title).toBe('Overridden Title');
      expect(result.document?.metadata?.description).toBe('Overridden description');
      expect(result.document?.document.props.title).toBe('Overridden Title');
    });
  });
});
