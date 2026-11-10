/**
 * Inert measurement frames for the browser-snapshot style mode (STORA-623).
 *
 * SECURITY / DEVIATION FROM THE TICKET
 * ------------------------------------
 * STORA-623 asks for an iframe whose sandbox allows neither scripts nor same-origin. With
 * that sandbox the frame gets an opaque origin, so the parent cannot reach
 * `contentDocument`/`getComputedStyle`, and no script inside the frame may run to report
 * back: no computed style is observable at all. The literal criterion is therefore
 * technically impossible for a mode whose whole purpose is reading computed styles.
 *
 * The safest workable variant implemented here:
 * - `sandbox="allow-same-origin"` ONLY. `allow-scripts` is never granted, so the browser
 *   refuses to run any script in the frame (`<script>`, `on*` handlers, `javascript:` URLs)
 *   even if something slipped through. The well-known sandbox escape needs
 *   `allow-scripts` + `allow-same-origin` together; without scripts the frame has no way to
 *   use its origin. No `allow-forms`, `allow-popups`, `allow-top-navigation`, ... either.
 *   Same-origin is what lets the trusted editor code read computed styles from outside.
 * - The frame document is a fixed `srcdoc` shell whose first head child is a CSP
 *   (`default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; ...`), so no network
 *   request is possible from the frame (no images, fonts, `@import`, frames, prefetch).
 * - The untrusted HTML is never parsed by the browser. It is parsed and sanitized by
 *   `@kubuild/html-import` (`parseHtml` + `sanitizeAst`) and the resulting AST is rebuilt
 *   node by node with `createElementNS`/`setAttribute`/`createTextNode` (no `innerHTML`, so
 *   no parser differential / mXSS). While rebuilding, executable or network-capable tags
 *   are skipped, `on*` attributes and every URL-bearing attribute are dropped, links become
 *   `href="#"`, and `url()`/`@import`/`image-set()` are neutralized in CSS text.
 * - Frames are off-screen, `inert`, `aria-hidden`, `pointer-events: none`, and removed as
 *   soon as measuring finishes.
 */

import type { HtmlImportOptions } from '@kubuild/html-import';

/** Sandbox tokens of every measurement frame. Never contains `allow-scripts`. */
export const SNAPSHOT_IFRAME_SANDBOX = 'allow-same-origin';

/** Content-Security-Policy of the measurement document: inline CSS only, no network. */
export const SNAPSHOT_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'none'",
  "font-src 'none'",
  "media-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

/** The fixed shell loaded into every measurement frame. */
export function buildSnapshotSrcdoc(): string {
  return (
    '<!DOCTYPE html><html><head>' +
    `<meta http-equiv="Content-Security-Policy" content="${SNAPSHOT_CSP}">` +
    '</head><body></body></html>'
  );
}

/**
 * Tags never recreated in a measurement frame (scripting, plugins, nested browsing contexts,
 * document-level metadata). Their subtree is skipped; the static cascade covers them.
 */
export const SNAPSHOT_SKIPPED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'noscript',
  'template',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'fencedframe',
  'base',
  'meta',
  'link',
  'title',
  'foreignobject',
  'animate',
  'set',
  'animatemotion',
  'animatetransform',
]);

/** Attributes dropped on recreation: anything that can carry a URL or alter loading. */
export const SNAPSHOT_BLOCKED_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href',
  'src',
  'srcset',
  'srcdoc',
  'sizes',
  'imagesrcset',
  'imagesizes',
  'action',
  'formaction',
  'poster',
  'data',
  'background',
  'cite',
  'ping',
  'longdesc',
  'lowsrc',
  'dynsrc',
  'manifest',
  'codebase',
  'archive',
  'classid',
  'usemap',
  'http-equiv',
  'content',
  'integrity',
  'nonce',
  'is',
  'autofocus',
  'popover',
  'popovertarget',
  'loading',
]);

const DANGEROUS_CSS_PATTERN = /url\s*\(|image-set\s*\(|@import|(?:^|[^a-z-])src\s*\(/i;

function neutralizeRawCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\s*\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, 'none')
    .replace(/(?:-webkit-)?image-set\s*\(/gi, 'kb-blocked(')
    .replace(/(^|[^a-z-])src\s*\(/gi, '$1kb-blocked(');
}

function decodeCssEscapes(css: string): string {
  return css
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_m, hex: string) => {
      const code = parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/\\(.)/g, '$1');
}

/**
 * Removes every way CSS text could reference an external resource (`url()`, `@import`,
 * `image-set()`, `src()`). Defense in depth only: the frame CSP already blocks the requests.
 * If escapes hide a reference (e.g. `u\72l(`), the escape-decoded text is neutralized
 * instead, trading selector fidelity for safety.
 */
export function neutralizeCss(css: string): string {
  const neutralized = neutralizeRawCss(css);
  const decoded = decodeCssEscapes(neutralized);
  return DANGEROUS_CSS_PATTERN.test(decoded) ? neutralizeRawCss(decoded) : neutralized;
}

/** Minimal structural view of parse5 nodes used to rebuild the tree. */
export interface SnapshotSourceNode {
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: Array<{ name: string; value: string; prefix?: string; namespace?: string }>;
  childNodes?: SnapshotSourceNode[];
  value?: string;
}

const HTML_NS = 'http://www.w3.org/1999/xhtml';

/**
 * Copies the safe attributes of `source` onto `target`.
 */
export function copySafeAttributes(source: SnapshotSourceNode, target: Element): void {
  const tag = (source.tagName ?? '').toLowerCase();
  for (const attr of source.attrs ?? []) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) continue;
    if (name === 'href' && (tag === 'a' || tag === 'area') && !attr.prefix) {
      // Keep link UA styling (`:link`) without any navigable URL.
      setAttributeSafe(target, 'href', '#');
      continue;
    }
    if (SNAPSHOT_BLOCKED_ATTRIBUTES.has(name) || attr.prefix === 'xlink' || name.includes(':')) {
      continue;
    }
    setAttributeSafe(target, name, name === 'style' ? neutralizeCss(attr.value) : attr.value);
  }
}

