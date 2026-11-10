/**
 * @kubuild/html-import
 * Tailwind utility class mapper (STORA-622).
 */

import { describe, expect, it } from 'vitest';
import {
  buildTailwindStylesheet,
  createEmptyReport,
  importHtml,
  isDangerousDeclaration,
  parseHtml,
  sanitizeAst,
  serializeCssRules,
  type HtmlImportOptions,
  type PageNode,
} from '../src/index.js';
import {
  applyTailwindConfig,
  createDefaultTailwindTheme,
  mapTailwindClass,
  parseArbitraryValue,
  parseTailwindClass,
  parseTailwindConfigSource,
  resolveTailwindUtility,
} from '../src/tailwind.js';
import { readFixture } from './fixture-helpers.js';

function decls(utility: string): Record<string, string> | null {
  const resolved = resolveTailwindUtility(utility);
  return resolved ? Object.fromEntries(resolved.declarations) : null;
}

function findNode(nodes: PageNode[], predicate: (node: PageNode) => boolean): PageNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = findNode(node.children ?? [], predicate);
    if (found) return found;
  }
  return undefined;
}

function rootOf(result: Awaited<ReturnType<typeof importHtml>>): PageNode {
  expect(result.success, result.error).toBe(true);
  return result.document!.document as PageNode;
}

describe('resolveTailwindUtility', () => {
  it('maps spacing utilities with the default scale', () => {
    expect(decls('p-4')).toEqual({ padding: '1rem' });
    expect(decls('px-2.5')).toEqual({ 'padding-left': '0.625rem', 'padding-right': '0.625rem' });
    expect(decls('mt-px')).toEqual({ 'margin-top': '1px' });
    expect(decls('mx-auto')).toEqual({ 'margin-left': 'auto', 'margin-right': 'auto' });
    expect(decls('gap-x-6')).toEqual({ 'column-gap': '1.5rem' });
    expect(resolveTailwindUtility('mt-2', undefined, true)?.declarations).toEqual([
      ['margin-top', '-0.5rem'],
    ]);
    expect(resolveTailwindUtility('p-4', undefined, true)).toBeNull();
  });

  it('maps flex and grid utilities', () => {
    expect(decls('flex')).toEqual({ display: 'flex' });
    expect(decls('hidden')).toEqual({ display: 'none' });
    expect(decls('flex-col')).toEqual({ 'flex-direction': 'column' });
    expect(decls('items-center')).toEqual({ 'align-items': 'center' });
    expect(decls('justify-between')).toEqual({ 'justify-content': 'space-between' });
    expect(decls('flex-1')).toEqual({ flex: '1 1 0%' });
    expect(decls('grid-cols-3')).toEqual({
      'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
    });
    expect(decls('col-span-2')).toEqual({ 'grid-column': 'span 2 / span 2' });
    expect(decls('w-1/2')).toEqual({ width: '50%' });
    expect(decls('max-w-7xl')).toEqual({ 'max-width': '80rem' });
    expect(decls('min-h-screen')).toEqual({ 'min-height': '100vh' });
  });

  it('maps typography with paired line-heights, weights and colors', () => {
    expect(decls('text-5xl')).toEqual({ 'font-size': '3rem', 'line-height': '1' });
    expect(decls('text-sm')).toEqual({ 'font-size': '0.875rem', 'line-height': '1.25rem' });
    expect(decls('font-extrabold')).toEqual({ 'font-weight': '800' });
    expect(decls('text-center')).toEqual({ 'text-align': 'center' });
    expect(decls('text-gray-600')).toEqual({ color: '#4b5563' });
    expect(decls('leading-relaxed')).toEqual({ 'line-height': '1.625' });
    expect(decls('tracking-tight')).toEqual({ 'letter-spacing': '-0.025em' });
    expect(decls('uppercase')).toEqual({ 'text-transform': 'uppercase' });
  });

  it('maps colors including shades, specials and opacity modifiers', () => {
    expect(decls('bg-emerald-600')).toEqual({ 'background-color': '#059669' });
    expect(decls('bg-white')).toEqual({ 'background-color': '#ffffff' });
    expect(decls('bg-black/50')).toEqual({ 'background-color': 'rgb(0 0 0 / 0.5)' });
    expect(decls('border-gray-300')).toEqual({ 'border-color': '#d1d5db' });
    expect(decls('bg-gray-1000')).toBeNull();
  });

  it('maps borders, radius and shadows', () => {
    expect(decls('border')).toEqual({
      'border-width': '1px',
      'border-style': 'solid',
      'border-color': '#e5e7eb',
    });
    expect(decls('border-b-2')).toMatchObject({ 'border-bottom-width': '2px' });
    expect(decls('rounded-lg')).toEqual({ 'border-radius': '0.5rem' });
    expect(decls('rounded-full')).toEqual({ 'border-radius': '9999px' });
    expect(decls('rounded-t-xl')).toEqual({
      'border-top-left-radius': '0.75rem',
      'border-top-right-radius': '0.75rem',
    });
    expect(decls('shadow-md')).toEqual({
      'box-shadow': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    });
  });

  it('composes gradients through custom properties', () => {
    expect(decls('bg-gradient-to-r')).toEqual({
      'background-image': 'linear-gradient(to right, var(--tw-gradient-stops))',
    });
    expect(decls('from-blue-500')).toMatchObject({ '--tw-gradient-from': '#3b82f6' });
    expect(decls('to-purple-600')).toEqual({ '--tw-gradient-to': '#9333ea' });
  });

  it('accepts only safe arbitrary values', () => {
    expect(decls('p-[13px]')).toEqual({ padding: '13px' });
    expect(decls('bg-[#123456]')).toEqual({ 'background-color': '#123456' });
    expect(decls('text-[14px]')).toEqual({ 'font-size': '14px' });
    expect(decls('w-[calc(100%_-_2rem)]')).toEqual({ width: 'calc(100% - 2rem)' });
    expect(decls('border-[#fff]')).toEqual({ 'border-color': '#fff' });

    expect(parseArbitraryValue('[url(javascript:alert(1))]')).toBeNull();
    expect(parseArbitraryValue('[expression(alert(1))]')).toBeNull();
    expect(parseArbitraryValue('[red;background:url(x)]')).toBeNull();
    expect(parseArbitraryValue('[var(--x)]')).toBeNull();
    expect(decls('bg-[url(https://evil.example/x.png)]')).toBeNull();
    expect(decls('p-[red]')).toBeNull();
  });

  it('produces only values that pass the CSS safety checks', () => {
    const samples = [
      'p-4',
      'bg-[#123456]',
      'w-[calc(100%_-_2rem)]',
      'shadow-xl',
      'font-sans',
      'transition',
      'bg-gradient-to-br',
      'from-rose-400',
      'text-[1.5rem]',
      'rounded-[12px]',
    ];
    for (const utility of samples) {
      const resolved = resolveTailwindUtility(utility);
      expect(resolved, utility).not.toBeNull();
      for (const [property, value] of resolved!.declarations) {
        expect(isDangerousDeclaration(property, value), `${property}: ${value}`).toBe(false);
      }
    }
  });
});

