/**
 * Browser-snapshot style mode for HTML import (STORA-623, editor only).
 *
 * Alternative to the static cascade of `@kubuild/html-import`: the sanitized HTML is
 * rebuilt in inert measurement iframes at one viewport width per KUBUILD breakpoint,
 * `getComputedStyle` is read for a curated property set, values are diffed per breakpoint
 * and UA defaults are dropped. The result is fed back into `importHtml` through the
 * `styleOverride` hook, so mapping, normalization, assets and validation stay identical to
 * static mode. See `frame.ts` for the sandbox/security design (and the documented deviation
 * from the ticket's "no same-origin" criterion).
 */

import { BREAKPOINTS, BREAKPOINT_ORDER, type BreakpointName } from '@kubuild/schema';
import {
  createEmptyReport,
  getAttribute,
  getElementPath,
  importHtml,
  isUrlLike,
  parseHtml,
  resolveStylesheetHref,
  sanitizeAst,
  walkTree,
  type HtmlImportOptions,
  type HtmlImportResult,
  type HtmlStyleOverride,
  type Parse5Element,
} from '@kubuild/html-import';
import {
  appendSanitizedChildren,
  copySafeAttributes,
  createSnapshotIframe,
  loadSnapshotIframe,
  neutralizeCss,
  readComputedLonghands,
  resolveLinkedStylesheets,
  type SnapshotSourceNode,
} from './frame.js';
import { SNAPSHOT_LONGHANDS } from './properties.js';
import {
  mergeSnapshotIntoComputed,
  reduceElementSnapshot,
  type BrowserSnapshot,
  type ElementSnapshot,
  type SnapshotLayers,
} from './reduce.js';

export * from './frame.js';
export * from './properties.js';
export * from './reduce.js';

/** Default viewport width (CSS px) measured for each breakpoint. */
export const DEFAULT_SNAPSHOT_WIDTHS: Readonly<Record<BreakpointName, number>> = Object.freeze({
  desktop: Math.max(1280, BREAKPOINTS.desktop.minWidth),
  tablet: Math.round((BREAKPOINTS.tablet.minWidth + (BREAKPOINTS.tablet.maxWidth ?? 1023)) / 2),
  mobile: Math.min(375, BREAKPOINTS.mobile.maxWidth ?? 767),
});

export interface BrowserSnapshotOptions {
  /** The options that will be passed to `importHtml` (parse limits, stylesheets, fetchers). */
  importOptions?: HtmlImportOptions;
  /** Viewport width per breakpoint; each must fall inside that breakpoint's range. */
  widths?: Partial<Record<BreakpointName, number>>;
  /** Host document that temporarily holds the measurement frames. Defaults to `document`. */
  hostDocument?: Document;
  /** Per-frame load timeout in ms (default 5000). */
  timeoutMs?: number;
}

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Parent chain giving reference elements their usual UA context. */
const REFERENCE_CONTEXT: Readonly<Record<string, readonly string[]>> = {
  li: ['ul'],
  dt: ['dl'],
  dd: ['dl'],
  tr: ['table', 'tbody'],
  td: ['table', 'tbody', 'tr'],
  th: ['table', 'tbody', 'tr'],
  thead: ['table'],
  tbody: ['table'],
  tfoot: ['table'],
  caption: ['table'],
  colgroup: ['table'],
  col: ['table', 'colgroup'],
  option: ['select'],
  optgroup: ['select'],
  legend: ['fieldset'],
  figcaption: ['figure'],
  summary: ['details'],
};

function isSnapshotElement(node: SnapshotSourceNode): boolean {
  return typeof node.tagName === 'string';
}

function findChildElement(node: SnapshotSourceNode | undefined, tag: string): SnapshotSourceNode | undefined {
  return node?.childNodes?.find((c) => isSnapshotElement(c) && c.tagName!.toLowerCase() === tag);
}

function resolveWidths(widths?: Partial<Record<BreakpointName, number>>): Record<BreakpointName, number> {
  const out = { ...DEFAULT_SNAPSHOT_WIDTHS };
  for (const bp of BREAKPOINT_ORDER) {
    const w = widths?.[bp];
    if (typeof w !== 'number' || !Number.isFinite(w)) continue;
    const range = BREAKPOINTS[bp];
    if (w >= range.minWidth && (range.maxWidth === null || w <= range.maxWidth)) out[bp] = Math.round(w);
  }
  return out;
}

/**
 * Collects the CSS of `options.stylesheets` (inline text, or URLs via `fetchStylesheet`).
 */
