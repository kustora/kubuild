import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  BREAKPOINTS,
  BREAKPOINT_MEDIA_QUERIES,
  getBreakpointForWidth,
  type PageDocument,
  type Node,
} from '@kubuild/schema';
import { KubuildRenderer, resolveResponsiveMode } from '../src/renderer';
import {
  collectResponsiveStylesCss,
  resolveNodeStyles,
  resolveResponsiveStyleLayers,
} from '../src/styles';
import { generateDocumentCss } from '../src/code-generator';

function makeDoc(children: Node[]): PageDocument {
  return {
    schema: 'stora.page',
    version: '1.0.0',
    document: { id: 'root', type: 'page', children },
  } as PageDocument;
}

/** Multi-breakpoint fixture exercising every layer, normalization and states. */
const multiBreakpointDoc = makeDoc([
  {
    id: 'hero',
    type: 'section',
    styles: {
      base: { display: 'flex', flexDirection: 'row', padding: '64px', gap: 24 },
      desktop: { padding: '96px' },
      tablet: { padding: '40px' },
      mobile: { flexDirection: 'column', padding: 16, gap: 12 },
      states: { ':hover': { backgroundColor: '#1e293b' } },
    },
    children: [
      {
        id: 'grid-1',
        type: 'container',
        styles: {
          base: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' },
          tablet: { gridTemplateColumns: 'repeat(2, 1fr)' },
          mobile: { gridTemplateColumns: '1fr' },
        },
        children: [
          {
            id: 'card-1',
            type: 'container',
            styles: {
              base: { width: 'fill', borderRadius: 12 },
              mobile: { width: '100%', fontSize: 14, fontWeight: 600 },
            },
          },
        ],
      },
    ],
  },
]);

/** Minimal evaluator for the `(min-width)`/`(max-width)` queries BREAKPOINTS produces. */
function mediaMatches(query: string, width: number): boolean {
  return query.split(' and ').every((part) => {
    const min = part.match(/\(min-width:\s*([\d.]+)px\)/);
    if (min) return width >= Number(min[1]);
    const max = part.match(/\(max-width:\s*([\d.]+)px\)/);
    if (max) return width <= Number(max[1]);
    throw new Error(`unsupported media query part: ${part}`);
  });
}

/** Parse a stylesheet into `{ mediaQuery: { nodeId: { property: value } } }`. */
function parseResponsiveCss(
  css: string,
  selectorToId: (selector: string) => string | null,
): Record<string, Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, Record<string, string>>> = {};
  const mediaRe = /@media ([^{]+)\{([\s\S]*?)\n\}/g;
  let media: RegExpExecArray | null;
  while ((media = mediaRe.exec(css))) {
    const query = media[1].trim();
    const ruleRe = /([^{}]+)\{([^}]*)\}/g;
    let rule: RegExpExecArray | null;
    while ((rule = ruleRe.exec(media[2]))) {
      const id = selectorToId(rule[1].trim());
      if (!id) continue;
      const decls: Record<string, string> = {};
      for (const decl of rule[2].split(';')) {
        const idx = decl.indexOf(':');
        if (idx === -1) continue;
        decls[decl.slice(0, idx).trim()] = decl
          .slice(idx + 1)
          .replace('!important', '')
          .trim();
      }
      result[query] ??= {};
      result[query][id] = decls;
    }
  }
  return result;
}

const runtimeSelectorToId = (selector: string) =>
  selector.match(/^\[data-kubuild-node="([^"]+)"\]$/)?.[1] ?? null;
const exportSelectorToId = (selector: string) => selector.match(/^\.kb-node-(.+)$/)?.[1] ?? null;

