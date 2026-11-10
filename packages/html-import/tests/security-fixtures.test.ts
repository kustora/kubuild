/**
 * @kubuild/html-import
 * Security fixture suite (STORA-620): XSS via attributes/URLs/SVG, embeds, CSS injection,
 * pathological nesting, huge node counts and oversized input. Every fixture must either be
 * rejected cleanly (never throw) or produce a sanitized document that passes
 * `validateDocumentSecurity` and contains no executable markers.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCUMENT_SECURITY_LIMITS } from '@kubuild/core';
import {
  DEFAULT_MAX_DOCUMENT_SIZE_BYTES,
  MAX_HTML_NESTING_DEPTH,
  importHtml,
  type HtmlImportResult,
  type PageNode,
} from '../src/index.js';
import {
  diagnosticCounts,
  expectSafeDocument,
  maxTreeDepth,
  readFixture,
  summarizeImport,
  walkNodes,
} from './fixture-helpers.js';

const IMPORT_OPTIONS = { baseUrl: 'https://site.example.com/' } as const;

async function importFixture(name: string): Promise<HtmlImportResult> {
  return importHtml(readFixture('security', name), IMPORT_OPTIONS);
}

function collectNodes(result: HtmlImportResult): PageNode[] {
  const nodes: PageNode[] = [];
  walkNodes(result.document!.document as PageNode, (node) => nodes.push(node));
  return nodes;
}

function wrapBody(body: string): string {
  return `<!DOCTYPE html><html><head><title>Generated</title></head><body>${body}</body></html>`;
}

describe('security fixtures (STORA-620)', () => {
  describe('file fixtures are sanitized and pass validateDocumentSecurity', () => {
    it.each([
      'xss-attributes.html',
      'xss-urls.html',
      'xss-svg.html',
      'embeds.html',
      'css-injection.html',
    ])('%s', async (name) => {
      const result = await importFixture(name);
      expectSafeDocument(result);
      expect(summarizeImport(result)).toMatchSnapshot();
    });
  });

  it('strips event handlers, srcdoc and formaction while keeping safe content', async () => {
    const result = await importFixture('xss-attributes.html');
    expectSafeDocument(result);

    const blocked = result.report.diagnostics
      .filter((d) => d.code === 'URL_BLOCKED')
      .map((d) => String(d.details?.attribute).toLowerCase());
    expect(blocked).toEqual(
      expect.arrayContaining(['onload', 'onclick', 'onerror', 'srcdoc', 'formaction', 'poster']),
    );

    const nodes = collectNodes(result);
    expect(nodes.find((n) => n.type === 'heading')?.props.text).toBe('Event handlers everywhere');
    expect(nodes.find((n) => n.type === 'form')?.props.action).toBe(
      'https://site.example.com/subscribe',
    );
  });

  it('neutralises every javascript:/vbscript:/data:text/html URL variant', async () => {
    const result = await importFixture('xss-urls.html');
    expectSafeDocument(result);

    const links = collectNodes(result).filter((n) => n.type === 'link');
    const hrefByText = Object.fromEntries(links.map((l) => [l.props.text, l.props.href]));
    // 12 attack variants are neutralised to "#"; safe schemes are preserved.
    expect(links.filter((l) => l.props.href === '#')).toHaveLength(12);
    expect(hrefByText['Safe link']).toBe('https://site.example.com/safe');
    expect(hrefByText['Relative link']).toBe('/relative/path');
    expect(hrefByText['Mail']).toBe('mailto:hello@example.com');

    // <base>, meta http-equiv and non-stylesheet/unsafe <link> are dropped.
    const droppedTags = result.report.diagnostics
      .filter((d) => d.code === 'ELEMENT_DROPPED')
      .map((d) => d.location?.tagName);
    expect(droppedTags).toEqual(expect.arrayContaining(['base', 'meta', 'link']));
  });

  it('removes SVG scripts, handlers, foreignObject, animations and unsafe SVG <style>', async () => {
    const result = await importFixture('xss-svg.html');
    expectSafeDocument(result);

    const icons = collectNodes(result).filter((n) => n.type === 'icon');
    expect(icons).toHaveLength(2);
    const svgMarkup = icons.map((i) => String(i.props.svg)).join('\n');
    expect(svgMarkup).not.toMatch(
      /<script|<foreignobject|<animate|<set|<style|xlink:href="javascript/i,
    );
    expect(svgMarkup).toContain('<circle');
    expect(collectNodes(result).some((n) => n.props.text === 'Text after SVG stays.')).toBe(true);
  });

  it('drops object/embed/applet/frame/template/noscript/script elements', async () => {
    const result = await importFixture('embeds.html');
    expectSafeDocument(result);

    const droppedTags = new Set(
      result.report.diagnostics
        .filter((d) => d.code === 'ELEMENT_DROPPED')
        .map((d) => d.location?.tagName?.toLowerCase()),
    );
    for (const tag of ['object', 'embed', 'applet', 'template', 'noscript', 'script']) {
      expect(droppedTags).toContain(tag);
    }
    expect(collectNodes(result).some((n) => n.props.text === 'Visible paragraph.')).toBe(true);
  });

  it('drops injected CSS in <style> and style="" but keeps safe declarations', async () => {
    const result = await importFixture('css-injection.html');
    expectSafeDocument(result);

    const nodes = collectNodes(result);
    const stylesOf = (text: string) => {
      const index = nodes.findIndex((n) => n.props.text === text);
      // Styled wrappers become a container whose only child is the text span.
      const parent = nodes.find((n) => n.children?.some((c) => c === nodes[index]));
      return parent?.type === 'page' ? nodes[index].styles?.base : parent?.styles?.base;
    };
    expect(stylesOf('Rule a')).toEqual({ color: 'red' });
    expect(stylesOf('Rule b')).toEqual({ padding: '8px' });
    expect(stylesOf('Rule d')).toEqual({ fontWeight: '700' });
    expect(stylesOf('Rule g')).toEqual({ height: '10px' });
    expect(stylesOf('Rule k')).toEqual({ scrollBehavior: 'smooth', fontSize: '18px' });
    expect(stylesOf('Inline case 9')).toEqual({ padding: '12px', color: '#333' });

    // @import rules are reported, never applied.
    expect(result.report.diagnostics.some((d) => /@import/i.test(d.message))).toBe(true);
  });

  it('drops an unsafe <style> nested in a fallback html-embed', async () => {
    const result = await importHtml(
      wrapBody(
        '<x-widget><style>@import url(https://evil.example.com/a.css); .q{color:red}</style><b>hi</b></x-widget>' +
          '<marquee><style>.z{background:url(javascript:alert(1))}</style>scrolling</marquee>',
      ),
      IMPORT_OPTIONS,
    );
    expectSafeDocument(result);

    const embeds = collectNodes(result).filter((n) => n.type === 'html-embed');
    expect(embeds.map((e) => e.props.html)).toEqual([
      '<x-widget><b>hi</b></x-widget>',
      '<marquee>scrolling</marquee>',
    ]);
  });

  it('keeps a safe SVG <style> (e.g. Illustrator class rules)', async () => {
    const result = await importHtml(
      wrapBody('<svg viewBox="0 0 10 10"><style>.st0{fill:#fff}</style><rect class="st0"/></svg>'),
      IMPORT_OPTIONS,
    );
    expectSafeDocument(result);
    const icon = collectNodes(result).find((n) => n.type === 'icon');
    expect(icon?.props.svg).toContain('<style>.st0{fill:#fff}</style>');
  });

  describe('resource exhaustion', () => {
    it('collapses several hundred levels of wrapper nesting without throwing', async () => {
      const result = await importHtml(
        wrapBody(`${'<div>'.repeat(400)}deep text${'</div>'.repeat(400)}`),
        IMPORT_OPTIONS,
      );
      const document = expectSafeDocument(result);
      expect(maxTreeDepth(document)).toBeLessThanOrEqual(
        DEFAULT_DOCUMENT_SECURITY_LIMITS.maxTreeDepth,
      );
      expect(JSON.stringify(document)).toContain('deep text');
    });

    it('flattens several hundred levels of meaningful nesting to the depth limit', async () => {
      const levels = 300;
      const result = await importHtml(
        wrapBody(`${'<section><p>level</p>'.repeat(levels)}${'</section>'.repeat(levels)}`),
        { ...IMPORT_OPTIONS, limits: { maxNodeCount: 5000 } },
      );
      const document = expectSafeDocument(result);
      expect(maxTreeDepth(document)).toBeLessThanOrEqual(
        DEFAULT_DOCUMENT_SECURITY_LIMITS.maxTreeDepth,
      );
      expect(diagnosticCounts(result).DEPTH_FLATTENED).toBeGreaterThanOrEqual(1);
      // Flattening keeps content: every paragraph survives.
      expect(collectNodes(result).filter((n) => n.props.text === 'level')).toHaveLength(levels);
    });

    it('rejects pathological nesting (thousands of levels) cleanly instead of overflowing', async () => {
      const levels = 5000;
      const html = wrapBody(`${'<div>'.repeat(levels)}x${'</div>'.repeat(levels)}`);

      const result = await importHtml(html, IMPORT_OPTIONS);

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toContain(`maximum supported depth of ${MAX_HTML_NESTING_DEPTH}`);
      expect(diagnosticCounts(result)).toEqual({ LIMIT_EXCEEDED: 1 });
    });

    it('rejects tens of thousands of nodes with LIMIT_EXCEEDED without throwing', async () => {
      const result = await importHtml(
        wrapBody(`<ul>${'<li>item</li>'.repeat(20_000)}</ul>`),
        IMPORT_OPTIONS,
      );

      expect(result.success).toBe(false);
      expect(result.document).toBeUndefined();
      expect(result.error).toMatch(/Node count limit exceeded/);
      expect(result.report.diagnostics.some((d) => d.code === 'LIMIT_EXCEEDED')).toBe(true);
    });

    it('rejects input above maxDocumentSizeBytes before parsing', async () => {
      const filler = '<p>padding</p>'.repeat(Math.ceil(DEFAULT_MAX_DOCUMENT_SIZE_BYTES / 14) + 1);
      const result = await importHtml(wrapBody(filler), IMPORT_OPTIONS);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Input size limit exceeded/);
      expect(diagnosticCounts(result)).toEqual({ LIMIT_EXCEEDED: 1 });
      // Rejected before parsing: no nodes were produced or sanitized.
      expect(result.report.stats.nodeCount).toBe(0);
    });

    it('honours a custom maxDocumentSizeBytes limit (multi-byte input counted in bytes)', async () => {
      const html = wrapBody(`<p>${'é'.repeat(600)}</p>`);
      const result = await importHtml(html, {
        ...IMPORT_OPTIONS,
        limits: { maxDocumentSizeBytes: 1000 },
      });

      expect(html.length).toBeLessThan(1000);
      expect(result.success).toBe(false);
      expect(diagnosticCounts(result)).toEqual({ LIMIT_EXCEEDED: 1 });
    });
  });
});
