/**
 * @kubuild/html-import
 * Default mapping rules for layout and typography elements (STORA-608).
 *
 * Supported elements:
 * - Layout: section, header, footer, main, nav, article, aside -> section
 * - Containers: div (flex / grid / container based on display)
 * - Typography: h1–h6 -> heading, p -> paragraph, span -> text
 * - Blocks: blockquote -> blockquote, pre/code -> code-block, hr -> divider
 * - Inline: a -> link
 * - Bare text nodes in containers: whitespace collapsed, empty ignored -> text
 */

import type { DefaultTreeAdapterMap } from 'parse5';
import { isSafeUrl } from '@kubuild/core';
import {
  addDiagnostic,
  type PageNode,
} from '../types.js';
import { isElement } from '../sanitizer.js';
import { getTextContent, getAttribute } from '../parser.js';
import { buildResponsiveStyles } from '../responsive.js';
import type {
  HtmlMappingContext,
  HtmlMappingRule,
} from './types.js';

/**
 * Type guard for parse5 text nodes.
 */
export function isTextNode(
  node: DefaultTreeAdapterMap['node'],
): node is DefaultTreeAdapterMap['textNode'] {
  return (
    node !== null &&
    typeof node === 'object' &&
    'nodeName' in node &&
    (node as { nodeName: unknown }).nodeName === '#text' &&
    'value' in node &&
    typeof (node as { value: unknown }).value === 'string'
  );
}

/**
 * Collapses whitespace sequences according to standard HTML whitespace collapsing rules.
 * Multiple spaces, tabs, and newlines become a single space, and outer whitespace is trimmed.
 */
export function collapseWhitespace(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  return text.replace(/[\s\r\n\t]+/g, ' ').trim();
}

/**
 * Recursively extracts raw text content from a DOM node without collapsing whitespace.
 * Used for pre and code blocks where whitespace preservation is mandatory.
 */
export function getRawTextContent(node: DefaultTreeAdapterMap['node']): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  if ('nodeName' in node && node.nodeName === '#text' && 'value' in node) {
    return typeof node.value === 'string' ? node.value : '';
  }
  let text = '';
  if ('childNodes' in node && Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      text += getRawTextContent(child);
    }
  }
  return text;
}

/**
 * Set of block-level HTML tags used to determine block boundaries during whitespace collapsing.
 */
export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  'html',
  'body',
  'div',
  'section',
  'header',
  'footer',
  'main',
  'nav',
  'article',
  'aside',
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'hr',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'td',
  'th',
  'form',
  'fieldset',
]);

/**
 * Determines whether a parse5 node represents a block-level HTML element.
 */
export function isBlockElement(node: DefaultTreeAdapterMap['node']): boolean {
  return isElement(node) && BLOCK_TAGS.has(node.tagName.toLowerCase());
}

/**
 * Converts a raw / bare text node within a container into a KUBUILD 'text' PageNode,
 * collapsing whitespace and trimming leading/trailing whitespace adjacent to block edges.
 *
 * If the resulting collapsed text is empty, returns null.
 */
export function convertRawTextNode(
  textNode: DefaultTreeAdapterMap['textNode'],
  index: number,
  siblings: DefaultTreeAdapterMap['node'][],
  context: HtmlMappingContext,
): PageNode | null {
  const rawValue = typeof textNode.value === 'string' ? textNode.value : '';
  if (rawValue.length === 0) {
    return null;
  }

  // 1. Collapse multiple whitespace characters into a single space
  let collapsed = rawValue.replace(/[\s\r\n\t]+/g, ' ');

  // 2. Identify nearest non-comment previous sibling
  let prevSibling: DefaultTreeAdapterMap['node'] | null = null;
  for (let i = index - 1; i >= 0; i--) {
    const s = siblings[i];
    if ('nodeName' in s && s.nodeName === '#comment') {
      continue;
    }
    prevSibling = s;
    break;
  }

  // 3. Identify nearest non-comment next sibling
  let nextSibling: DefaultTreeAdapterMap['node'] | null = null;
  for (let i = index + 1; i < siblings.length; i++) {
    const s = siblings[i];
    if ('nodeName' in s && s.nodeName === '#comment') {
      continue;
    }
    nextSibling = s;
    break;
  }

  // 4. Trim leading whitespace if adjacent to container start or preceding block element
  if (!prevSibling || isBlockElement(prevSibling)) {
    collapsed = collapsed.replace(/^\s+/, '');
  }

  // 5. Trim trailing whitespace if adjacent to container end or following block element
  if (!nextSibling || isBlockElement(nextSibling)) {
    collapsed = collapsed.replace(/\s+$/, '');
  }

  // 6. If empty after collapsing and edge trimming, produce no node
  if (collapsed.length === 0) {
    return null;
  }

  return {
    id: context.generateId('text'),
    type: 'text',
    props: {
      text: collapsed,
      as: 'span',
    },
    styles: {
      base: context.parentStyles ? { ...context.parentStyles } : {},
    },
    children: [],
  };
}

