/**
 * @kubuild/html-import
 * AST-based HTML sanitizer with allowlists and diagnostic reporting.
 */

import {
  parse,
  parseFragment,
  serialize,
  type DefaultTreeAdapterMap,
} from 'parse5';
import { isSafeUrl } from '@kubuild/core';
import {
  addDiagnostic,
  createEmptyReport,
  type HtmlImportDiagnosticLocation,
  type HtmlImportOptions,
  type HtmlImportReport,
} from './types.js';
import { isFullHtmlDocument } from './parser.js';

/**
 * Prohibited HTML tags that must be completely removed along with their subtrees.
 */
export const PROHIBITED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'noscript',
  'object',
  'embed',
  'applet',
  'base',
  'template',
  'frame',
  'frameset',
]);

/**
 * Prohibited SVG tags that execute scripts or introduce unsafe contexts.
 */
export const SVG_PROHIBITED_TAGS: ReadonlySet<string> = new Set([
  'script',
  'foreignobject',
  'animate',
  'set',
]);

/**
 * HTML/SVG attributes containing URLs that must pass `isSafeUrl`.
 */
export const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
  'href',
  'src',
  'action',
  'poster',
  'cite',
  'data',
  'background',
]);

/**
 * Regex pattern identifying dangerous keywords or expressions in CSS style values.
 */
