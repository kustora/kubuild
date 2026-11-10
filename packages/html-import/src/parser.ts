/**
 * @kubuild/html-import
 * HTML parser with security limits and AST extraction.
 */

import {
  parse,
  parseFragment,
  type DefaultTreeAdapterMap,
} from 'parse5';
import {
  addDiagnostic,
  createEmptyReport,
  type HtmlImportOptions,
  type HtmlImportReport,
} from './types.js';
import { detectTailwind, type TailwindDetection } from './tailwind.js';

/**
 * Default maximum document size in bytes (5 MB).
 */
export const DEFAULT_MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Hard cap on raw HTML element nesting depth. The import pipeline walks the DOM recursively,
 * so pathological nesting (thousands of levels) would otherwise overflow the call stack.
 * Real pages stay far below this; moderate excess depth is flattened later to `maxTreeDepth`.
 */
export const MAX_HTML_NESTING_DEPTH = 512;

/**
 * Computes the maximum element nesting depth of a parse5 tree iteratively (no recursion).
 */
export function measureNestingDepth(root: DefaultTreeAdapterMap['node']): number {
  let maxDepth = 0;
  const stack: Array<[DefaultTreeAdapterMap['node'], number]> = [[root, 0]];
  while (stack.length > 0) {
    const [node, depth] = stack.pop()!;
    if (depth > maxDepth) maxDepth = depth;
    const children: DefaultTreeAdapterMap['node'][] = [];
    if ('childNodes' in node && Array.isArray(node.childNodes)) children.push(...node.childNodes);
    if ('content' in node && node.content && typeof node.content === 'object' && 'childNodes' in node.content) {
      children.push(...node.content.childNodes);
    }
    for (const child of children) stack.push([child, depth + 1]);
  }
  return maxDepth;
}

/**
 * Structured result of parsing an HTML document or fragment.
 */
export interface ParsedHtmlDocument {
  isFragment: boolean;
  title?: string;
  description?: string;
  lang?: string;
  styles: Array<{ content: string; media?: string }>;
  stylesheetUrls: string[];
  rootElement:
    | DefaultTreeAdapterMap['element']
    | DefaultTreeAdapterMap['documentFragment']
    | DefaultTreeAdapterMap['document'];
  bodyElement?: DefaultTreeAdapterMap['element'];
  /**
   * Tailwind usage signals recorded from the raw tree, before sanitization strips the
   * `<script>` elements that carry them (STORA-622).
   */
  tailwind?: TailwindDetection;
}

/**
 * Result returned by parseHtml.
 */
export interface ParseHtmlResult extends Partial<ParsedHtmlDocument> {
  success: boolean;
  parsed?: ParsedHtmlDocument;
  document?: ParsedHtmlDocument;
  report: HtmlImportReport;
  error?: string;
}

/**
 * Checks whether an HTML string represents a full document or an HTML fragment.
 * A full document contains `<!DOCTYPE`, `<html`, `<head`, or `<body` tags.
 */
export function isFullHtmlDocument(html: string): boolean {
  return /(?:<!doctype|<html[\s>/]|<head[\s>/]|<body[\s>/])/i.test(html);
}

/**
 * Helper to check if a node is an element.
 */
function isElement(
  node: unknown,
): node is DefaultTreeAdapterMap['element'] {
  return (
    node !== null &&
    typeof node === 'object' &&
    'tagName' in node &&
    typeof (node as { tagName: unknown }).tagName === 'string'
  );
}

/**
 * Helper to get an attribute value from an element (case-insensitive).
 */
export function getAttribute(
  element: DefaultTreeAdapterMap['element'],
  attributeName: string,
): string | undefined {
  if (!element.attrs || !Array.isArray(element.attrs)) {
    return undefined;
  }
  const match = element.attrs.find(
    (attr) => attr.name.toLowerCase() === attributeName.toLowerCase(),
  );
  return match?.value;
}

/**
 * Checks whether an element has a specified attribute.
 *
 * @param element Parse5 element to inspect
 * @param attributeName Case-insensitive attribute name
 * @returns True if the attribute is present on the element
 */
export function hasAttribute(
  element: DefaultTreeAdapterMap['element'],
  attributeName: string,
): boolean {
  if (!element.attrs || !Array.isArray(element.attrs)) {
    return false;
  }
  return element.attrs.some(
    (attr) => attr.name.toLowerCase() === attributeName.toLowerCase(),
  );
}

/**
 * Helper to extract all text content from a node recursively.
 */
export function getTextContent(node: DefaultTreeAdapterMap['node']): string {
  if ('nodeName' in node && node.nodeName === '#text' && 'value' in node) {
    return typeof node.value === 'string' ? node.value : '';
  }

  let text = '';
  if ('content' in node && node.content && typeof node.content === 'object' && 'childNodes' in node.content) {
    for (const child of node.content.childNodes) {
      text += getTextContent(child);
    }
  }
  if ('childNodes' in node && Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      text += getTextContent(child);
    }
  }
  return text;
}

/**
 * Walks a parse5 AST tree depth-first.
 */
export function walkTree(
  node: DefaultTreeAdapterMap['node'],
  callback: (node: DefaultTreeAdapterMap['node']) => void,
): void {
  callback(node);

  if ('content' in node && node.content && typeof node.content === 'object' && 'childNodes' in node.content) {
    for (const child of node.content.childNodes) {
      walkTree(child, callback);
    }
  }

  if ('childNodes' in node && Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      walkTree(child, callback);
    }
  }
}