/**
 * HTML tags mapped to KUBUILD 'section' component.
 */
export const SECTION_TAGS: ReadonlySet<string> = new Set([
  'section',
  'header',
  'footer',
  'main',
  'nav',
  'article',
  'aside',
]);

/**
 * Mapping rule for section, header, footer, main, nav, article, aside.
 */
export const sectionRule: HtmlMappingRule = {
  id: 'section',
  priority: 40,
  match: (element) => SECTION_TAGS.has(element.tagName.toLowerCase()),
  convert: (element, context, computed) => {
    const ariaLabel = getAttribute(element, 'aria-label') ?? getAttribute(element, 'ariaLabel');
    const role = getAttribute(element, 'role');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {};
    if (ariaLabel) props.ariaLabel = ariaLabel;
    if (role) props.role = role;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('section'),
      type: 'section',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: context.convertChildren(element),
    };
  },
};

/**
 * HTML tags mapped to KUBUILD container/flex/grid components.
 */
export const CONTAINER_TAGS: ReadonlySet<string> = new Set(['div', 'address']);

/**
 * Mapping rule for div (and semantic containers).
 * Maps to 'flex' if display is flex, 'grid' if display is grid, otherwise 'container'.
 */
export const containerRule: HtmlMappingRule = {
  id: 'container',
  priority: 30,
  match: (element) => CONTAINER_TAGS.has(element.tagName.toLowerCase()),
  convert: (element, context, computed) => {
    const display = String(computed.base?.display ?? '').toLowerCase().trim();
    let type: 'flex' | 'grid' | 'container' = 'container';
    if (display === 'flex') {
      type = 'flex';
    } else if (display === 'grid') {
      type = 'grid';
    }

    const ariaLabel = getAttribute(element, 'aria-label') ?? getAttribute(element, 'ariaLabel');
    const role = getAttribute(element, 'role');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {};
    if (ariaLabel) props.ariaLabel = ariaLabel;
    if (role) props.role = role;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId(type),
      type,
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: context.convertChildren(element),
    };
  },
};

/**
 * Mapping rule for h1–h6 headings.
 */