describe('mapTailwindClass', () => {
  it('parses variants, important and negative prefixes', () => {
    expect(parseTailwindClass('md:hover:!-mt-[3px]')).toEqual({
      token: 'md:hover:!-mt-[3px]',
      variants: ['md', 'hover'],
      utility: 'mt-[3px]',
      important: true,
      negative: true,
    });
    expect(parseTailwindClass('bg-[#000]').variants).toEqual([]);
  });

  it('turns responsive prefixes into mobile-first min-width queries', () => {
    const mapping = mapTailwindClass('md:grid-cols-3');
    expect(mapping.ok).toBe(true);
    if (!mapping.ok) return;
    expect(mapping.rules[0]).toMatchObject({
      selector: '[class~="md:grid-cols-3"]',
      mediaQuery: '(min-width: 768px)',
    });
  });

  it('turns state prefixes into pseudo-classes', () => {
    const mapping = mapTailwindClass('hover:bg-emerald-600');
    expect(mapping.ok && mapping.rules[0].selector).toBe('[class~="hover:bg-emerald-600"]:hover');
  });

  it('rejects unsupported variants and unknown utilities with a reason', () => {
    expect(mapTailwindClass('dark:bg-black')).toMatchObject({ ok: false });
    expect(mapTailwindClass('group-hover:text-white')).toMatchObject({ ok: false });
    expect(mapTailwindClass('md:hover:bg-black')).toMatchObject({ ok: false });
    expect(mapTailwindClass('ring-2')).toMatchObject({ ok: false });
    expect(mapTailwindClass('[mask-type:luminance]')).toMatchObject({ ok: false });
  });
});

