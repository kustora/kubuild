import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  buildResponsiveStyles,
  getElementPath,
  importHtml,
  parseHtml,
  type ComputedElementStyles,
  type Parse5Element,
} from '@kubuild/html-import';
import type { Node as PageNode, ResponsiveStyles } from '@kubuild/schema';
import {
  SNAPSHOT_CSP,
  SNAPSHOT_IFRAME_SANDBOX,
  SNAPSHOT_LONGHANDS,
  appendSanitizedChildren,
  buildSnapshotSrcdoc,
  createSnapshotIframe,
  createSnapshotStyleOverride,
  extractSnapshotValues,
  importHtmlWithBrowserSnapshot,
  mergeSnapshotIntoComputed,
  neutralizeCss,
  reduceElementSnapshot,
  type ElementSnapshot,
  type RawStyleMap,
  type SnapshotSourceNode,
} from '../src/html-snapshot/index';

// ---------------------------------------------------------------------------
// Minimal fake DOM (the editor test env has no jsdom; layout is mocked anyway)
// ---------------------------------------------------------------------------

class FakeNode {
  parentNode: FakeElement | null = null;
  childNodes: FakeNode[] = [];
  appendChild(child: FakeNode): FakeNode {
    child.parentNode = this as unknown as FakeElement;
    this.childNodes.push(child);
    this.onChildAppended(child);
    return child;
  }
  remove(): void {
    if (!this.parentNode) return;
    this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this);
    this.parentNode = null;
  }
  protected onChildAppended(_child: FakeNode): void {}
}

class FakeText extends FakeNode {
  constructor(public data: string) {
    super();
  }
}

type FakeWindow = { getComputedStyle: (el: FakeElement) => { getPropertyValue: (p: string) => string } };

class FakeElement extends FakeNode {
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();
  contentDocument: FakeDocument | null = null;
  contentWindow: FakeWindow | null = null;
  constructor(
    public tagName: string,
    public namespaceURI = 'http://www.w3.org/1999/xhtml',
    public ownerDocument: FakeDocument | null = null,
  ) {
    super();
  }
  setAttribute(name: string, value: string): void {
    if (!/^[a-zA-Z_][\w.:-]*$/.test(name)) throw new Error('InvalidCharacterError');
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  addEventListener(type: string, cb: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), cb]);
  }
  protected onChildAppended(child: FakeNode): void {
    this.ownerDocument?.onAttach(child);
  }
}