export const headingRule: HtmlMappingRule = {
  id: 'heading',
  priority: 50,
  match: (element) => /^h[1-6]$/i.test(element.tagName),
  convert: (element, context, computed) => {
    const level = element.tagName.toLowerCase();
    const text = collapseWhitespace(getTextContent(element));
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      level,
      text,
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('heading'),
      type: 'heading',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for paragraph elements (<p>).
 */
export const paragraphRule: HtmlMappingRule = {
  id: 'paragraph',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'p',
  convert: (element, context, computed) => {
    const text = collapseWhitespace(getTextContent(element));
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      text,
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('para'),
      type: 'paragraph',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for inline span elements (<span>).
 */
export const textRule: HtmlMappingRule = {
  id: 'text',
  priority: 40,
  match: (element) => element.tagName.toLowerCase() === 'span',
  convert: (element, context, computed) => {
    const text = collapseWhitespace(getTextContent(element));
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      text,
      as: 'span',
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('text'),
      type: 'text',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <blockquote> elements.
 */
export const blockquoteRule: HtmlMappingRule = {
  id: 'blockquote',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'blockquote',
  convert: (element, context, computed) => {
    let cite = getAttribute(element, 'cite');
    const idAttr = getAttribute(element, 'id');

    // Extract cite text from child <cite> element if not present in cite attribute
    const citeChild = element.childNodes.find(
      (c): c is DefaultTreeAdapterMap['element'] => isElement(c) && c.tagName.toLowerCase() === 'cite',
    );
    if (citeChild) {
      const citeText = collapseWhitespace(getTextContent(citeChild));
      if (!cite && citeText) {
        cite = citeText;
      }
    }

    // Check if blockquote has complex element children (other than simple p/cite)
    const hasComplexChildren = element.childNodes.some(
      (c) => isElement(c) && c.tagName.toLowerCase() !== 'p' && c.tagName.toLowerCase() !== 'cite',
    );

    if (hasComplexChildren) {
      const props: Record<string, unknown> = {};
      if (cite) props.cite = cite;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('quote'),
        type: 'blockquote',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: context.convertChildren(element),
      };
    }

    // Extract quote text from <p> children or direct text nodes
    let quoteText = '';
    for (const child of element.childNodes) {
      if (isElement(child)) {
        if (child.tagName.toLowerCase() === 'p') {
          const pText = collapseWhitespace(getTextContent(child));
          quoteText = quoteText ? `${quoteText}\n${pText}` : pText;
        }
      } else if (isTextNode(child)) {
        const t = collapseWhitespace(child.value);
        if (t) {
          quoteText = quoteText ? `${quoteText} ${t}` : t;
        }
      }
    }

    const props: Record<string, unknown> = {
      quote: quoteText,
      text: quoteText,
    };
    if (cite) props.cite = cite;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('quote'),
      type: 'blockquote',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <pre> and <code> elements.
 * Whitespace is strictly preserved without collapsing.
 */
export const codeBlockRule: HtmlMappingRule = {
  id: 'code-block',
  priority: 50,
  match: (element) => {
    const tag = element.tagName.toLowerCase();
    return tag === 'pre' || tag === 'code';
  },
  convert: (element, context, computed) => {
    const tag = element.tagName.toLowerCase();
    const idAttr = getAttribute(element, 'id');

    let targetElement = element;
    if (tag === 'pre') {
      const codeChild = element.childNodes.find(
        (c): c is DefaultTreeAdapterMap['element'] => isElement(c) && c.tagName.toLowerCase() === 'code',
      );
      if (codeChild) {
        targetElement = codeChild;
      }
    }

    const classAttr =
      getAttribute(targetElement, 'class') ?? getAttribute(element, 'class') ?? '';
    const langMatch = classAttr.match(/(?:^|\s)(?:language|lang)-([a-zA-Z0-9_-]+)/i);
    const language = langMatch ? langMatch[1] : undefined;

    const rawCode = getRawTextContent(targetElement);

    const props: Record<string, unknown> = {
      code: rawCode,
    };
    if (language) props.language = language;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('code'),
      type: 'code-block',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <hr> divider elements.
 */
export const dividerRule: HtmlMappingRule = {
  id: 'divider',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'hr',
  convert: (element, context, computed) => {
    const idAttr = getAttribute(element, 'id');
    const props: Record<string, unknown> = {};
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('divider'),
      type: 'divider',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for anchor link elements (<a>).
 */
export const linkRule: HtmlMappingRule = {
  id: 'link',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'a',
  convert: (element, context, computed) => {
    const rawHref = getAttribute(element, 'href') ?? '#';
    let safeHref = rawHref;

    if (!isSafeUrl(rawHref)) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Unsafe or disallowed URL scheme in link href="${rawHref}" was sanitized to "#"`,
        location: {
          tagName: element.tagName,
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { url: rawHref, attribute: 'href' },
      });
      safeHref = '#';
    }

    const target = getAttribute(element, 'target');
    const rel = getAttribute(element, 'rel');
    const idAttr = getAttribute(element, 'id');

    const hasElementChildren = element.childNodes.some(isElement);

    const props: Record<string, unknown> = {
      href: safeHref,
    };
    if (target) props.target = target;
    if (rel) props.rel = rel;
    if (idAttr) props.id = idAttr;

    let children: PageNode[] = [];
    if (hasElementChildren) {
      children = context.convertChildren(element);
    } else {
      props.text = collapseWhitespace(getTextContent(element));
    }

    return {
      id: context.generateId('link'),
      type: 'link',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children,
    };
  },
};

/**
 * Default layout and typography mapping rules.
 */
export const DEFAULT_LAYOUT_TYPOGRAPHY_RULES: readonly HtmlMappingRule[] = Object.freeze([
  headingRule,
  paragraphRule,
  textRule,
  blockquoteRule,
  codeBlockRule,
  dividerRule,
  linkRule,
  sectionRule,
  containerRule,
]);

/**
 * Default HTML element mapping rules registered in the registry.
 */
export const DEFAULT_HTML_MAPPING_RULES: readonly HtmlMappingRule[] = DEFAULT_LAYOUT_TYPOGRAPHY_RULES;