export const DANGEROUS_STYLE_VALUE_PATTERN =
  // `behavior`/`binding` only as whole property names (IE `behavior`, `-ms-behavior`,
  // `-moz-binding`), so `scroll-behavior` / `overscroll-behavior` are not flagged.
  /javascript:|expression\s*\(|@import|<script|vbscript:|data:text\/html|(?:^|[^\w-]|-ms-)behavior\s*:|(?:^|[^\w-]|-moz-)binding\s*:/i;

/**
 * Type guard for parse5 element nodes.
 */
export function isElement(
  node: DefaultTreeAdapterMap['node'],
): node is DefaultTreeAdapterMap['element'] {
  return (
    node !== null &&
    typeof node === 'object' &&
    'tagName' in node &&
    typeof (node as { tagName: unknown }).tagName === 'string'
  );
}

/**
 * Retrieves the diagnostic location for a parse5 element.
 */
export function getElementLocation(
  element: DefaultTreeAdapterMap['element'],
): HtmlImportDiagnosticLocation {
  const loc = element.sourceCodeLocation;
  return {
    line: loc?.startLine,
    column: loc?.startCol,
    tagName: element.tagName,
  };
}

/**
 * Retrieves the diagnostic location for a specific attribute of an element.
 */
export function getAttrLocation(
  element: DefaultTreeAdapterMap['element'],
  attrName: string,
  rawName?: string,
): HtmlImportDiagnosticLocation {
  const loc = element.sourceCodeLocation;
  const attrLoc =
    loc && 'attrs' in loc && loc.attrs
      ? loc.attrs[attrName.toLowerCase()] ??
        loc.attrs[attrName] ??
        (rawName ? loc.attrs[rawName.toLowerCase()] ?? loc.attrs[rawName] : undefined)
      : undefined;

  return {
    line: attrLoc?.startLine ?? loc?.startLine,
    column: attrLoc?.startCol ?? loc?.startCol,
    tagName: element.tagName,
  };
}

/**
 * Extracts individual candidate URLs from an HTML `srcset` attribute.
 */
export function parseSrcsetUrls(srcset: string): string[] {
  if (!srcset || typeof srcset !== 'string') return [];
  const parts = srcset.split(/\s*,\s*/);
  const urls: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    let p = parts[i].trim();
    // Handle data:image/...;base64, which may contain a comma
    if (
      p.startsWith('data:image/') &&
      p.includes(';base64') &&
      !p.includes(',') &&
      i + 1 < parts.length
    ) {
      p = `${p},${parts[i + 1].trim()}`;
      i++;
    }
    if (p.length > 0) {
      const url = p.split(/\s+/)[0];
      if (url) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * Validates that every candidate URL in an HTML `srcset` string is safe.
 */
export function isSafeSrcset(
  srcset: string,
  options?: HtmlImportOptions,
): boolean {
  if (typeof srcset !== 'string') return false;
  const urls = parseSrcsetUrls(srcset);
  if (urls.length === 0) return true;

  return urls.every((url) =>
    isSafeUrl(url, {
      allowedSchemes: options?.limits?.allowedUrlSchemes,
      allowDataImage: true,
    }),
  );
}

/**
 * Checks whether an inline CSS style attribute value is safe against XSS and script injection.
 */
export function isSafeStyleValue(style: string): boolean {
  if (typeof style !== 'string') return false;
  const trimmed = style.trim();
  if (trimmed.length === 0) return true;

  if (DANGEROUS_STYLE_VALUE_PATTERN.test(trimmed)) {
    return false;
  }

  // Check with CSS comments removed, e.g. java/*comment*/script:
  const withoutComments = trimmed.replace(/\/\*[\s\S]*?\*\//g, '');
  if (DANGEROUS_STYLE_VALUE_PATTERN.test(withoutComments)) {
    return false;
  }

  // Decode hex backslash escapes, e.g. \6a avascript:
  const decoded = withoutComments.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return '';
    }
  });

  if (DANGEROUS_STYLE_VALUE_PATTERN.test(decoded)) {
    return false;
  }

  // Inspect any url(...) references in the style
  const urlRegex = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(decoded)) !== null) {
    const rawUrl = match[2];
    if (rawUrl && !isSafeUrl(rawUrl, { allowDataImage: true })) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether an element is inside an SVG tree.
 */
function isSvgNode(
  element: DefaultTreeAdapterMap['element'],
  parentIsSvg: boolean,
): boolean {
  return (
    parentIsSvg ||
    element.tagName.toLowerCase() === 'svg' ||
    element.namespaceURI === 'http://www.w3.org/2000/svg'
  );
}

/**
 * Internal recursive sanitizer for a single element node.
 * Returns `true` if the element should be kept, or `false` if it must be dropped.
 */
export function sanitizeElement(
  element: DefaultTreeAdapterMap['element'],
  report: HtmlImportReport,
  options?: HtmlImportOptions,
  parentIsSvg = false,
): boolean {
  const tagName = element.tagName.toLowerCase();
  const isSvg = isSvgNode(element, parentIsSvg);

  // 1. Prohibited tags globally
  if (PROHIBITED_TAGS.has(tagName)) {
    addDiagnostic(report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Prohibited element <${element.tagName}> and its subtree were removed for security`,
      location: getElementLocation(element),
      details: { tagName: element.tagName },
    });
    return false;
  }

  // 2. Prohibited SVG tags
  if (isSvg && SVG_PROHIBITED_TAGS.has(tagName)) {
    addDiagnostic(report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Prohibited SVG element <${element.tagName}> was removed for security`,
      location: getElementLocation(element),
      details: { tagName: element.tagName },
    });
    return false;
  }

  // 2b. SVG <style> is serialized verbatim into the icon `svg` prop (it never reaches the
  // stylesheet pipeline that strips `@import`/dangerous declarations), so drop it when unsafe.
  if (isSvg && tagName === 'style') {
    const cssText = (element.childNodes ?? [])
      .map((child) => ('value' in child && typeof child.value === 'string' ? child.value : ''))
      .join('');
    if (!isSafeStyleValue(cssText)) {
      addDiagnostic(report, {
        code: 'ELEMENT_DROPPED',
        severity: 'warning',
        message: `SVG <style> element with unsafe CSS (e.g. @import, expression(), javascript: URL) was removed for security`,
        location: getElementLocation(element),
        details: { tagName: element.tagName },
      });
      return false;
    }
  }

  // 3. Conditional: remove <meta> if it has http-equiv
  if (tagName === 'meta') {
    const hasHttpEquiv = element.attrs?.some(
      (attr) => attr.name.toLowerCase() === 'http-equiv',
    );
    if (hasHttpEquiv) {
      addDiagnostic(report, {
        code: 'ELEMENT_DROPPED',
        severity: 'warning',
        message: `Prohibited <meta> element with "http-equiv" attribute was removed for security`,
        location: getElementLocation(element),
        details: { tagName: 'meta', attribute: 'http-equiv' },
      });
      return false;
    }
  }

  // 4. Conditional: remove <link> if it is not stylesheet/icon or contains malicious rel/unsafe href
  if (tagName === 'link') {
    const relAttr = element.attrs?.find((a) => a.name.toLowerCase() === 'rel');
    const relValue = relAttr?.value?.toLowerCase().trim() ?? '';
    const relTokens = relValue.split(/\s+/).filter(Boolean);

    const hasMaliciousRel = relTokens.some((t) => t === 'import');
    const isAllowedRel = relTokens.some((t) =>
      [
        'stylesheet',
        'icon',
        'shortcut',
        'apple-touch-icon',
        'mask-icon',
        'preload',
        'prefetch',
        'dns-prefetch',
        'preconnect',
      ].includes(t),
    );

    const hrefAttr = element.attrs?.find((a) => a.name.toLowerCase() === 'href');
    const isHrefSafe = hrefAttr
      ? isSafeUrl(hrefAttr.value, {
          allowedSchemes: options?.limits?.allowedUrlSchemes,
          allowDataImage: true,
        })
      : true;

    if (relTokens.length === 0 || hasMaliciousRel || !isAllowedRel || !isHrefSafe) {
      addDiagnostic(report, {
        code: 'ELEMENT_DROPPED',
        severity: 'warning',
        message: `Prohibited or unsupported <link> element (rel="${relValue}") was removed for security`,
        location: getElementLocation(element),
        details: { tagName: 'link', rel: relValue },
      });
      if (!isHrefSafe && hrefAttr) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Blocked unsafe URL in <link> href: "${hrefAttr.value}"`,
          location: getAttrLocation(element, 'href'),
          details: { tagName: 'link', attribute: 'href', url: hrefAttr.value },
        });
      }
      return false;
    }
  }

  // 5. Sanitize element attributes
  const sanitizedAttrs: DefaultTreeAdapterMap['element']['attrs'] = [];
  const originalAttrs = element.attrs ?? [];

  for (const attr of originalAttrs) {
    const rawName = attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
    const lowerName = rawName.toLowerCase();
    const baseName = attr.name.toLowerCase();
    const location = getAttrLocation(element, attr.name, rawName);

    // a. Prohibit inline event handlers (on*)
    if (/^on[a-z0-9_-]/i.test(baseName) || /^on[a-z0-9_-]/i.test(lowerName)) {
      addDiagnostic(report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Prohibited event handler attribute "${rawName}" was stripped`,
        location,
        details: { tagName: element.tagName, attribute: rawName },
      });
      continue;
    }

    // b. Prohibit srcdoc
    if (baseName === 'srcdoc' || lowerName === 'srcdoc') {
      addDiagnostic(report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Prohibited "srcdoc" attribute was stripped for security`,
        location,
        details: { tagName: element.tagName, attribute: rawName },
      });
      continue;
    }

    // c. Prohibit formaction
    if (baseName === 'formaction' || lowerName === 'formaction') {
      addDiagnostic(report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Prohibited "formaction" attribute was stripped for security`,
        location,
        details: { tagName: element.tagName, attribute: rawName },
      });
      continue;
    }

    // d. Validate inline style attribute
    if (baseName === 'style') {
      if (!isSafeStyleValue(attr.value)) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Dangerous expression or unsafe URL in "style" attribute was stripped: "${attr.value}"`,
          location,
          details: { tagName: element.tagName, attribute: 'style', value: attr.value },
        });
        continue;
      }
    }

    // e. Validate srcset attribute
    if (baseName === 'srcset' || lowerName === 'srcset') {
      if (!isSafeSrcset(attr.value, options)) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Blocked unsafe URL in "srcset" attribute: "${attr.value}"`,
          location,
          details: { tagName: element.tagName, attribute: 'srcset', value: attr.value },
        });
        continue;
      }
    }

    // f. Validate standard and namespaced URL attributes (href, src, action, xlink:href, etc.)
    const isUrlAttr =
      URL_ATTRIBUTES.has(baseName) ||
      URL_ATTRIBUTES.has(lowerName) ||
      lowerName.endsWith(':href') ||
      attr.prefix?.toLowerCase() === 'xlink';

    if (isUrlAttr) {
      const isSafe = isSafeUrl(attr.value, {
        allowedSchemes: options?.limits?.allowedUrlSchemes,
        allowDataImage: true,
      });

      if (!isSafe) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Blocked unsafe URL in attribute "${rawName}": "${attr.value}"`,
          location,
          details: { tagName: element.tagName, attribute: rawName, url: attr.value },
        });
        continue;
      }
    }

    sanitizedAttrs.push(attr);
  }

  element.attrs = sanitizedAttrs;

  // 6. Recursively sanitize children
  if (element.childNodes && Array.isArray(element.childNodes)) {
    for (let i = 0; i < element.childNodes.length; i++) {
      const child = element.childNodes[i];
      const keep = sanitizeChildNode(child, report, options, isSvg);
      if (!keep) {
        element.childNodes.splice(i, 1);
        i--;
      }
    }
  }

  return true;
}

/**
 * Sanitizes a generic parse5 child node.
 */
function sanitizeChildNode(
  node: DefaultTreeAdapterMap['node'],
  report: HtmlImportReport,
  options?: HtmlImportOptions,
  parentIsSvg = false,
): boolean {
  if (isElement(node)) {
    return sanitizeElement(node, report, options, parentIsSvg);
  }

  // Non-element parent node (e.g. document fragment or template content)
  if ('childNodes' in node && Array.isArray(node.childNodes)) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      const keep = sanitizeChildNode(child, report, options, parentIsSvg);
      if (!keep) {
        node.childNodes.splice(i, 1);
        i--;
      }
    }
  }

  return true;
}

/**
 * Traverses and sanitizes a parse5 AST in-place using security allowlists and rules.
 *
 * Removes prohibited elements (along with their subtrees), strips unsafe event handlers,
 * removes dangerous inline styles, and validates all URL attributes with `isSafeUrl`.
 * Diagnostics are recorded into `report`.
 *
 * @param rootNode Root parse5 node (Document, DocumentFragment, or Element)
 * @param report HtmlImportReport to append diagnostics and update statistics
 * @param options Import configuration options including security limits
 */
export function sanitizeAst(
  rootNode: DefaultTreeAdapterMap['node'],
  report: HtmlImportReport,
  options?: HtmlImportOptions,
): DefaultTreeAdapterMap['node'] {
  if (!rootNode) return rootNode;

  if (isElement(rootNode)) {
    const keep = sanitizeElement(rootNode, report, options, false);
    if (!keep) {
      rootNode.childNodes = [];
      rootNode.attrs = [];
    }
    return rootNode;
  }

  if ('childNodes' in rootNode && Array.isArray(rootNode.childNodes)) {
    for (let i = 0; i < rootNode.childNodes.length; i++) {
      const child = rootNode.childNodes[i];
      const keep = sanitizeChildNode(child, report, options, false);
      if (!keep) {
        rootNode.childNodes.splice(i, 1);
        i--;
      }
    }
  }

  return rootNode;
}

/**
 * Sanitizes an untrusted HTML snippet or string and returns the cleaned HTML string and report.
 * Suitable for reuse by fallback html-embed components or fragment importers.
 *
 * @param html The untrusted HTML string to sanitize
 * @param options Import configuration options including security limits
 * @returns Object with sanitized HTML string and comprehensive report
 */
export function sanitizeHtmlSnippet(
  html: string,
  options?: HtmlImportOptions,
): { html: string; report: HtmlImportReport } {
  const report = createEmptyReport();

  if (typeof html !== 'string') {
    return { html: '', report };
  }

  if (html.trim().length === 0) {
    return { html: '', report };
  }

  const isFullDoc = isFullHtmlDocument(html);
  const ast = isFullDoc
    ? parse(html, { sourceCodeLocationInfo: true })
    : parseFragment(html, { sourceCodeLocationInfo: true });

  sanitizeAst(ast, report, options);

  const sanitizedHtml = serialize(ast);
  return { html: sanitizedHtml, report };
}