describe('STORA-541: shared BREAKPOINTS', () => {
  it('defines disjoint ranges mobile <768, tablet 768–1023, desktop ≥1024', () => {
    expect(BREAKPOINTS).toEqual({
      mobile: { minWidth: 0, maxWidth: 767 },
      tablet: { minWidth: 768, maxWidth: 1023 },
      desktop: { minWidth: 1024, maxWidth: null },
    });
    expect(BREAKPOINT_MEDIA_QUERIES).toEqual({
      desktop: '(min-width: 1024px)',
      tablet: '(min-width: 768px) and (max-width: 1023.98px)',
      mobile: '(max-width: 767.98px)',
    });
  });

  it('maps widths to exactly one breakpoint, consistent with the media queries', () => {
    for (const [width, expected] of [
      [320, 'mobile'],
      [767, 'mobile'],
      [767.5, 'mobile'],
      [768, 'tablet'],
      [1023, 'tablet'],
      [1023.9, 'tablet'],
      [1024, 'desktop'],
      [1920, 'desktop'],
    ] as const) {
      expect(getBreakpointForWidth(width)).toBe(expected);
      const matching = (['desktop', 'tablet', 'mobile'] as const).filter((bp) =>
        mediaMatches(BREAKPOINT_MEDIA_QUERIES[bp], width),
      );
      expect(matching).toEqual([expected]);
    }
  });
});

