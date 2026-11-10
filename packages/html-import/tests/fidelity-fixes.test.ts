/**
 * @kubuild/html-import
 * Fidelity fixes found by importing a real-world landing page (STORA-624 – STORA-630).
 */

import { describe, it, expect } from 'vitest';
import type { PageNode } from '@kubuild/schema';
import { importHtml, isSafeStyleValue } from '../src/index.js';

function walk(nodes: PageNode[] | undefined, visit: (node: PageNode) => void): void {
  for (const node of nodes ?? []) {
    visit(node);
    walk(node.children, visit);
  }
}

async function importBody(body: string, css = '') {
  const result = await importHtml(
    `<!DOCTYPE html><html><head><style>${css}</style></head><body>${body}</body></html>`,
  );
  expect(result.success, result.error).toBe(true);
  return result;
}

describe('HTML import fidelity fixes', () => {
  it('STORA-624: bare text does not copy the parent layout styles', async () => {
    const { document } = await importBody(
      '<div class="logo">Karya<span class="accent">Digital</span></div>',
      '.logo { display: flex; height: 74px; background: #fff; color: #111; } .accent { color: #4f46e5; }',
    );
    const logo = document!.document.children![0];
    const bare = logo.children![0];
    expect(bare.props?.text).toBe('Karya');
    expect(bare.styles?.base?.display).toBeUndefined();
    expect(bare.styles?.base?.height).toBeUndefined();
    expect(bare.styles?.base?.background).toBeUndefined();
    // Equal to the parent's color, so stripped by the normalizer.
    expect(bare.styles?.base?.color).toBeUndefined();
  });

  it('STORA-625: drops whitespace-only text in flex/grid parents and around removed elements', async () => {
    const { document } = await importBody(
      `<nav class="menu">
         <a href="#a">A</a>
         <a href="#b">B</a>
       </nav>
       <div class="grid"> <span>x</span> <span>y</span> </div>
       <footer>End</footer>
       <script>alert(1)</script>
      `,
      '.menu { display: flex; } .grid { display: grid; }',
    );
    const texts: string[] = [];
    walk([document!.document], (n) => {
      if (n.type === 'text') texts.push(String(n.props?.text));
    });
    expect(texts.every((t) => t.trim().length > 0)).toBe(true);
    const root = document!.document;
    expect(root.children![root.children!.length - 1].type).toBe('section');
  });

  it('STORA-625: keeps meaningful spaces between inline elements in normal flow', async () => {
    const { document } = await importBody('<div><a href="#a">A</a> <a href="#b">B</a></div>');
    const div = document!.document.children![0];
    expect(div.children!.map((c) => c.type)).toEqual(['link', 'text', 'link']);
    expect(div.children![1].props?.text).toBe(' ');
  });

  it('STORA-626: empty styled spans become containers, never empty text', async () => {
    const { document } = await importBody(
      '<div class="bar"><span class="dot"></span></div>',
      '.bar { display: flex; gap: 6px; } .dot { width: 10px; height: 10px; border-radius: 50%; background: #ef4444; }',
    );
    const dot = document!.document.children![0].children![0];
    expect(dot.type).toBe('container');
    expect(dot.styles?.base?.width).toBe('10px');
  });

  it('STORA-627: inline formatting tags map to text with an allowlisted `as`', async () => {
    const { document, report } = await importBody(
      '<div><strong>12,480+</strong><em>wow</em><small>fine print</small></div>',
    );
    const children = document!.document.children![0].children!;
    expect(children.map((c) => [c.type, c.props?.as])).toEqual([
      ['text', 'strong'],
      ['text', 'em'],
      ['text', 'small'],
    ]);
    expect(report.diagnostics.some((d) => d.code === 'ELEMENT_FALLBACK_EMBED')).toBe(false);
  });

  it('STORA-628: icon-only buttons keep their icon instead of a "Button" label', async () => {
    const { document, report } = await importBody(
      `<button class="menu-toggle" aria-label="Open menu">
         <svg viewBox="0 0 24 24"><path d="M4 6h16"></path></svg>
       </button>
       <button aria-label="Close"></button>`,
    );
    const [iconButton, emptyButton] = document!.document.children!;
    expect(iconButton.type).toBe('html-embed');
    expect(String(iconButton.props?.html)).toContain('<svg');
    expect(emptyButton.type).toBe('button');
    expect(emptyButton.props?.label).toBe('Close');
    expect(report.diagnostics.some((d) => d.code === 'ELEMENT_FALLBACK_EMBED')).toBe(true);
  });

  it('STORA-629: reports each unsupported selector once per import', async () => {
    const { report } = await importBody(
      '<div class="hero"><p>a</p><p>b</p><p>c</p></div>',
      '.hero::before { content: ""; } *::after { content: ""; }',
    );
    const selectors = report.diagnostics
      .filter((d) => d.code === 'CSS_UNSUPPORTED_SELECTOR')
      .map((d) => d.location?.selector);
    expect(selectors.sort()).toEqual(['*::after', '.hero::before']);
  });

  it('STORA-630: scroll-behavior is not flagged, IE behavior and bindings still are', async () => {
    expect(isSafeStyleValue('scroll-behavior: smooth')).toBe(true);
    expect(isSafeStyleValue('overscroll-behavior: contain')).toBe(true);
    expect(isSafeStyleValue('behavior: url(x.htc)')).toBe(false);
    expect(isSafeStyleValue('color: red; behavior: url(x.htc)')).toBe(false);
    expect(isSafeStyleValue('-ms-behavior: url(x.htc)')).toBe(false);
    expect(isSafeStyleValue('-moz-binding: url(x.xml#xss)')).toBe(false);

    const { report } = await importBody('<p>x</p>', 'html { scroll-behavior: smooth; }');
    expect(report.diagnostics.some((d) => d.code === 'CSS_UNSUPPORTED_PROPERTY')).toBe(false);
  });
});