async function resolveExtraStylesheets(options?: HtmlImportOptions): Promise<string[]> {
  const out: string[] = [];
  for (const sheet of options?.stylesheets ?? []) {
    if (typeof sheet !== 'string' || sheet.trim() === '') continue;
    if (!isUrlLike(sheet)) {
      out.push(sheet);
      continue;
    }
    if (!options?.fetchStylesheet) continue;
    try {
      const css = await options.fetchStylesheet(resolveStylesheetHref(sheet, options.baseUrl));
      if (typeof css === 'string') out.push(css);
    } catch {
      // Unresolvable stylesheet: same outcome as static mode.
    }
  }
  return out;
}

interface PreparedSource {
  root: SnapshotSourceNode;
  isFragment: boolean;
  linkedCss: Map<SnapshotSourceNode, string>;
  extraCss: string[];
}

async function prepareSource(html: string, options?: HtmlImportOptions): Promise<PreparedSource> {
  // Exactly the same parse + sanitize as `importHtml`, so element paths line up.
  const report = createEmptyReport();
  const parsed = parseHtml(html, options, report);
  if (!parsed.success || !parsed.rootElement) {
    throw new Error(parsed.error ?? 'HTML could not be parsed');
  }
  sanitizeAst(parsed.rootElement, report, options);
  const root = parsed.rootElement as unknown as SnapshotSourceNode;

  const links: Array<{ node: SnapshotSourceNode; href: string }> = [];
  walkTree(parsed.rootElement, (node) => {
    if (!('tagName' in node) || node.tagName.toLowerCase() !== 'link') return;
    const rel = (getAttribute(node, 'rel') ?? '').toLowerCase().split(/\s+/);
    const href = getAttribute(node, 'href');
    if (rel.includes('stylesheet') && href && href.trim()) {
      links.push({ node: node as unknown as SnapshotSourceNode, href: href.trim() });
    }
  });

  return {
    root,
    isFragment: Boolean(parsed.isFragment),
    linkedCss: await resolveLinkedStylesheets(links, options, resolveStylesheetHref),
    extraCss: await resolveExtraStylesheets(options),
  };
}

/** Rebuilds the sanitized source inside a loaded measurement document. */
function populateFrame(doc: Document, source: PreparedSource): Map<SnapshotSourceNode, Element> {
  const elementMap = new Map<SnapshotSourceNode, Element>();
  if (source.isFragment) {
    appendSanitizedChildren(doc, source.root, doc.body, elementMap, source.linkedCss);
  } else {
    const htmlEl = findChildElement(source.root, 'html');
    const headEl = findChildElement(htmlEl, 'head');
    const bodyEl = findChildElement(htmlEl, 'body');
    if (htmlEl) {
      copySafeAttributes(htmlEl, doc.documentElement);
      elementMap.set(htmlEl, doc.documentElement);
    }
    if (headEl) {
      elementMap.set(headEl, doc.head);
      appendSanitizedChildren(doc, headEl, doc.head, elementMap, source.linkedCss);
    }
    if (bodyEl) {
      copySafeAttributes(bodyEl, doc.body);
      elementMap.set(bodyEl, doc.body);
      appendSanitizedChildren(doc, bodyEl, doc.body, elementMap, source.linkedCss);
    }
  }
  for (const css of source.extraCss) {
    const style = doc.createElementNS(HTML_NS, 'style');
    style.appendChild(doc.createTextNode(neutralizeCss(css)));
    doc.body.appendChild(style);
  }
  return elementMap;
}

/** Measures UA defaults per tag in an author-style-free document. */
function measureReferences(
  doc: Document,
  win: Window,
  sources: Iterable<SnapshotSourceNode>,
): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const source of sources) {
    const tagName = source.tagName!;
    const tag = tagName.toLowerCase();
    const ns = source.namespaceURI || HTML_NS;
    const key = `${ns}|${tag}`;
    if (out.has(key)) continue;
    let element: Element;
    if (ns === HTML_NS && tag === 'html') element = doc.documentElement;
    else if (ns === HTML_NS && tag === 'head') element = doc.head;
    else if (ns === HTML_NS && tag === 'body') element = doc.body;
    else {
      let parent: Element = doc.body;
      const chain = ns === HTML_NS ? (REFERENCE_CONTEXT[tag] ?? []) : tag === 'svg' ? [] : ['svg'];
      for (const wrapperTag of chain) {
        const wrapper = doc.createElementNS(wrapperTag === 'svg' ? SVG_NS : HTML_NS, wrapperTag);
        parent.appendChild(wrapper);
        parent = wrapper;
      }
      try {
        element = doc.createElementNS(ns, tagName);
      } catch {
        continue;
      }
      if (ns === HTML_NS && (tag === 'a' || tag === 'area')) element.setAttribute('href', '#');
      parent.appendChild(element);
    }
    out.set(key, readComputedLonghands(win, element, SNAPSHOT_LONGHANDS));
  }
  return out;
}