describe('tailwind.config (static subset)', () => {
  it('reads colors and fontFamily from a plain object literal', () => {
    const config = parseTailwindConfigSource(`
      tailwind.config = {
        theme: {
          extend: {
            colors: { primary: '#10b981', brand: { 500: '#ff0000', DEFAULT: '#00ff00' } },
            fontFamily: { display: ['Inter Tight', 'sans-serif'] },
            spacing: { 128: '32rem' },
          },
        },
      }`);
    expect(config).not.toBeNull();
    const theme = createDefaultTailwindTheme();
    const unsupported = applyTailwindConfig(theme, config!);
    expect(theme.colors.primary).toBe('#10b981');
    expect(theme.colors['brand-500']).toBe('#ff0000');
    expect(theme.colors.brand).toBe('#00ff00');
    expect(theme.colors['gray-50']).toBe('#f9fafb');
    expect(theme.fontFamily.display).toBe('"Inter Tight", sans-serif');
    expect(unsupported).toEqual(['theme.extend.spacing']);
  });

  it('never evaluates code: functions, references and calls make the config unsupported', () => {
    expect(parseTailwindConfigSource('tailwind.config = { theme: require("x") }')).toBeNull();
    expect(parseTailwindConfigSource('tailwind.config = { plugins: [fn()] }')).toBeNull();
    expect(parseTailwindConfigSource('tailwind.config = { ...base }')).toBeNull();
    expect(parseTailwindConfigSource('tailwind.config = { a: () => 1 }')).toBeNull();
    expect(parseTailwindConfigSource('tailwind.config = { __proto__: { x: 1 } }')).toBeNull();
  });

  it('drops unsafe color values', () => {
    const theme = createDefaultTailwindTheme();
    applyTailwindConfig(theme, {
      theme: { extend: { colors: { evil: 'url(javascript:alert(1))', ok: '#123' } } },
    });
    expect(theme.colors.evil).toBeUndefined();
    expect(theme.colors.ok).toBe('#123');
  });
});

