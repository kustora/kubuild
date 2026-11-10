import { describe, expect, it, vi } from 'vitest';
import {
  collectAndParseStylesheets,
  createEmptyReport,
  isDangerousDeclaration,
  isRootOrHtmlSelector,
  isUrlLike,
  parseCssString,
  parseHtml,
  resolveStylesheetHref,
  type HtmlImportReport,
  type ParsedHtmlDocument,
} from '../src/index.js';

describe('Stylesheet Collector and Tolerant Parser (STORA-604)', () => {
  describe('parseCssString', () => {
    it('parses standard CSS rules with selectors, declarations, and !important', () => {
      const css = `
        h1 {
          color: red !important;
          font-size: 24px;
        }
        .btn, button.primary {
          background-color: blue;
          padding: 8px 16px;
        }
      `;

      const result = parseCssString(css);

      expect(result.rules).toHaveLength(2);

      const [r1, r2] = result.rules;
      expect(r1.selector).toBe('h1');
      expect(r1.sourceOrder).toBe(0);
      expect(r1.mediaQuery).toBeUndefined();
      expect(r1.declarations).toEqual([
        { property: 'color', value: 'red', important: true },
        { property: 'font-size', value: '24px', important: false },
      ]);

      expect(r2.selector).toBe('.btn, button.primary');
      expect(r2.sourceOrder).toBe(1);
      expect(r2.declarations).toEqual([
        { property: 'background-color', value: 'blue', important: false },
        { property: 'padding', value: '8px 16px', important: false },
      ]);
      expect(result.nextSourceOrder).toBe(2);
    });

    it('extracts nested rules in @media queries and preserves the media condition', () => {
      const css = `
        .container {
          width: 100%;
        }
        @media (max-width: 768px) {
          .container {
            width: 100vw;
          }
          .sidebar {
            display: none;
          }
        }
        @media screen and (min-width: 1024px) {
          .sidebar {
            display: block;
          }
        }
      `;

      const result = parseCssString(css);

      expect(result.rules).toHaveLength(4);

      expect(result.rules[0].selector).toBe('.container');
      expect(result.rules[0].mediaQuery).toBeUndefined();
      expect(result.rules[0].sourceOrder).toBe(0);

      expect(result.rules[1].selector).toBe('.container');
      expect(result.rules[1].mediaQuery).toBe('(max-width: 768px)');
      expect(result.rules[1].sourceOrder).toBe(1);
      expect(result.rules[1].declarations).toEqual([
        { property: 'width', value: '100vw', important: false },
      ]);

      expect(result.rules[2].selector).toBe('.sidebar');
      expect(result.rules[2].mediaQuery).toBe('(max-width: 768px)');
      expect(result.rules[2].sourceOrder).toBe(2);

      expect(result.rules[3].selector).toBe('.sidebar');
      expect(result.rules[3].mediaQuery).toBe('screen and (min-width: 1024px)');
      expect(result.rules[3].sourceOrder).toBe(3);
    });

    it('inherits defaultMediaQuery from enclosing context (e.g. <style media="...">)', () => {
      const css = `
        body { font-size: 14px; }
        @media (orientation: portrait) {
          body { font-size: 12px; }
        }
      `;

      const result = parseCssString(css, 0, undefined, '(max-width: 600px)');

      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].mediaQuery).toBe('(max-width: 600px)');
      expect(result.rules[1].mediaQuery).toBe('(max-width: 600px) and (orientation: portrait)');
    });

    it('extracts :root and html custom properties (--* CSS variables) into a dictionary', () => {
      const css = `
        :root {
          --primary-color: #ff0000;
          --font-size: 16px;
          color: #333333;
        }
        html {
          --line-height: 1.5;
        }
        :root, html {
          --border-radius: 4px;
        }
        .card {
          --scoped-var: 10px;
          padding: var(--scoped-var);
        }
      `;

      const result = parseCssString(css);

      expect(result.customProperties).toEqual({
        '--primary-color': '#ff0000',
        '--font-size': '16px',
        '--line-height': '1.5',
        '--border-radius': '4px',
      });
      // Non-root custom property is not in top-level customProperties dictionary
      expect(result.customProperties['--scoped-var']).toBeUndefined();

      // But .card rule still retains its declarations
      const cardRule = result.rules.find((r) => r.selector === '.card');
      expect(cardRule?.declarations).toEqual([
        { property: '--scoped-var', value: '10px', important: false },
        { property: 'padding', value: 'var(--scoped-var)', important: false },
      ]);
    });

    it('preserves source order offset and updates nextSourceOrder accurately', () => {
      const css1 = 'h1 { color: red; } h2 { color: blue; }';
      const r1 = parseCssString(css1, 10);
      expect(r1.rules[0].sourceOrder).toBe(10);
      expect(r1.rules[1].sourceOrder).toBe(11);
      expect(r1.nextSourceOrder).toBe(12);

      const css2 = 'h3 { color: green; }';
      const r2 = parseCssString(css2, r1.nextSourceOrder);
      expect(r2.rules[0].sourceOrder).toBe(12);
      expect(r2.nextSourceOrder).toBe(13);
    });

    it('handles empty, whitespace, and non-string inputs gracefully', () => {
      expect(parseCssString('')).toEqual({ rules: [], customProperties: {}, nextSourceOrder: 0 });
      expect(parseCssString('   \n\t  ', 5)).toEqual({ rules: [], customProperties: {}, nextSourceOrder: 5 });
      // @ts-expect-error Testing invalid runtime input
      expect(parseCssString(null)).toEqual({ rules: [], customProperties: {}, nextSourceOrder: 0 });
    });
  });

  describe('Security and Validation', () => {
    it('detects and drops @import rules, recording CSS_UNSUPPORTED_PROPERTY diagnostic', () => {
      const report = createEmptyReport();
      const css = `
        @import url("https://malicious.com/evil.css");
        @import "theme.css" screen;
        h1 {
          color: red;
        }
      `;

      const result = parseCssString(css, 0, report);

      // Only the h1 rule should survive
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].selector).toBe('h1');

      const importDiags = report.diagnostics.filter(
        (d) => d.code === 'CSS_UNSUPPORTED_PROPERTY' && d.message.includes('@import is not supported'),
      );
      expect(importDiags).toHaveLength(2);
      expect(importDiags[0].severity).toBe('warning');
    });

    it('detects and drops dangerous CSS expressions (expression(...)) and emits diagnostic', () => {
      const report = createEmptyReport();
      const css = `
        .box {
          color: green;
          width: expression(document.body.clientWidth > 500 ? "500px" : "auto");
          margin: 10px;
        }
      `;

      const result = parseCssString(css, 0, report);

      expect(result.rules).toHaveLength(1);
      const decls = result.rules[0].declarations;
      expect(decls).toEqual([
        { property: 'color', value: 'green', important: false },
        { property: 'margin', value: '10px', important: false },
      ]);

      const diag = report.diagnostics.find((d) => d.code === 'CSS_UNSUPPORTED_PROPERTY');
      expect(diag).toBeDefined();
      expect(diag?.message).toContain('Dangerous CSS property or value dropped');
      expect(diag?.details).toMatchObject({
        property: 'width',
        selector: '.box',
      });
    });

    it('detects and drops url(javascript:...) with URL_BLOCKED diagnostic', () => {
      const report = createEmptyReport();
      const css = `
        a.evil {
          background-image: url(javascript:alert(1));
          color: red;
        }
      `;

      const result = parseCssString(css, 0, report);

      expect(result.rules[0].declarations).toEqual([
        { property: 'color', value: 'red', important: false },
      ]);

      const diag = report.diagnostics.find((d) => d.code === 'URL_BLOCKED');
      expect(diag).toBeDefined();
      expect(diag?.details).toMatchObject({
        property: 'background-image',
      });
    });

    it('detects and drops legacy dangerous properties: behavior and -moz-binding', () => {
      const report = createEmptyReport();
      const css = `
        .htc {
          behavior: url(pngfix.htc);
          -moz-binding: url(xbl.xml#test);
          binding: url(foo.xml);
          -ms-behavior: url(bar.htc);
          display: block;
        }
      `;

      const result = parseCssString(css, 0, report);

      expect(result.rules[0].declarations).toEqual([
        { property: 'display', value: 'block', important: false },
      ]);

      const propDiags = report.diagnostics.filter((d) => d.code === 'CSS_UNSUPPORTED_PROPERTY');
      expect(propDiags.length).toBeGreaterThanOrEqual(4);
    });

    it('detects obfuscated attacks using CSS comments and hex escapes', () => {
      const report = createEmptyReport();
      const css = `
        .comment-attack {
          background: java/*comment*/script:alert(1);
        }
        .escape-attack {
          background: \\6a avascript:alert(1);
        }
        .html-data-attack {
          background: url("data:text/html,<script>alert(1)</script>");
        }
      `;

      const result = parseCssString(css, 0, report);

      for (const rule of result.rules) {
        expect(rule.declarations).toEqual([]);
      }
      expect(report.diagnostics.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Malformed CSS Resilience', () => {
    it('survives broken braces and unclosed rules without throwing', () => {
      const report = createEmptyReport();
      const malformedCss = `
        h1 { color: red
        .btn { padding: 10px; }
        broken { ;;; }}}
        h2 { font-size: 20px; }
      `;

      expect(() => {
        const result = parseCssString(malformedCss, 0, report);
        expect(result.rules.length).toBeGreaterThan(0);
        expect(result.rules.some((r) => r.selector === 'h2')).toBe(true);
      }).not.toThrow();
    });

    it('survives random garbage tokens and unbalanced structures', () => {
      const garbage = '}{}{}{ @#$%^&* ()!! @media (broken { p { color: blue; } }';
      expect(() => {
        const result = parseCssString(garbage);
        expect(Array.isArray(result.rules)).toBe(true);
      }).not.toThrow();
    });
  });

  describe('collectAndParseStylesheets', () => {
    it('preserves source order across multiple <style> tags and options.stylesheets', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              h1 { color: red; }
              h2 { color: blue; }
            </style>
          </head>
          <body>
            <div>Hello</div>
            <style>
              h3 { color: green; }
            </style>
          </body>
        </html>
      `;

      const parsedDoc = parseHtml(html).document!;
      const result = await collectAndParseStylesheets(parsedDoc, {
        stylesheets: [
          'h4 { color: yellow; }',
          'h5 { color: purple; }',
        ],
      });

      expect(result.rules).toHaveLength(5);
      expect(result.rules.map((r) => ({ selector: r.selector, sourceOrder: r.sourceOrder }))).toEqual([
        { selector: 'h1', sourceOrder: 0 },
        { selector: 'h2', sourceOrder: 1 },
        { selector: 'h3', sourceOrder: 2 },
        { selector: 'h4', sourceOrder: 3 },
        { selector: 'h5', sourceOrder: 4 },
      ]);
    });

    it('interleaves <link rel="stylesheet"> and <style> tags in document DOM order', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/first.css" />
            <style>
              .mid { color: gray; }
            </style>
            <link rel="stylesheet" href="/second.css" />
          </head>
          <body>
            <style>
              .last { color: black; }
            </style>
          </body>
        </html>
      `;

      const fetchStylesheet = vi.fn(async (url: string) => {
        if (url.endsWith('/first.css')) {
          return '.first { color: red; }';
        }
        if (url.endsWith('/second.css')) {
          return '.second { color: blue; }';
        }
        return null;
      });

      const parsedDoc = parseHtml(html).document!;
      const result = await collectAndParseStylesheets(parsedDoc, { fetchStylesheet });

      expect(fetchStylesheet).toHaveBeenCalledTimes(2);
      expect(result.rules.map((r) => ({ selector: r.selector, sourceOrder: r.sourceOrder }))).toEqual([
        { selector: '.first', sourceOrder: 0 },
        { selector: '.mid', sourceOrder: 1 },
        { selector: '.second', sourceOrder: 2 },
        { selector: '.last', sourceOrder: 3 },
      ]);
    });

    it('handles <link rel="stylesheet"> when fetchStylesheet is missing (records ASSET_UNRESOLVED, does not fail)', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="https://cdn.example.com/missing.css" />
            <style>
              p { color: red; }
            </style>
          </head>
        </html>
      `;

      const report = createEmptyReport();
      const parsedDoc = parseHtml(html).document!;
      const result = await collectAndParseStylesheets(parsedDoc, undefined, report);

      // Does not throw and still parses inline styles
      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].selector).toBe('p');

      const diag = report.diagnostics.find((d) => d.code === 'ASSET_UNRESOLVED');
      expect(diag).toBeDefined();
      expect(diag?.severity).toBe('warning');
      expect(diag?.location?.path).toBe('https://cdn.example.com/missing.css');
      expect(diag?.location?.tagName).toBe('link');
    });

    it('handles fetchStylesheet returning null or throwing error gracefully without crashing', async () => {
      const html = `
        <link rel="stylesheet" href="/broken-1.css" />
        <link rel="stylesheet" href="/broken-2.css" />
      `;

      const report = createEmptyReport();
      const parsedDoc = parseHtml(html).document!;
      const fetchStylesheet = vi.fn(async (url: string) => {
        if (url.includes('broken-1')) {
          return null; // not found
        }
        throw new Error('Network timeout');
      });

      const result = await collectAndParseStylesheets(parsedDoc, { fetchStylesheet }, report);

      expect(result.rules).toEqual([]);
      const diags = report.diagnostics.filter((d) => d.code === 'ASSET_UNRESOLVED');
      expect(diags).toHaveLength(2);
      expect(diags[0].message).toContain('could not be resolved');
      expect(diags[1].message).toContain('Failed to fetch stylesheet');
      expect(diags[1].details?.error).toContain('Network timeout');
    });

    it('resolves relative stylesheet hrefs with options.baseUrl', async () => {
      const html = '<link rel="stylesheet" href="css/style.css" />';
      const fetchStylesheet = vi.fn(async (url: string) => {
        expect(url).toBe('https://example.com/site/css/style.css');
        return 'body { background: #fff; }';
      });

      const parsedDoc = parseHtml(html).document!;
      const result = await collectAndParseStylesheets(parsedDoc, {
        baseUrl: 'https://example.com/site/',
        fetchStylesheet,
      });

      expect(fetchStylesheet).toHaveBeenCalledWith('https://example.com/site/css/style.css');
      expect(result.rules).toHaveLength(1);
    });

    it('supports URL entries in options.stylesheets with fetchStylesheet', async () => {
      const report = createEmptyReport();
      const fetchStylesheet = vi.fn(async (url: string) => {
        if (url === 'https://example.com/extra.css') {
          return '.extra { font-weight: bold; }';
        }
        return null;
      });

      const parsedDoc = parseHtml('<div>Plain HTML</div>').document!;
      const result = await collectAndParseStylesheets(
        parsedDoc,
        {
          stylesheets: ['https://example.com/extra.css', 'https://example.com/not-found.css'],
          fetchStylesheet,
        },
        report,
      );

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].selector).toBe('.extra');
      expect(report.diagnostics.some((d) => d.code === 'ASSET_UNRESOLVED')).toBe(true);
    });

    it('aggregates :root custom properties across multiple stylesheets in cascade order', async () => {
      const html = `
        <style>
          :root {
            --primary: red;
            --secondary: green;
          }
        </style>
      `;

      const parsedDoc = parseHtml(html).document!;
      const result = await collectAndParseStylesheets(parsedDoc, {
        stylesheets: [
          ':root { --primary: blue; --accent: yellow; }',
        ],
      });

      // Later stylesheet overwrites --primary: blue
      expect(result.customProperties).toEqual({
        '--primary': 'blue',
        '--secondary': 'green',
        '--accent': 'yellow',
      });
    });

    it('works when parsedDoc is a mocked object without rootElement', async () => {
      const mockDoc: ParsedHtmlDocument = {
        isFragment: false,
        styles: [{ content: 'h1 { color: red; }' }],
        stylesheetUrls: ['https://cdn.example.com/theme.css'],
        rootElement: null as unknown as ParsedHtmlDocument['rootElement'],
      };

      const fetchStylesheet = vi.fn(async () => 'h2 { color: blue; }');
      const result = await collectAndParseStylesheets(mockDoc, { fetchStylesheet });

      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].selector).toBe('h2'); // from stylesheetUrls
      expect(result.rules[1].selector).toBe('h1'); // from styles
    });
  });

  describe('Helper Utilities', () => {
    it('isDangerousDeclaration checks property and value', () => {
      expect(isDangerousDeclaration('color', 'red')).toBe(false);
      expect(isDangerousDeclaration('behavior', 'url(test.htc)')).toBe(true);
      expect(isDangerousDeclaration('-moz-binding', 'url(test.xml)')).toBe(true);
      expect(isDangerousDeclaration('background', 'expression(alert(1))')).toBe(true);
      expect(isDangerousDeclaration('background-image', 'url(javascript:alert(1))')).toBe(true);
    });

    it('isRootOrHtmlSelector accurately matches root selectors', () => {
      expect(isRootOrHtmlSelector(':root')).toBe(true);
      expect(isRootOrHtmlSelector('html')).toBe(true);
      expect(isRootOrHtmlSelector(':root, html')).toBe(true);
      expect(isRootOrHtmlSelector('html, body')).toBe(true);
      expect(isRootOrHtmlSelector('body')).toBe(false);
      expect(isRootOrHtmlSelector('.card')).toBe(false);
    });

    it('isUrlLike identifies URLs vs CSS snippets', () => {
      expect(isUrlLike('https://example.com/style.css')).toBe(true);
      expect(isUrlLike('http://example.com/style.css')).toBe(true);
      expect(isUrlLike('/assets/main.css')).toBe(true);
      expect(isUrlLike('./styles.css')).toBe(true);
      expect(isUrlLike('theme.css')).toBe(true);
      expect(isUrlLike('body { color: red; }')).toBe(false);
      expect(isUrlLike('.btn { display: flex; }')).toBe(false);
    });

    it('resolveStylesheetHref handles relative and absolute URLs', () => {
      expect(resolveStylesheetHref('https://cdn.example.com/a.css', 'https://example.com/')).toBe(
        'https://cdn.example.com/a.css',
      );
      expect(resolveStylesheetHref('a.css', 'https://example.com/sub/')).toBe(
        'https://example.com/sub/a.css',
      );
      expect(resolveStylesheetHref('/a.css', 'https://example.com/sub/')).toBe(
        'https://example.com/a.css',
      );
      expect(resolveStylesheetHref('a.css')).toBe('a.css');
    });
  });
});