class FakeDocument {
  documentElement: FakeElement;
  head: FakeElement;
  body: FakeElement;
  /** Width of the frame viewport this document renders in. */
  viewportWidth = 0;
  constructor(public onIframeAttached?: (iframe: FakeElement) => void) {
    this.documentElement = new FakeElement('html', undefined, this);
    this.head = new FakeElement('head', undefined, this);
    this.body = new FakeElement('body', undefined, this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
  }
  createElement(tag: string): FakeElement {
    return new FakeElement(tag, undefined, this);
  }
  createElementNS(ns: string, tag: string): FakeElement {
    return new FakeElement(tag, ns, this);
  }
  createTextNode(text: string): FakeText {
    return new FakeText(text);
  }
  onAttach(child: FakeNode): void {
    if (child instanceof FakeElement && child.tagName === 'iframe') this.onIframeAttached?.(child);
  }
}

// ---------------------------------------------------------------------------
// Mock "browser": UA defaults + a tiny author stylesheet for the fixture below
// ---------------------------------------------------------------------------

const INHERITED = new Set([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-transform',
  'white-space',
  'visibility',
  'list-style-type',
]);

function uaDefaults(tag: string): RawStyleMap {
  const map: RawStyleMap = {};
  for (const prop of SNAPSHOT_LONGHANDS) map[prop] = 'initial-' + prop;
  Object.assign(map, {
    display: ['a', 'span', 'strong', 'em'].includes(tag) ? 'inline' : tag === 'head' ? 'none' : 'block',
    position: 'static',
    float: 'none',
    color: 'rgb(0, 0, 0)',
    'background-color': 'rgba(0, 0, 0, 0)',
    'font-family': '"Times New Roman"',
    'font-size': '16px',
    'font-weight': '400',
    'font-style': 'normal',
    'line-height': 'normal',
    'text-decoration-line': 'none',
    'flex-direction': 'row',
    'row-gap': 'normal',
    'column-gap': 'normal',
    'overflow-x': 'visible',
    'overflow-y': 'visible',
  });
  for (const side of ['top', 'right', 'bottom', 'left']) {
    map[`padding-${side}`] = '0px';
    map[`border-${side}-width`] = '0px';
    map[`border-${side}-style`] = 'none';
    map[`border-${side}-color`] = 'rgb(0, 0, 0)';
  }
  for (const corner of ['top-left', 'top-right', 'bottom-right', 'bottom-left']) {
    map[`border-${corner}-radius`] = '0px';
  }
  if (tag === 'h1') Object.assign(map, { 'font-size': '32px', 'font-weight': '700' });
  if (tag === 'a') Object.assign(map, { color: 'rgb(0, 0, 238)', 'text-decoration-line': 'underline' });
  return map;
}

function hasClass(el: FakeElement, cls: string): boolean {
  return (el.getAttribute('class') ?? '').split(/\s+/).includes(cls);
}

function authorStyles(el: FakeElement, width: number): RawStyleMap {
  const tag = el.tagName;
  const parent = el.parentNode;
  const mobile = width <= 767;
  const s: RawStyleMap = {};
  if (tag === 'body') Object.assign(s, { 'font-family': 'Inter, sans-serif', color: 'rgb(17, 17, 17)' });
  if (tag === 'p') Object.assign(s, { 'padding-top': '0px' });
  if (hasClass(el, 'hero')) {
    Object.assign(s, {
      display: 'flex',
      'background-color': 'rgb(245, 245, 245)',
      'border-top-left-radius': '8px',
      'border-top-right-radius': '8px',
      'border-bottom-right-radius': '8px',
      'border-bottom-left-radius': '8px',
    });
    const pad = mobile ? '12px' : '24px';
    for (const side of ['top', 'right', 'bottom', 'left']) s[`padding-${side}`] = pad;
    if (mobile) s['flex-direction'] = 'column';
  }
  if (tag === 'h1' && parent && hasClass(parent, 'hero')) {
    Object.assign(s, { 'font-size': mobile ? '28px' : '40px', 'font-weight': '700' });
  }
  if (hasClass(el, 'card')) {
    for (const side of ['top', 'right', 'bottom', 'left']) {
      s[`padding-${side}`] = '16px';
      s[`border-${side}-width`] = '1px';
      s[`border-${side}-style`] = 'solid';
      s[`border-${side}-color`] = 'rgb(221, 221, 221)';
    }
  }
  return s;
}

type AuthorStyles = (el: FakeElement, width: number) => RawStyleMap;

function computeFake(el: FakeElement, width: number, author: AuthorStyles | null): RawStyleMap {
  const tag = el.tagName.toLowerCase();
  const ua = uaDefaults(tag);
  const authored = author ? author(el, width) : {};
  const parent = el.parentNode instanceof FakeElement ? computeFake(el.parentNode, width, author) : undefined;
  const result: RawStyleMap = { ...ua };
  if (parent) {
    for (const prop of INHERITED) {
      // UA-specific values (h1 font-size, a color) beat inheritance; others inherit.
      const generic = uaDefaults('div')[prop];
      if (ua[prop] === generic && parent[prop] !== undefined) result[prop] = parent[prop];
    }
  }
  Object.assign(result, authored);
  if (prop('border-top-color', result) && !authored['border-top-color']) {
    for (const side of ['top', 'right', 'bottom', 'left']) result[`border-${side}-color`] = result.color;
  }
  return result;
}

function prop(name: string, map: RawStyleMap): boolean {
  return name in map;
}

/** Text of every `<style>` element in a fake frame document, in tree order. */
function frameCssText(doc: FakeDocument): string[] {
  const out: string[] = [];
  const walk = (node: FakeNode) => {
    if (node instanceof FakeElement && node.tagName.toLowerCase() === 'style') {
      out.push(node.childNodes.map((c) => (c instanceof FakeText ? c.data : '')).join(''));
    }
    node.childNodes.forEach(walk);
  };
  walk(doc.documentElement);
  return out;
}

function toComputedValue(value: string): string {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) return `rgb(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)})`;
  const rem = /^(-?[\d.]+)rem$/.exec(value);
  if (rem) return `${Number(rem[1]) * 16}px`;
  return value;
}