describe('STORA-540: runtime responsive CSS', () => {
  const originalWindow = (globalThis as Record<string, unknown>).window;
  afterEach(() => {
    (globalThis as Record<string, unknown>).window = originalWindow;
  });

  it('defaults to css for runtime without viewport, viewport otherwise', () => {
    expect(resolveResponsiveMode(undefined, 'runtime', undefined)).toBe('css');
    expect(resolveResponsiveMode(undefined, 'runtime', 'mobile')).toBe('viewport');
    expect(resolveResponsiveMode(undefined, 'editor', undefined)).toBe('viewport');
    expect(resolveResponsiveMode('css', 'editor', 'tablet')).toBe('css');
    expect(resolveResponsiveMode('viewport', 'runtime', undefined)).toBe('viewport');
  });

  it('switches mobile gridTemplateColumns below 768px without a viewport prop', () => {
    const html = renderToString(<KubuildRenderer document={multiBreakpointDoc} mode="runtime" />);

    // Inline style carries base only
    expect(html).toContain('grid-template-columns:repeat(3, 1fr)');
    expect(html).not.toContain('grid-template-columns:1fr');

    const styleMatch = html.match(/<style data-kubuild-responsive-styles[^>]*>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    const parsed = parseResponsiveCss(styleMatch![1], runtimeSelectorToId);

    const effective = (width: number) => {
      let value = 'repeat(3, 1fr)'; // inline base
      for (const [query, rules] of Object.entries(parsed)) {
        const v = rules['grid-1']?.['grid-template-columns'];
        if (v && mediaMatches(query, width)) value = v;
      }
      return value;
    };
    expect(effective(375)).toBe('1fr');
    expect(effective(767)).toBe('1fr');
    expect(effective(768)).toBe('repeat(2, 1fr)');
    expect(effective(1023)).toBe('repeat(2, 1fr)');
    expect(effective(1024)).toBe('repeat(3, 1fr)');
    expect(effective(1440)).toBe('repeat(3, 1fr)');
  });

  it('reproduces viewport-mode styles at every width', () => {
    const walk = (node: Node): Node[] => [node, ...(node.children ?? []).flatMap(walk)];
    const css = collectResponsiveStylesCss(multiBreakpointDoc);
    const parsed = parseResponsiveCss(css, runtimeSelectorToId);
    const toKebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const unitless = new Set(['fontWeight', 'lineHeight', 'opacity', 'zIndex', 'flex', 'order']);
    const toCss = (k: string, v: unknown) =>
      typeof v === 'number' && v !== 0 && !unitless.has(k) ? `${v}px` : String(v);

    for (const node of walk(multiBreakpointDoc.document)) {
      const { base } = resolveResponsiveStyleLayers(node.styles);
      for (const [width, viewport] of [
        [375, 'mobile'],
        [900, 'tablet'],
        [1280, 'desktop'],
      ] as const) {
        const effective: Record<string, string> = {};
        for (const [k, v] of Object.entries(base)) effective[toKebab(k)] = toCss(k, v);
        for (const [query, rules] of Object.entries(parsed)) {
          if (!mediaMatches(query, width)) continue;
          for (const [k, v] of Object.entries(rules[node.id] ?? {})) {
            if (v === 'unset') delete effective[k];
            else effective[k] = v;
          }
        }
        const expected: Record<string, string> = {};
        for (const [k, v] of Object.entries(resolveNodeStyles(node.styles, viewport))) {
          if (v === undefined || v === null || v === '') continue;
          expected[toKebab(k)] = toCss(k, v);
        }
        expect({ node: node.id, width, style: effective }).toEqual({
          node: node.id,
          width,
          style: expected,
        });
      }
    }
  });

  it('resets properties the breakpoint merge drops, and suffixes numeric px', () => {
    const { overrides } = resolveResponsiveStyleLayers({
      base: { width: 'fill' },
      mobile: { width: '200px' },
    });
    expect(overrides.mobile).toEqual({ width: '200px', flex: 'unset' });

    const css = collectResponsiveStylesCss(
      makeDoc([
        { id: 'n', type: 'text', styles: { base: {}, mobile: { fontSize: 28, lineHeight: 1.2 } } },
      ]),
    );
    expect(css).toContain('font-size: 28px !important;');
    expect(css).toContain('line-height: 1.2 !important;');
  });

  it('keeps viewport mode for the editor canvas and explicit viewport previews', () => {
    const editorHtml = renderToString(
      <KubuildRenderer document={multiBreakpointDoc} mode="editor" viewport="mobile" />,
    );
    expect(editorHtml).not.toContain('data-kubuild-responsive-styles');
    expect(editorHtml).toContain('grid-template-columns:1fr');

    const previewHtml = renderToString(
      <KubuildRenderer document={multiBreakpointDoc} mode="runtime" viewport="tablet" />,
    );
    expect(previewHtml).not.toContain('data-kubuild-responsive-styles');
    expect(previewHtml).toContain('grid-template-columns:repeat(2, 1fr)');
  });

  it('is SSR-deterministic: markup does not depend on window size', () => {
    const serverHtml = renderToString(<KubuildRenderer document={multiBreakpointDoc} />);
    (globalThis as Record<string, unknown>).window = {
      innerWidth: 375,
      matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    };
    const clientLikeHtml = renderToString(<KubuildRenderer document={multiBreakpointDoc} />);
    expect(clientLikeHtml).toBe(serverHtml);
  });

  it('emits no responsive stylesheet when no node has breakpoint layers', () => {
    const html = renderToString(
      <KubuildRenderer
        document={makeDoc([{ id: 'a', type: 'text', styles: { base: { color: 'red' } } }])}
      />,
    );
    expect(html).not.toContain('data-kubuild-responsive-styles');
  });
});

describe('STORA-542: runtime CSS matches code generator output', () => {
  it('emits the same overrides under the same media queries', () => {
    const runtimeCss = collectResponsiveStylesCss(multiBreakpointDoc);
    const exportCss = generateDocumentCss(multiBreakpointDoc, { includeReset: false });

    const runtime = parseResponsiveCss(runtimeCss, runtimeSelectorToId);
    const exported = parseResponsiveCss(exportCss, exportSelectorToId);
    expect(Object.keys(runtime).sort()).toEqual(Object.values(BREAKPOINT_MEDIA_QUERIES).sort());
    expect(exported).toEqual(runtime);

    expect(runtimeCss).toMatchSnapshot('runtime responsive css');
    expect(exportCss).toMatchSnapshot('code generator css');
  });

  it('uses the same base declarations inline as the exported base rule', () => {
    const html = renderToString(<KubuildRenderer document={multiBreakpointDoc} />);
    const exportCss = generateDocumentCss(multiBreakpointDoc, { includeReset: false });
    // hero base: padding 64px inline at runtime and in the exported base rule; 96px only ≥1024
    expect(html).toContain('padding:64px');
    expect(exportCss).toMatch(/\.kb-node-hero \{[^}]*padding: 64px;/);
    expect(exportCss).toMatch(
      /@media \(min-width: 1024px\) \{\n {2}\.kb-node-hero \{\n {4}padding: 96px;/,
    );
  });
});