describe('importHtml with Tailwind classes', () => {
  it('maps the AI-generated Tailwind fixture into portable styles', async () => {
    const result = await importHtml(readFixture('real-world', 'ai-tailwind.html'), {
      baseUrl: 'https://site.example.com/',
    });
    const root = rootOf(result);

    const hero = findNode(
      [root],
      (n) => n.type === 'heading' && String(n.props?.text).startsWith('Transform'),
    );
    expect(hero?.styles?.base).toMatchObject({ fontSize: '3rem', fontWeight: '800' });
    expect(hero?.styles?.tablet).toMatchObject({ fontSize: '3.75rem' });
    expect(hero?.styles?.desktop).toMatchObject({ fontSize: '3.75rem' });

    const grid = findNode([root], (n) => n.type === 'grid');
    expect(grid?.styles?.base).toMatchObject({ display: 'grid', gap: '2rem' });
    expect(grid?.styles?.base?.gridTemplateColumns).toBeUndefined();
    expect(grid?.styles?.tablet).toMatchObject({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    });
    expect(grid?.styles?.desktop).toMatchObject({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    });
    expect(grid?.styles?.mobile).toBeUndefined();

    // `bg-primary` comes from the static tailwind.config; `hover:bg-emerald-600` → states.
    const cta = findNode([root], (n) => n.type === 'button' && n.props?.label === 'Get Started');
    expect(cta?.styles?.base).toMatchObject({ backgroundColor: '#10b981', color: '#ffffff' });
    expect(cta?.styles?.states?.hover).toEqual({ backgroundColor: '#059669' });

    // No Tailwind class names or runtime leak into the document.
    const serialized = JSON.stringify(result.document);
    expect(serialized).not.toContain('tailwind');
    expect(serialized).not.toContain('--tw-');
  });

  it('auto-detects the Play CDN script even though the sanitizer removes it', async () => {
    const html = `<html><head><script src="https://cdn.tailwindcss.com"></script></head>
      <body><p class="text-lg">Hi</p></body></html>`;
    const p = findNode([rootOf(await importHtml(html))], (n) => n.type === 'paragraph');
    expect(p?.styles?.base).toMatchObject({ fontSize: '1.125rem' });
  });

  it('does not map plain class names without a Tailwind signal in auto mode', async () => {
    const html = '<p class="text-lg p-4">Hi</p>';
    const auto = findNode([rootOf(await importHtml(html))], (n) => n.type === 'paragraph');
    expect(auto?.styles?.base?.fontSize).toBeUndefined();

    const forced = findNode(
      [rootOf(await importHtml(html, { tailwind: true } as HtmlImportOptions))],
      (n) => n.type === 'paragraph',
    );
    expect(forced?.styles?.base).toMatchObject({ fontSize: '1.125rem', padding: '1rem' });
  });

  it('can be disabled explicitly', async () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script><p class="text-lg">Hi</p>`;
    const result = await importHtml(html, { tailwind: false } as HtmlImportOptions);
    const p = findNode([rootOf(result)], (n) => n.type === 'paragraph');
    expect(p?.styles?.base?.fontSize).toBeUndefined();
  });

  it('lets inline styles and page CSS win, and leaves classes the page defines to its CSS', async () => {
    const html = `<style>.p-4 { padding: 7px } #x { color: red }</style>
      <p id="x" class="p-4 text-blue-500 text-lg" style="font-size: 30px">Hi</p>`;
    const result = await importHtml(html, { tailwind: true } as HtmlImportOptions);
    const p = findNode([rootOf(result)], (n) => n.type === 'paragraph');
    expect(p?.styles?.base).toMatchObject({ padding: '7px', color: 'red', fontSize: '30px' });
  });

  it('reports each unknown class once instead of dropping it silently', async () => {
    const html = `<div class="ring-2 dark:bg-black p-2"><p class="ring-2">A</p><p>B</p></div>`;
    const result = await importHtml(html, { tailwind: true } as HtmlImportOptions);
    const tailwindDiagnostics = result.report.diagnostics.filter(
      (d) => d.details?.source === 'tailwind',
    );
    expect(tailwindDiagnostics.map((d) => d.details?.className).sort()).toEqual([
      'dark:bg-black',
      'ring-2',
    ]);
    expect(tailwindDiagnostics.every((d) => d.code === 'CSS_UNSUPPORTED_SELECTOR')).toBe(true);
    expect(tailwindDiagnostics.every((d) => d.severity === 'info')).toBe(true);
  });

  it('applies space-x to following siblings only', async () => {
    const html = `<div class="flex space-x-4"><a href="/a">A</a><a href="/b">B</a></div>`;
    const root = rootOf(await importHtml(html, { tailwind: true } as HtmlImportOptions));
    const links = [
      findNode([root], (n) => n.type === 'link' && n.props?.text === 'A'),
      findNode([root], (n) => n.type === 'link' && n.props?.text === 'B'),
    ];
    expect(links[0]?.styles?.base?.marginLeft).toBeUndefined();
    expect(links[1]?.styles?.base).toMatchObject({ marginLeft: '1rem' });
  });

  it('resolves gradients without leaving Tailwind variables behind', async () => {
    const html = `<section class="bg-gradient-to-r from-blue-500 to-purple-600"><p>Hi</p></section>`;
    const root = rootOf(await importHtml(html, { tailwind: true } as HtmlImportOptions));
    const section = findNode([root], (n) => n.type === 'section');
    expect(section?.styles?.base).toMatchObject({
      backgroundImage: 'linear-gradient(to right, #3b82f6, #9333ea)',
    });
  });
});

describe('buildTailwindStylesheet (STORA-649)', () => {
  async function tailwindCss(html: string, options?: HtmlImportOptions) {
    const report = createEmptyReport();
    const parsed = parseHtml(html, options, report);
    sanitizeAst(parsed.rootElement!, report, options);
    return buildTailwindStylesheet(parsed.parsed!, options);
  }

  it('returns the mapped rules of the ai-tailwind fixture as CSS text', async () => {
    const result = await tailwindCss(readFixture('real-world', 'ai-tailwind.html'));
    expect(result.applied).toBe(true);
    expect(result.rules.length).toBeGreaterThan(20);
    expect(result.css).toContain('[class~="font-extrabold"] { font-weight: 800; }');
    expect(result.css).toContain('[class~="bg-primary"] { background-color: #10b981; }');
    expect(result.css).toContain(
      '@media (min-width: 768px) { [class~="md:text-6xl"] { font-size: 3.75rem; line-height: 1; } }',
    );
    expect(result.css).not.toMatch(/url\(|@import|<script|tailwindcss\.com/i);
  });

  it('follows the same mode and detection as importHtml', async () => {
    const html = '<div class="p-4 flex items-center gap-2 text-red-500 font-bold">x</div>';
    expect((await tailwindCss(html, { tailwind: false } as HtmlImportOptions)).css).toBe('');
    expect((await tailwindCss('<div class="p-4">x</div>')).applied).toBe(false);
    expect((await tailwindCss('<div class="p-4">x</div>', { tailwind: true } as HtmlImportOptions)).css).toBe(
      '[class~="p-4"] { padding: 1rem; }',
    );
    // Classes defined by page or host stylesheets are left to them.
    const withHost = await tailwindCss(html, {
      tailwind: true,
      stylesheets: ['.p-4 { padding: 3px; }'],
    } as HtmlImportOptions);
    expect(withHost.css).not.toContain('"p-4"');
    expect(withHost.css).toContain('"flex"');
  });

  it('serializeCssRules drops anything that could break out of its rule', () => {
    const css = serializeCssRules([
      { selector: '.a', declarations: [{ property: 'color', value: 'red', important: true }], sourceOrder: 0 },
      { selector: '.b } body {', declarations: [{ property: 'color', value: 'red', important: false }], sourceOrder: 1 },
      {
        selector: '.c',
        mediaQuery: '(min-width: 1px)',
        declarations: [
          { property: 'color', value: 'red; background: blue', important: false },
          { property: 'margin', value: '0 /* x', important: false },
          { property: 'padding', value: '1px', important: false },
        ],
        sourceOrder: 2,
      },
    ]);
    expect(css).toBe('.a { color: red !important; }\n@media (min-width: 1px) { .c { padding: 1px; } }');
  });
});