/**
 * Mini "browser cascade" for the frame's own CSS: applies plain `[class~="x"]` rules
 * (optionally inside `@media (min-width: Npx)`) in source order. Pseudo-class and
 * combinator rules are ignored, which is enough for Tailwind-generated utilities.
 */
function frameStylesheetAuthor(doc: FakeDocument): AuthorStyles {
  return (el, width) => {
    const out: RawStyleMap = {};
    const rule = /(?:@media \(min-width: (\d+)px\) \{ )?\[class~="([^"]+)"\] \{ ([^}]*) \}/g;
    for (const css of frameCssText(doc)) {
      for (const match of css.matchAll(rule)) {
        if (match[1] && width < Number(match[1])) continue;
        if (!hasClass(el, match[2])) continue;
        for (const decl of match[3].split(';')) {
          const idx = decl.indexOf(':');
          if (idx < 0) continue;
          const name = decl.slice(0, idx).trim();
          if ((SNAPSHOT_LONGHANDS as readonly string[]).includes(name)) {
            out[name] = toComputedValue(decl.slice(idx + 1).replace('!important', '').trim());
          }
        }
      }
    }
    return out;
  };
}

/** Host document whose iframes "load" into fake documents with mocked getComputedStyle. */
function createFakeHost(
  authorFor?: (doc: FakeDocument) => AuthorStyles,
): { host: FakeDocument; attached: FakeElement[] } {
  const attached: FakeElement[] = [];
  const host = new FakeDocument((iframe) => {
    attached.push(iframe);
    const width = Number(/width:(\d+)px/.exec(iframe.getAttribute('style') ?? '')?.[1] ?? '0');
    const doc = new FakeDocument();
    doc.viewportWidth = width;
    iframe.contentDocument = doc;
    let hasAuthorContent = false;
    iframe.contentWindow = {
      getComputedStyle: (el) => {
        if (authorFor) {
          const computed = computeFake(el, width, authorFor(doc));
          return { getPropertyValue: (p: string) => computed[p] ?? '' };
        }
        // The reference frame never receives author content (only bare reference elements).
        hasAuthorContent ||= doc.body.childNodes.some(
          (c) => c instanceof FakeElement && (c.getAttribute('class') ?? '') !== '',
        );
        const computed = computeFake(el, width, hasAuthorContent ? authorStyles : null);
        return { getPropertyValue: (p: string) => computed[p] ?? '' };
      },
    };
    queueMicrotask(() => iframe.listeners.get('load')?.forEach((cb) => cb()));
  });
  return { host, attached };
}

const FIXTURE = `<!DOCTYPE html>
<html><head><title>Snap</title><style>
body { font-family: Inter, sans-serif; color: #111111; margin: 0; }
.hero { display: flex; padding: 24px; background-color: #f5f5f5; border-radius: 8px; }
.hero h1 { font-size: 40px; font-weight: 700; margin: 0; }
.card { padding: 16px; border: 1px solid #dddddd; }
p { margin: 0 0 8px; padding: 0; }
@media (max-width: 767.98px) {
  .hero { flex-direction: column; padding: 12px; }
  .hero h1 { font-size: 28px; }
}
</style></head><body>
<section class="hero"><h1>Title</h1><p>Lead text</p></section>
<div class="card"><p>Body text</p><a href="https://example.com/x" onclick="steal()">Link</a></div>
</body></html>`;

function countStyleEntries(nodes: PageNode[]): number {
  let total = 0;
  const countLayer = (layer?: Record<string, unknown>) => (layer ? Object.keys(layer).length : 0);
  for (const node of nodes) {
    const styles = (node.styles ?? {}) as ResponsiveStyles;
    total += countLayer(styles.base) + countLayer(styles.desktop) + countLayer(styles.tablet) + countLayer(styles.mobile);
    for (const state of Object.values(styles.states ?? {})) total += countLayer(state);
    total += countStyleEntries((node.children ?? []) as PageNode[]);
  }
  return total;
}

function findNode(nodes: PageNode[], predicate: (n: PageNode) => boolean): PageNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const found = findNode((node.children ?? []) as PageNode[], predicate);
    if (found) return found;
  }
  return undefined;
}

// ---------------------------------------------------------------------------

