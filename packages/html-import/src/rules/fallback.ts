/**
 * @kubuild/html-import
 * Fallback handling for unmapped HTML elements (STORA-611).
 * Translates unmapped elements into sanitized html-embed components or drops them.
 */

import { serialize } from 'parse5';
import { isSafeUrl } from '@kubuild/core';
import type { PageNode, HtmlImportOptions, HtmlImportReport } from '../types.js';
import { addDiagnostic } from '../types.js';
import { type ComputedElementStyles, type Parse5Element } from '../cascade.js';
import { computeElementStylesWithOverride } from '../style-override.js';
import { buildResponsiveStyles } from '../responsive.js';
import { getTextContent } from '../parser.js';
import {
  getElementLocation,
  isElement,
  isSafeStyleValue,
  PROHIBITED_TAGS,
  SVG_PROHIBITED_TAGS,
  sanitizeElement,
} from '../sanitizer.js';
import type { HtmlMappingContext, Parse5DocumentFragment } from './types.js';

/**
 * Checks whether an element is intrinsically safe to be converted to an html-embed fallback.
 * Prohibited tags, dangerous URL schemes, or non-visual metadata tags return false.
 *
 * @param element The parse5 element to inspect
 * @param options Import options including security limits
 * @returns True if the element is safe for fallback embedding, false if unsafe
 */
export function isElementSafeForEmbed(
  element: Parse5Element,
  options?: HtmlImportOptions,
): boolean {
  if (!element || !isElement(element)) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  // 1. Prohibited tags globally (script, noscript, object, embed, applet, base, template, frame, frameset)
  if (PROHIBITED_TAGS.has(tagName)) {
    return false;
  }

  // 2. Prohibited SVG tags (script, foreignobject, animate, set)
  if (SVG_PROHIBITED_TAGS.has(tagName)) {
    return false;
  }

  // 3. Document structure and non-visual metadata elements
  if (['meta', 'link', 'style', 'html', 'head', 'body'].includes(tagName)) {
    return false;
  }

  // 4. Iframes: check for safe source URLs
  if (tagName === 'iframe') {
    const srcAttr = element.attrs?.find((a) => a.name.toLowerCase() === 'src');
    if (srcAttr) {
      const isSafe = isSafeUrl(srcAttr.value, {
        allowedSchemes: options?.limits?.allowedUrlSchemes,
      });
      if (!isSafe) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Removes nested `<style>` elements whose CSS is unsafe (`@import`, `expression()`,
 * `javascript:` URLs, ...). Embedded markup is serialized verbatim into the html-embed
 * `html` prop, bypassing the stylesheet pipeline that strips such rules from page CSS.
 */
function removeUnsafeEmbeddedStyles(element: Parse5Element, report: HtmlImportReport): void {
  const children = element.childNodes ?? [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!isElement(child)) continue;
    if (child.tagName.toLowerCase() === 'style' && !isSafeStyleValue(getTextContent(child))) {
      addDiagnostic(report, {
        code: 'ELEMENT_DROPPED',
        severity: 'warning',
        message: 'Embedded <style> element with unsafe CSS was removed for security',
        location: getElementLocation(child),
        details: { tagName: child.tagName },
      });
      children.splice(i, 1);
      i--;
      continue;
    }
    removeUnsafeEmbeddedStyles(child, report);
  }
}

/**
 * Sanitizes an unmapped element's attributes and subtree, then serializes its outerHTML.
 * Returns null if the element cannot be safely sanitized or produces empty markup.
 *
 * @param element The parse5 element to sanitize and serialize
 * @param report The import report to record security diagnostics
 * @param options Import configuration options
 * @returns Sanitized outerHTML string, or null if dropped
 */
export function sanitizeAndSerializeElement(
  element: Parse5Element,
  report: HtmlImportReport,
  options?: HtmlImportOptions,
): string | null {
  if (!isElementSafeForEmbed(element, options)) {
    return null;
  }

  // Sanitize attributes and children in-place
  const keep = sanitizeElement(element, report, options);
  if (!keep) {
    return null;
  }

  removeUnsafeEmbeddedStyles(element, report);

  const serialized = serialize({
    nodeName: '#document-fragment',
    childNodes: [element],
  } as unknown as Parse5DocumentFragment);

  if (!serialized || serialized.trim().length === 0) {
    return null;
  }

  return serialized;
}

/**
 * Creates an html-embed PageNode for an element with sanitized HTML and responsive styles.
 *
 * @param element The parse5 element to embed
 * @param context HtmlMappingContext for ID generation, diagnostics, and options
 * @param computed Precomputed CSS styles for the element
 * @returns An html-embed PageNode, or null if the element is unsafe or empty
 */
export function createFallbackEmbedNode(
  element: Parse5Element,
  context: HtmlMappingContext,
  computed?: ComputedElementStyles,
): PageNode | null {
  const sanitizedHtml = sanitizeAndSerializeElement(element, context.report, context.options);
  if (!sanitizedHtml) {
    return null;
  }

  const computedStyles =
    computed ??
    (context.bundle
      ? computeElementStylesWithOverride(
          element,
          context.bundle,
          context.parentStyles,
          context.report,
          context.options,
        )
      : { base: {}, mediaQueries: [], pseudoStates: {} });

  return {
    id: context.generateId('embed'),
    type: 'html-embed',
    props: {
      html: sanitizedHtml,
    },
    styles: buildResponsiveStyles(computedStyles, context.report),
    children: [],
  };
}

/**
 * Handles fallback conversion for an unmapped HTML element.
 * Follows options.fallback ('embed' | 'drop', default: 'embed').
 *
 * - When fallback === 'drop': drops the element, records ELEMENT_DROPPED diagnostic, and returns null.
 * - When fallback === 'embed': verifies safety. If unsafe, drops with ELEMENT_DROPPED.
 *   Otherwise, converts to an html-embed PageNode, records ELEMENT_FALLBACK_EMBED diagnostic,
 *   increments fallbackCount, and recomputes fidelity score.
 *
 * @param element The unmapped parse5 element
 * @param context Mapping context
 * @param computed Precomputed CSS styles
 * @returns Fallback PageNode or null
 */
export function handleFallbackElement(
  element: Parse5Element,
  context: HtmlMappingContext,
  computed?: ComputedElementStyles,
): PageNode | null {
  if (!element || !isElement(element)) {
    return null;
  }

  const fallbackStrategy = context.options?.fallback ?? 'embed';
  const location = getElementLocation(element);

  if (fallbackStrategy === 'drop') {
    addDiagnostic(context.report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Element <${element.tagName}> has no matching mapping rule; dropped as requested by options.fallback.`,
      location,
      details: {
        tagName: element.tagName,
      },
    });
    return null;
  }

  // fallbackStrategy === 'embed' (default)
  if (!isElementSafeForEmbed(element, context.options)) {
    addDiagnostic(context.report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Unsafe or prohibited element <${element.tagName}> cannot be converted to fallback embed and was dropped for security.`,
      location,
      details: {
        tagName: element.tagName,
      },
    });
    return null;
  }

  const node = createFallbackEmbedNode(element, context, computed);
  if (!node) {
    addDiagnostic(context.report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Element <${element.tagName}> produced empty or invalid markup after sanitization and was dropped.`,
      location,
      details: {
        tagName: element.tagName,
      },
    });
    return null;
  }

  addDiagnostic(context.report, {
    code: 'ELEMENT_FALLBACK_EMBED',
    severity: 'warning',
    message: `Element <${element.tagName}> has no matching mapping rule; converted to fallback html-embed.`,
    location,
    details: {
      tagName: element.tagName,
    },
  });

  return node;
}