function setAttributeSafe(target: Element, name: string, value: string): void {
  try {
    target.setAttribute(name, value);
  } catch {
    // Invalid attribute name for the DOM API: skip it.
  }
}

/**
 * Recreates the children of `source` under `target` in `doc`, registering each created
 * element in `elementMap`. Text of `<style>` elements is passed through `neutralizeCss`.
 * `linkedCss` supplies the text of `<link rel="stylesheet">` elements, inserted in place as
 * `<style>` so source order (and therefore the cascade) is preserved.
 */
export function appendSanitizedChildren(
  doc: Document,
  source: SnapshotSourceNode,
  target: Node,
  elementMap: Map<SnapshotSourceNode, Element>,
  linkedCss?: Map<SnapshotSourceNode, string>,
): void {
  const parentIsStyle = (source.tagName ?? '').toLowerCase() === 'style';
  for (const child of source.childNodes ?? []) {
    if (child.nodeName === '#text') {
      const text = child.value ?? '';
      target.appendChild(doc.createTextNode(parentIsStyle ? neutralizeCss(text) : text));
      continue;
    }
    if (typeof child.tagName !== 'string') continue;
    const tag = child.tagName.toLowerCase();
    if (tag === 'link' && linkedCss?.has(child)) {
      const style = doc.createElementNS(HTML_NS, 'style');
      style.appendChild(doc.createTextNode(neutralizeCss(linkedCss.get(child) ?? '')));
      target.appendChild(style);
      continue;
    }
    if (SNAPSHOT_SKIPPED_TAGS.has(tag)) continue;
    let element: Element;
    try {
      element = doc.createElementNS(child.namespaceURI || HTML_NS, child.tagName);
    } catch {
      continue;
    }
    copySafeAttributes(child, element);
    elementMap.set(child, element);
    target.appendChild(element);
    appendSanitizedChildren(doc, child, element, elementMap, linkedCss);
  }
}

/** Creates (but does not attach) an off-screen, inert measurement iframe. */
export function createSnapshotIframe(hostDocument: Document, width: number, height = 900): HTMLIFrameElement {
  const iframe = hostDocument.createElement('iframe');
  iframe.setAttribute('sandbox', SNAPSHOT_IFRAME_SANDBOX);
  iframe.setAttribute('srcdoc', buildSnapshotSrcdoc());
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.setAttribute('inert', '');
  iframe.setAttribute('title', 'kubuild-style-snapshot');
  iframe.setAttribute(
    'style',
    `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;` +
      'border:0;visibility:hidden;pointer-events:none;',
  );
  return iframe;
}

/** Attaches the frame and resolves with its document once the `srcdoc` shell has loaded. */
export function loadSnapshotIframe(
  hostDocument: Document,
  iframe: HTMLIFrameElement,
  timeoutMs: number,
): Promise<{ doc: Document; win: Window }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Snapshot frame load timed out')), timeoutMs);
    iframe.addEventListener('load', () => {
      clearTimeout(timer);
      const doc = iframe.contentDocument;
      const win = iframe.contentWindow;
      if (!doc || !win || !doc.body || !doc.head) {
        reject(new Error('Snapshot frame document is not accessible'));
        return;
      }
      resolve({ doc, win });
    });
    (hostDocument.body ?? hostDocument.documentElement).appendChild(iframe);
  });
}

/** Reads the given longhands of `element` via the frame window's `getComputedStyle`. */
export function readComputedLonghands(
  win: Window,
  element: Element,
  longhands: readonly string[],
): Record<string, string> {
  const style = win.getComputedStyle(element);
  const out: Record<string, string> = {};
  for (const prop of longhands) {
    const value = style.getPropertyValue(prop);
    if (typeof value === 'string' && value.trim() !== '') out[prop] = value.trim();
  }
  return out;
}

/** Collects CSS text for `<link rel=stylesheet>` elements via the host's `fetchStylesheet`. */
export async function resolveLinkedStylesheets(
  links: Array<{ node: SnapshotSourceNode; href: string }>,
  options: HtmlImportOptions | undefined,
  resolveHref: (href: string, baseUrl?: string) => string,
): Promise<Map<SnapshotSourceNode, string>> {
  const out = new Map<SnapshotSourceNode, string>();
  if (!options?.fetchStylesheet) return out;
  for (const { node, href } of links) {
    try {
      const css = await options.fetchStylesheet(resolveHref(href, options.baseUrl));
      if (typeof css === 'string') out.set(node, css);
    } catch {
      // Same as static mode: an unresolvable stylesheet is simply missing.
    }
  }
  return out;
}