describe('browser snapshot iframe sandbox (STORA-623)', () => {
  it('never grants allow-scripts and uses a no-network CSP shell', () => {
    const host = new FakeDocument();
    const iframe = createSnapshotIframe(host as unknown as Document, 900) as unknown as FakeElement;
    const sandbox = iframe.getAttribute('sandbox') ?? '';
    expect(sandbox).toBe(SNAPSHOT_IFRAME_SANDBOX);
    expect(sandbox.split(/\s+/)).not.toContain('allow-scripts');
    expect(sandbox).not.toMatch(/allow-(forms|popups|top-navigation|modals|downloads|pointer-lock)/);
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.getAttribute('inert')).toBe('');
    expect(iframe.getAttribute('style')).toContain('width:900px');

    const srcdoc = iframe.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toBe(buildSnapshotSrcdoc());
    // CSP is the first thing in <head>, before any author CSS can be added.
    expect(srcdoc).toMatch(/^<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy"/);
    expect(SNAPSHOT_CSP).toContain("default-src 'none'");
    expect(SNAPSHOT_CSP).toContain("script-src 'none'");
    expect(SNAPSHOT_CSP).toContain("img-src 'none'");
    expect(SNAPSHOT_CSP).toContain("font-src 'none'");
  });

  it('neutralizes url(), @import, image-set() and escaped references in CSS', () => {
    expect(neutralizeCss('a{background:url("x.png") no-repeat}')).toBe('a{background:none no-repeat}');
    expect(neutralizeCss('@import url(evil.css);b{color:red}')).toBe('b{color:red}');
    expect(neutralizeCss('a{background-image:image-set("a.png" 1x)}')).not.toMatch(/image-set\(/);
    const escaped = neutralizeCss('a{background:u\\72l(http://evil/x.png)}');
    expect(escaped).not.toMatch(/url\(/i);
    expect(escaped).not.toContain('evil');
    // Harmless escapes (e.g. Tailwind class selectors) survive.
    expect(neutralizeCss('.md\\:flex{display:flex}')).toBe('.md\\:flex{display:flex}');
  });

  it('rebuilds sanitized markup without scripts, handlers or URLs', () => {
    const parsed = parseHtml(
      '<div onclick="x()" class="a" style="background:url(http://e/x.png)"><script>alert(1)</script>' +
        '<img src="http://e/i.png" srcset="http://e/i2.png 2x" alt="i"><a href="http://e" ping="http://p">l</a>' +
        '<iframe src="http://e"></iframe></div>',
    );
    const doc = new FakeDocument();
    const map = new Map<SnapshotSourceNode, Element>();
    appendSanitizedChildren(
      doc as unknown as Document,
      parsed.rootElement as unknown as SnapshotSourceNode,
      doc.body as unknown as Node,
      map,
    );
    const div = doc.body.childNodes[0] as FakeElement;
    expect(div.getAttribute('onclick')).toBeNull();
    expect(div.getAttribute('class')).toBe('a');
    expect(div.getAttribute('style')).toBe('background:none');
    const tags = div.childNodes.map((c) => (c as FakeElement).tagName);
    expect(tags).toEqual(['img', 'a']);
    const img = div.childNodes[0] as FakeElement;
    expect(img.getAttribute('src')).toBeNull();
    expect(img.getAttribute('srcset')).toBeNull();
    expect(img.getAttribute('alt')).toBe('i');
    const link = div.childNodes[1] as FakeElement;
    expect(link.getAttribute('href')).toBe('#');
    expect(link.getAttribute('ping')).toBeNull();
  });
});

describe('snapshot diff/strip logic (pure)', () => {
  const ref = uaDefaults('div');

  it('drops UA defaults and collapses longhands into shorthands', () => {
    const raw = { ...ref, display: 'flex', 'padding-top': '8px', 'padding-right': '16px', 'padding-bottom': '8px', 'padding-left': '16px' };
    const values = extractSnapshotValues(raw, ref);
    expect(values.get('display')).toEqual({ value: 'flex', isDefault: false });
    expect(values.get('padding')).toEqual({ value: '8px 16px', isDefault: false });
    expect(values.get('position')?.isDefault).toBe(true);
    expect(values.get('borderTop')).toEqual({ value: 'none', isDefault: true });
  });

  it('treats blockified display of flex items as default', () => {
    const spanRef = uaDefaults('span');
    const raw = { ...spanRef, display: 'block' };
    const parent = { ...ref, display: 'flex' };
    expect(extractSnapshotValues(raw, spanRef, parent).get('display')?.isDefault).toBe(true);
    expect(extractSnapshotValues(raw, spanRef, ref).get('display')?.isDefault).toBe(false);
  });

  it('drops non-text inherited values equal to the parent', () => {
    const parent = { ...ref, 'text-transform': 'uppercase' };
    const raw = { ...ref, 'text-transform': 'uppercase' };
    expect(extractSnapshotValues(raw, ref, parent).get('textTransform')?.isDefault).toBe(true);
  });

  it('picks the majority value as base and stores disjoint breakpoint deltas', () => {
    const el: ElementSnapshot = {
      tagName: 'div',
      reference: ref,
      computed: {
        desktop: { ...ref, display: 'flex', 'flex-direction': 'row' },
        tablet: { ...ref, display: 'flex', 'flex-direction': 'row' },
        mobile: { ...ref, display: 'flex', 'flex-direction': 'column' },
      },
    };
    const layers = reduceElementSnapshot(el);
    expect(layers.base).toEqual({ display: 'flex' });
    expect(layers.desktop).toEqual({});
    expect(layers.tablet).toEqual({});
    expect(layers.mobile).toEqual({ flexDirection: 'column' });
  });

  it('emits a reset value when only some viewports differ from a non-default base', () => {
    const el: ElementSnapshot = {
      tagName: 'div',
      reference: ref,
      computed: {
        desktop: { ...ref, display: 'grid' },
        tablet: { ...ref, display: 'grid' },
        mobile: { ...ref },
      },
    };
    const layers = reduceElementSnapshot(el);
    expect(layers.base).toEqual({ display: 'grid' });
    expect(layers.mobile).toEqual({ display: 'block' });
  });

  it('uses the border shorthand only when all sides match at every viewport', () => {
    const bordered = { ...ref };
    for (const side of ['top', 'right', 'bottom', 'left']) {
      bordered[`border-${side}-width`] = '1px';
      bordered[`border-${side}-style`] = 'solid';
      bordered[`border-${side}-color`] = 'rgb(1, 2, 3)';
    }
    const uniform = reduceElementSnapshot({ tagName: 'div', reference: ref, computed: { desktop: bordered, tablet: bordered, mobile: bordered } });
    expect(uniform.base).toEqual({ border: '1px solid rgb(1, 2, 3)' });

    const bottomOnly = { ...ref, 'border-bottom-width': '2px', 'border-bottom-style': 'dashed', 'border-bottom-color': 'red' };
    const sided = reduceElementSnapshot({ tagName: 'div', reference: ref, computed: { desktop: bottomOnly } });
    expect(sided.base).toEqual({ borderBottom: '2px dashed red' });
  });

  it('keeps authored relative values and shorthand locks from the static cascade', () => {
    const staticComputed: ComputedElementStyles = {
      base: { fontSize: '1.25rem', flex: '1', padding: '0', color: '#111111', width: '50%' },
      mediaQueries: [{ query: '(max-width: 600px)', styles: { padding: '4px', width: '100%' } }],
      pseudoStates: { ':hover': { color: 'red' } },
    };
    const merged = mergeSnapshotIntoComputed(staticComputed, {
      base: { fontSize: '20px', flexGrow: '1', color: 'rgb(17, 17, 17)', display: 'flex' },
      desktop: {},
      tablet: {},
      mobile: { padding: '12px' },
    });
    // rem font-size and `flex` shorthand stay static; width is never measured.
    expect(merged.base).toEqual({ fontSize: '1.25rem', flex: '1', color: 'rgb(17, 17, 17)', width: '50%', display: 'flex' });
    // Snapshot owns padding, so the static padding is removed from every layer.
    expect(merged.mediaQueries[0]).toEqual({ query: '(max-width: 600px)', styles: { width: '100%' } });
    expect(merged.pseudoStates).toBe(staticComputed.pseudoStates);

    const responsive = buildResponsiveStyles(merged);
    expect(responsive.mobile).toMatchObject({ padding: '12px' });
    expect(responsive.desktop).toBeUndefined();
  });
});

describe('styleOverride hook in @kubuild/html-import', () => {
  it('produces stable element paths across parses', () => {
    const html = '<div><p>a</p><span>b</span></div>';
    const a = parseHtml(html).rootElement as unknown as { childNodes: Parse5Element[] };
    const b = parseHtml(html).rootElement as unknown as { childNodes: Parse5Element[] };
    const spanA = a.childNodes[0].childNodes[1] as Parse5Element;
    const spanB = b.childNodes[0].childNodes[1] as Parse5Element;
    expect(getElementPath(spanA)).toBe('div:0/span:1');
    expect(getElementPath(spanA)).toBe(getElementPath(spanB));
  });

  it('applies the override and falls back to static styles when it throws', async () => {
    const html = '<html><body><div style="color: red"><p>x</p></div></body></html>';
    const overridden = await importHtml(html, {
      styleOverride: (el, computed) =>
        el.tagName === 'div' ? { ...computed, base: { ...computed.base, color: 'blue' } } : undefined,
    });
    const throwing = await importHtml(html, {
      styleOverride: () => {
        throw new Error('boom');
      },
    });
    const plain = await importHtml(html);
    const colorOf = (doc: typeof plain.document) =>
      JSON.stringify(doc?.document).match(/"color":"(\w+)"/)?.[1];
    expect(colorOf(overridden.document)).toBe('blue');
    expect(colorOf(throwing.document)).toBe(colorOf(plain.document));
    expect(JSON.stringify(throwing.document?.document)).toBe(JSON.stringify(plain.document?.document));
  });
});

describe('importHtmlWithBrowserSnapshot (mocked getComputedStyle)', () => {
  it('is not fatter than static mode for the same fixture', async () => {
    const { host, attached } = createFakeHost();
    const staticResult = await importHtml(FIXTURE);
    const snapResult = await importHtmlWithBrowserSnapshot(FIXTURE, undefined, {
      hostDocument: host as unknown as Document,
    });

    expect(staticResult.success).toBe(true);
    expect(snapResult.success).toBe(true);
    expect(snapResult.snapshotApplied).toBe(true);

    // 3 viewport frames + 1 UA reference frame, all sandboxed and removed afterwards.
    expect(attached).toHaveLength(4);
    for (const frame of attached) {
      expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
      expect(frame.parentNode).toBeNull();
    }

    const staticRoot = [staticResult.document!.document as PageNode];
    const snapRoot = [snapResult.document!.document as PageNode];
    const staticCount = countStyleEntries(staticRoot);
    const snapCount = countStyleEntries(snapRoot);
    expect(snapCount).toBeLessThanOrEqual(staticCount);

    // Responsive behavior is still captured from the per-viewport diff.
    const hero = findNode(snapRoot, (n) => JSON.stringify(n.styles ?? {}).includes('rgb(245, 245, 245)'));
    expect(hero?.styles?.base).toMatchObject({ display: 'flex', padding: '24px', borderRadius: '8px' });
    expect(hero?.styles?.mobile).toMatchObject({ flexDirection: 'column', padding: '12px' });
  });

  it('measures only sanitized content: no script, handler or URL reaches the frame', async () => {
    const { host, attached } = createFakeHost();
    const html = FIXTURE.replace('</body>', '<script>window.pwned=1</script><img src="http://evil/x.png"></body>');
    await importHtmlWithBrowserSnapshot(html, undefined, { hostDocument: host as unknown as Document });
    const walk = (node: FakeNode, visit: (el: FakeElement) => void) => {
      if (node instanceof FakeElement) visit(node);
      node.childNodes.forEach((c) => walk(c, visit));
    };
    for (const frame of attached) {
      walk(frame.contentDocument!.documentElement, (el) => {
        expect(el.tagName.toLowerCase()).not.toBe('script');
        for (const [name, value] of el.attributes) {
          expect(name.startsWith('on')).toBe(false);
          if (name !== 'content') expect(value).not.toMatch(/https?:/);
        }
      });
    }
  });

  it('falls back to static styles when no DOM is available', async () => {
    const result = await importHtmlWithBrowserSnapshot(FIXTURE);
    const plain = await importHtml(FIXTURE);
    expect(result.snapshotApplied).toBe(false);
    expect(result.snapshotError).toMatch(/DOM/);
    expect(JSON.stringify(result.document?.document)).toBe(JSON.stringify(plain.document?.document));
  });

  it('createSnapshotStyleOverride ignores elements whose tag does not match', () => {
    const override = createSnapshotStyleOverride({
      widths: { desktop: 1280, tablet: 896, mobile: 375 },
      elements: new Map([['div:0', { tagName: 'section', reference: {}, computed: {} }]]),
    });
    const el = (parseHtml('<div></div>').rootElement as unknown as { childNodes: Parse5Element[] }).childNodes[0];
    expect(override(el, { base: {}, mediaQueries: [], pseudoStates: {} })).toBeUndefined();
  });
});

describe('browser snapshot with Tailwind mapping (STORA-649)', () => {
  const TAILWIND_FIXTURE = readFileSync(
    new URL('../../html-import/tests/fixtures/real-world/ai-tailwind.html', import.meta.url),
    'utf8',
  );

  const heroOf = (root: PageNode) =>
    findNode([root], (n) => n.type === 'heading' && String(n.props?.text ?? '').startsWith('Transform'));
  const ctaOf = (root: PageNode) =>
    findNode([root], (n) => n.type === 'button' && n.props?.label === 'Get Started');

  it('measures the Tailwind-mapped rules instead of unstyled elements', async () => {
    const { host, attached } = createFakeHost(frameStylesheetAuthor);
    const result = await importHtmlWithBrowserSnapshot(TAILWIND_FIXTURE, undefined, {
      hostDocument: host as unknown as Document,
    });
    expect(result.success).toBe(true);
    expect(result.snapshotApplied).toBe(true);
    const root = result.document!.document as PageNode;

    // Font weight is a non-relative value, so the snapshot owns it: it must be the mapped 800,
    // not the UA 700 an unstyled frame would report (and drop as default).
    expect(heroOf(root)?.styles?.base).toMatchObject({ fontWeight: '800' });
    const cta = ctaOf(root);
    expect(JSON.stringify(cta?.styles?.base ?? {})).toMatch(/16, 185, 129|#10b981/i);
    expect(cta?.styles?.states?.hover).toEqual({ backgroundColor: '#059669' });

    // The Tailwind rules reach every author frame after the page CSS, never the reference.
    const authorFrames = attached.slice(0, 3);
    for (const frame of authorFrames) {
      const css = frameCssText(frame.contentDocument!);
      expect(css.at(-1)).toContain('[class~="font-extrabold"] { font-weight: 800; }');
    }
    expect(frameCssText(attached[3].contentDocument!)).toEqual([]);
  });

  it('loses the mapped styles without the Tailwind rules (regression guard)', async () => {
    const { host } = createFakeHost(frameStylesheetAuthor);
    const result = await importHtmlWithBrowserSnapshot(
      TAILWIND_FIXTURE,
      { tailwind: false },
      { hostDocument: host as unknown as Document },
    );
    expect(heroOf(result.document!.document as PageNode)?.styles?.base?.fontWeight).not.toBe('800');
  });

  it('keeps the frame free of scripts, handlers and url() leaks', async () => {
    const { host, attached } = createFakeHost(frameStylesheetAuthor);
    const html = TAILWIND_FIXTURE.replace(
      '</body>',
      '<div class="bg-[url(http://evil/x.png)] p-4">x</div><img src="http://evil/y.png"></body>',
    );
    await importHtmlWithBrowserSnapshot(html, undefined, { hostDocument: host as unknown as Document });
    const walk = (node: FakeNode, visit: (el: FakeElement) => void) => {
      if (node instanceof FakeElement) visit(node);
      node.childNodes.forEach((c) => walk(c, visit));
    };
    for (const frame of attached) {
      expect(frame.getAttribute('sandbox')).toBe(SNAPSHOT_IFRAME_SANDBOX);
      expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
      expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
      walk(frame.contentDocument!.documentElement, (el) => {
        expect(el.tagName.toLowerCase()).not.toBe('script');
        for (const [name, value] of el.attributes) {
          expect(name.startsWith('on')).toBe(false);
          if (name !== 'class') expect(value).not.toMatch(/https?:|url\(/i);
        }
      });
      for (const css of frameCssText(frame.contentDocument!)) {
        expect(css).not.toMatch(/url\s*\(|@import|<script|tailwindcss\.com/i);
      }
    }
  });
});