/**
 * Parses an HTML string (document or fragment) into a structured AST with metadata.
 *
 * Enforces input size limits before parsing. Never throws; returns structured
 * ParseHtmlResult with diagnostics if limits are exceeded or malformed inputs are encountered.
 *
 * @param html The HTML string to parse
 * @param options Configuration options including document security limits
 * @param existingReport Optional report to append diagnostics to
 */
export function parseHtml(
  html: string,
  options?: HtmlImportOptions,
  existingReport?: HtmlImportReport,
): ParseHtmlResult {
  const report = existingReport ?? createEmptyReport();

  if (typeof html !== 'string') {
    addDiagnostic(report, {
      code: 'LIMIT_EXCEEDED',
      severity: 'error',
      message: 'HTML input must be a string',
    });
    return {
      success: false,
      isFragment: false,
      styles: [],
      stylesheetUrls: [],
      report,
      error: 'HTML input must be a string',
    };
  }

  const maxSizeBytes =
    options?.limits?.maxDocumentSizeBytes ??
    DEFAULT_MAX_DOCUMENT_SIZE_BYTES;

  const inputByteLength = new TextEncoder().encode(html).length;

  if (html.length > maxSizeBytes || inputByteLength > maxSizeBytes) {
    addDiagnostic(report, {
      code: 'LIMIT_EXCEEDED',
      severity: 'error',
      message: `HTML input size (${inputByteLength} bytes) exceeds maximum allowed size of ${maxSizeBytes} bytes`,
      details: { size: inputByteLength, limit: maxSizeBytes },
    });
    return {
      success: false,
      isFragment: false,
      styles: [],
      stylesheetUrls: [],
      report,
      error: `Input size limit exceeded: ${inputByteLength} bytes exceeds limit of ${maxSizeBytes} bytes`,
    };
  }

  try {
    const isFullDoc = isFullHtmlDocument(html);
    const rootElement = isFullDoc
      ? parse(html, { sourceCodeLocationInfo: true })
      : parseFragment(html, { sourceCodeLocationInfo: true });

    const nestingDepth = measureNestingDepth(rootElement);
    if (nestingDepth > MAX_HTML_NESTING_DEPTH) {
      const message = `HTML nesting depth (${nestingDepth}) exceeds maximum supported depth of ${MAX_HTML_NESTING_DEPTH}`;
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message,
        details: { depth: nestingDepth, limit: MAX_HTML_NESTING_DEPTH },
      });
      return {
        success: false,
        isFragment: false,
        styles: [],
        stylesheetUrls: [],
        report,
        error: message,
      };
    }

    let extractedTitle: string | undefined;
    let extractedDescription: string | undefined;
    let extractedLang: string | undefined;
    const styles: Array<{ content: string; media?: string }> = [];
    const stylesheetUrls: string[] = [];
    let bodyElement: DefaultTreeAdapterMap['element'] | undefined;

    walkTree(rootElement, (node) => {
      if (!isElement(node)) {
        return;
      }

      const tagName = node.tagName.toLowerCase();

      // Extract document lang from <html>
      if (tagName === 'html' && extractedLang === undefined) {
        const lang = getAttribute(node, 'lang') ?? getAttribute(node, 'xml:lang');
        if (lang !== undefined && lang.trim().length > 0) {
          extractedLang = lang.trim();
        }
      }

      // Extract document <title> text
      if (tagName === 'title' && extractedTitle === undefined) {
        const titleText = getTextContent(node).trim();
        if (titleText.length > 0) {
          extractedTitle = titleText;
        }
      }

      // Extract document description: <meta name="description" content="...">
      if (tagName === 'meta' && extractedDescription === undefined) {
        const name = getAttribute(node, 'name');
        if (name && name.trim().toLowerCase() === 'description') {
          const content = getAttribute(node, 'content');
          if (content !== undefined) {
            extractedDescription = content.trim();
          }
        }
      }

      // Extract embedded stylesheets: <style>
      if (tagName === 'style') {
        const media = getAttribute(node, 'media');
        const content = getTextContent(node);
        styles.push({
          content,
          ...(media && media.trim().length > 0 ? { media: media.trim() } : {}),
        });
      }

      // Extract external stylesheet links: <link rel="stylesheet" href="...">
      if (tagName === 'link') {
        const rel = getAttribute(node, 'rel');
        if (rel) {
          const relTokens = rel.toLowerCase().split(/\s+/);
          if (relTokens.includes('stylesheet')) {
            const href = getAttribute(node, 'href');
            if (href && href.trim().length > 0) {
              stylesheetUrls.push(href.trim());
            }
          }
        }
      }

      // Identify body element
      if (tagName === 'body' && bodyElement === undefined) {
        bodyElement = node;
      }
    });

    const parsed: ParsedHtmlDocument = {
      isFragment: !isFullDoc,
      title: extractedTitle,
      description: extractedDescription,
      lang: extractedLang,
      styles,
      stylesheetUrls,
      rootElement,
      bodyElement,
      tailwind: detectTailwind(rootElement),
    };

    return {
      success: true,
      ...parsed,
      parsed,
      document: parsed,
      report,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      isFragment: false,
      styles: [],
      stylesheetUrls: [],
      report,
      error: message,
    };
  }
}