/**
 * Renders the sanitized HTML in inert measurement frames (one per breakpoint plus one
 * UA-default reference frame) and returns the raw measurements keyed by element path.
 * Requires a real browser DOM; throws when frames cannot be created, loaded or read.
 */
export async function captureBrowserSnapshot(
  html: string,
  options: BrowserSnapshotOptions = {},
): Promise<BrowserSnapshot> {
  const hostDocument =
    options.hostDocument ?? (typeof document !== 'undefined' ? document : undefined);
  if (!hostDocument) throw new Error('Browser snapshot requires a DOM document');
  const widths = resolveWidths(options.widths);
  const timeoutMs = options.timeoutMs ?? 5000;
  const source = await prepareSource(html, options.importOptions);

  const frames: HTMLIFrameElement[] = [];
  const open = async (width: number) => {
    const iframe = createSnapshotIframe(hostDocument, width);
    frames.push(iframe);
    return loadSnapshotIframe(hostDocument, iframe, timeoutMs);
  };

  try {
    const elements = new Map<string, ElementSnapshot>();
    let sources: SnapshotSourceNode[] = [];

    for (const bp of BREAKPOINT_ORDER) {
      const { doc, win } = await open(widths[bp]);
      const elementMap = populateFrame(doc, source);
      if (sources.length === 0) sources = [...elementMap.keys()];
      for (const [node, element] of elementMap) {
        const path = getElementPath(node as unknown as Parse5Element);
        let record = elements.get(path);
        if (!record) {
          const parent = (node as unknown as { parentNode?: SnapshotSourceNode | null }).parentNode;
          record = {
            tagName: node.tagName!.toLowerCase(),
            ...(parent && elementMap.has(parent)
              ? { parentPath: getElementPath(parent as unknown as Parse5Element) }
              : {}),
            computed: {},
            reference: {},
          };
          elements.set(path, record);
        }
        record.computed[bp] = readComputedLonghands(win, element, SNAPSHOT_LONGHANDS);
      }
    }

    const { doc: refDoc, win: refWin } = await open(widths.desktop);
    const references = measureReferences(refDoc, refWin, sources);
    for (const node of sources) {
      const record = elements.get(getElementPath(node as unknown as Parse5Element));
      const ref = references.get(`${node.namespaceURI || HTML_NS}|${node.tagName!.toLowerCase()}`);
      if (record && ref) record.reference = ref;
    }

    return { widths, elements };
  } finally {
    for (const frame of frames) frame.remove();
  }
}

/**
 * Builds an `HtmlImportOptions.styleOverride` hook from a snapshot. Elements that were not
 * measured (skipped tags, path/tag mismatch) keep their static styles.
 */
export function createSnapshotStyleOverride(snapshot: BrowserSnapshot): HtmlStyleOverride {
  const cache = new Map<string, SnapshotLayers>();
  return (element, computed) => {
    const path = getElementPath(element);
    const record = snapshot.elements.get(path);
    if (!record || record.tagName !== element.tagName.toLowerCase()) return undefined;
    let layers = cache.get(path);
    if (!layers) {
      const parent = record.parentPath ? snapshot.elements.get(record.parentPath) : undefined;
      layers = reduceElementSnapshot(record, parent);
      cache.set(path, layers);
    }
    return mergeSnapshotIntoComputed(computed, layers);
  };
}

export interface BrowserSnapshotImportResult extends HtmlImportResult {
  /** True when snapshot styles were applied; false when it fell back to static mode. */
  snapshotApplied: boolean;
  /** Why the snapshot could not be taken (no DOM, frame timeout, ...). */
  snapshotError?: string;
}

/**
 * `importHtml` with browser-snapshot styles. Falls back to the static cascade (and reports
 * `snapshotApplied: false`) whenever measuring is impossible.
 */
export async function importHtmlWithBrowserSnapshot(
  html: string,
  options?: HtmlImportOptions,
  snapshotOptions: Omit<BrowserSnapshotOptions, 'importOptions'> = {},
): Promise<BrowserSnapshotImportResult> {
  let override: HtmlStyleOverride | undefined;
  let snapshotError: string | undefined;
  try {
    const snapshot = await captureBrowserSnapshot(html, { ...snapshotOptions, importOptions: options });
    override = createSnapshotStyleOverride(snapshot);
  } catch (err) {
    snapshotError = err instanceof Error ? err.message : String(err);
  }
  const result = await importHtml(html, override ? { ...options, styleOverride: override } : options);
  return {
    ...result,
    snapshotApplied: Boolean(override),
    ...(snapshotError ? { snapshotError } : {}),
  };
}
