/**
 * @kubuild/html-import
 * Stylesheet collection, tolerant CSS parsing, security filtering, and rule extraction.
 */

import * as csstree from 'css-tree';
import {
  addDiagnostic,
  createEmptyReport,
  type HtmlImportOptions,
  type HtmlImportReport,
} from './types.js';
import {
  getAttribute,
  getTextContent,
  walkTree,
  type ParsedHtmlDocument,
} from './parser.js';
import { isElement, isSafeStyleValue } from './sanitizer.js';
import { buildTailwindRules, type TailwindMode } from './tailwind.js';

/**
 * Single CSS declaration with property name, serialized value, and !important flag.
 */
export interface ParsedCssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

/**
 * Parsed CSS rule containing selector, optional media query, declarations, and source order.
 */
export interface ParsedCssRule {
  selector: string;
  mediaQuery?: string;
  declarations: ParsedCssDeclaration[];
  sourceOrder: number;
}

/**
 * Bundle containing all parsed CSS rules and extracted :root / html custom properties.
 */
export interface ParsedStylesheetBundle {
  rules: ParsedCssRule[];
  customProperties: Record<string, string>;
}

/**
 * Set of dangerous CSS property names known to trigger script execution or external bindings.
 */
export const DANGEROUS_PROPERTY_NAMES: ReadonlySet<string> = new Set([
  'behavior',
  'binding',
  '-moz-binding',
  '-ms-behavior',
]);

/**
 * Checks whether a declaration's property or value represents an injection vector.
 */
export function isDangerousDeclaration(property: string, value: string): boolean {
  const prop = property.trim().toLowerCase();
  if (DANGEROUS_PROPERTY_NAMES.has(prop)) {
    return true;
  }
  if (!isSafeStyleValue(value)) {
    return true;
  }
  if (!isSafeStyleValue(`${property}: ${value}`)) {
    return true;
  }
  // css-tree turns comments into whitespace (`ex/**/pression(` → `ex pression(`), so also
  // check the value with whitespace collapsed to catch comment-split keywords.
  if (!isSafeStyleValue(value.replace(/\s+/g, ''))) {
    return true;
  }
  return false;
}

/**
 * Checks whether a CSS selector targets the document root (:root or html).
 */
export function isRootOrHtmlSelector(selector: string): boolean {
  const parts = selector.split(/\s*,\s*/);
  return parts.some((p) => {
    const s = p.trim().toLowerCase();
    return s === ':root' || s === 'html' || s === 'html:root' || s === ':root html';
  });
}

/**
 * Checks whether a string looks like an external stylesheet URL rather than raw CSS content.
 */
export function isUrlLike(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.includes('{') || trimmed.includes('}')) {
    return false;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return true;
  }
  if (/^[./#]?[\w\-./]+\.css(?:\?[^\s]*)?$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Resolves a stylesheet href against an optional base URL.
 */
export function resolveStylesheetHref(href: string, baseUrl?: string): string {
  if (!baseUrl) return href;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/**
 * Parses a CSS string using css-tree in tolerant mode, extracting rules and custom properties.
 *
 * Enforces security validations:
 * - Drops `@import` rules and records a diagnostic.
 * - Drops dangerous declarations matching `DANGEROUS_STYLE_VALUE_PATTERN`, `expression(...)`, etc.
 * - Extracts `@media` conditions and nests them with their rules.
 * - Collects `:root` and `html` `--*` custom properties into a dictionary.
 * - Preserves sequential source order for specificity cascade calculation.
 *
 * Malformed CSS is handled resiliently without throwing.
 *
 * @param css The CSS text to parse
 * @param sourceOrderStart Starting index for rule source order (defaults to 0)
 * @param report Optional report to append diagnostics to
 * @param defaultMediaQuery Optional media query to inherit (e.g. from `<style media="...">`)
 */
export function parseCssString(
  css: string,
  sourceOrderStart = 0,
  report?: HtmlImportReport,
  defaultMediaQuery?: string,
): { rules: ParsedCssRule[]; customProperties: Record<string, string>; nextSourceOrder: number } {
  let currentOrder = sourceOrderStart;
  const rules: ParsedCssRule[] = [];
  const customProperties: Record<string, string> = {};

  if (typeof css !== 'string' || css.trim().length === 0) {
    return { rules, customProperties, nextSourceOrder: currentOrder };
  }

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(css, {
      parseAtrulePrelude: true,
      parseRulePrelude: true,
      parseValue: true,
      onParseError() {
        // Tolerant parsing mode: ignore syntax error and continue AST construction
      },
    });
  } catch {
    // Malformed CSS resilience: if parse fails completely, return safely without throwing
    return { rules, customProperties, nextSourceOrder: currentOrder };
  }

  const mediaStack: string[] = [];
  if (defaultMediaQuery && defaultMediaQuery.trim().length > 0) {
    mediaStack.push(defaultMediaQuery.trim());
  }

  csstree.walk(ast, {
    enter(node: csstree.CssNode) {
      if (node.type === 'Atrule') {
        const atruleName = node.name.toLowerCase();

        // Detect and drop @import rules
        if (atruleName === 'import') {
          const importPrelude = node.prelude ? csstree.generate(node.prelude).trim() : '';
          if (report) {
            addDiagnostic(report, {
              code: 'CSS_UNSUPPORTED_PROPERTY',
              severity: 'warning',
              message: '@import is not supported',
              details: {
                rule: `@import ${importPrelude}`.trim(),
              },
            });
          }
          return csstree.walk.skip;
        }

        // Handle @media queries
        if (atruleName === 'media' && node.prelude) {
          const rawMedia = csstree.generate(node.prelude).trim();
          const formattedMedia = rawMedia
            .replace(/:\s*/g, ': ')
            .replace(/,\s*/g, ', ')
            .trim();
          mediaStack.push(formattedMedia);
        }
      } else if (node.type === 'Rule') {
        let selector = '';
        if (node.prelude) {
          if (node.prelude.type === 'SelectorList') {
            const parts: string[] = [];
            node.prelude.children.forEach((child: csstree.CssNode) => {
              const cleaned = csstree.generate(child).replace(/^[};,\s]+/, '').trim();
              if (cleaned.length > 0) {
                parts.push(cleaned);
              }
            });
            selector = parts.join(', ');
          } else {
            selector = csstree.generate(node.prelude).replace(/^[};,\s]+/, '').trim();
          }
        }

        if (!selector) {
          return csstree.walk.skip;
        }

        const declarations: ParsedCssDeclaration[] = [];
        if (node.block && node.block.children) {
          node.block.children.forEach((child: csstree.CssNode) => {
            if (child.type === 'Declaration') {
              const property = child.property;
              const value = child.value ? csstree.generate(child.value).trim() : '';
              const important = Boolean(child.important);

              if (!value) {
                return;
              }

              // Check for dangerous property name or value
              if (isDangerousDeclaration(property, value)) {
                if (report) {
                  const isUrlBlocked =
                    /javascript:|vbscript:|data:text\/html/i.test(value) ||
                    (/url\s*\(/i.test(value) && !isSafeStyleValue(value));
                  const code = isUrlBlocked ? 'URL_BLOCKED' : 'CSS_UNSUPPORTED_PROPERTY';
                  addDiagnostic(report, {
                    code,
                    severity: 'warning',
                    message: `Dangerous CSS property or value dropped: ${property}: ${value}`,
                    location: {
                      selector,
                    },
                    details: {
                      property,
                      value,
                      selector,
                    },
                  });
                }
                return; // drop this declaration
              }

              declarations.push({
                property,
                value,
                important,
              });
            }
          });
        }

        // Extract :root / html custom properties (--* variables)
        if (isRootOrHtmlSelector(selector)) {
          for (const decl of declarations) {
            if (decl.property.startsWith('--')) {
              // Static root resolution: store in customProperties
              if (mediaStack.length === 0 || !(decl.property in customProperties)) {
                customProperties[decl.property] = decl.value;
              }
            }
          }
        }

        const currentMedia = mediaStack.length > 0 ? mediaStack.join(' and ') : undefined;
        rules.push({
          selector,
          ...(currentMedia ? { mediaQuery: currentMedia } : {}),
          declarations,
          sourceOrder: currentOrder++,
        });

        return csstree.walk.skip;
      }
    },
    leave(node: csstree.CssNode) {
      if (node.type === 'Atrule' && node.name.toLowerCase() === 'media' && node.prelude) {
        mediaStack.pop();
      }
    },
  });

  return {
    rules,
    customProperties,
    nextSourceOrder: currentOrder,
  };
}

/**
 * Collects CSS sources from an HTML document in source order, fetching external stylesheets
 * if a fetcher is provided, and parses all rules into a unified bundle.
 *
 * Sources processed in order:
 * 1. External `<link rel="stylesheet">` and inline `<style>` tags in DOM sequence.
 * 2. Caller-provided `options.stylesheets`.
 * 3. Rules generated by the Tailwind mapper (`options.tailwind`), appended last.
 *
 * @param parsedDoc The parsed HTML document containing styles and link references
 * @param options Optional configuration including `fetchStylesheet`, `stylesheets`, and `baseUrl`
 * @param report Optional report to record diagnostics (e.g. unresolved assets, dropped rules)
 * @returns ParsedStylesheetBundle with all rules and custom properties
 */
export async function collectAndParseStylesheets(
  parsedDoc: ParsedHtmlDocument,
  options?: HtmlImportOptions,
  report?: HtmlImportReport,
): Promise<ParsedStylesheetBundle> {
  return (await collectStylesheetBundle(parsedDoc, options, report)).bundle;
}

async function collectStylesheetBundle(
  parsedDoc: ParsedHtmlDocument,
  options?: HtmlImportOptions,
  report?: HtmlImportReport,
): Promise<{ bundle: ParsedStylesheetBundle; tailwindRules: ParsedCssRule[]; tailwindApplied: boolean }> {
  const actualReport = report ?? createEmptyReport();
  const allRules: ParsedCssRule[] = [];
  const customProperties: Record<string, string> = {};
  let currentSourceOrder = 0;

  // 1. Gather ordered stylesheet items from the HTML document
  interface StylesheetItem {
    type: 'link' | 'style';
    href?: string;
    content?: string;
    media?: string;
  }

  const items: StylesheetItem[] = [];

  if (parsedDoc.rootElement && typeof parsedDoc.rootElement === 'object') {
    walkTree(parsedDoc.rootElement, (node) => {
      if (!isElement(node)) return;
      const tagName = node.tagName.toLowerCase();

      if (tagName === 'style') {
        const media = getAttribute(node, 'media');
        const content = getTextContent(node);
        items.push({
          type: 'style',
          content,
          media: media?.trim() || undefined,
        });
      } else if (tagName === 'link') {
        const rel = getAttribute(node, 'rel');
        if (rel) {
          const relTokens = rel.toLowerCase().split(/\s+/);
          if (relTokens.includes('stylesheet')) {
            const href = getAttribute(node, 'href');
            if (href && href.trim().length > 0) {
              items.push({
                type: 'link',
                href: href.trim(),
              });
            }
          }
        }
      }
    });
  }

  // Fallback if rootElement was not walked or was synthetic/mocked
  if (items.length === 0) {
    if (parsedDoc.stylesheetUrls && Array.isArray(parsedDoc.stylesheetUrls)) {
      for (const href of parsedDoc.stylesheetUrls) {
        if (href && href.trim().length > 0) {
          items.push({ type: 'link', href: href.trim() });
        }
      }
    }
    if (parsedDoc.styles && Array.isArray(parsedDoc.styles)) {
      for (const style of parsedDoc.styles) {
        items.push({
          type: 'style',
          content: style.content,
          media: style.media,
        });
      }
    }
  }

  // 2. Process HTML stylesheet items in exact source order
  for (const item of items) {
    if (item.type === 'link') {
      const href = item.href!;
      if (options?.fetchStylesheet) {
        try {
          const resolvedHref = resolveStylesheetHref(href, options.baseUrl);
          const fetched = await options.fetchStylesheet(resolvedHref);
          if (typeof fetched === 'string') {
            const parsed = parseCssString(fetched, currentSourceOrder, actualReport);
            allRules.push(...parsed.rules);
            Object.assign(customProperties, parsed.customProperties);
            currentSourceOrder = parsed.nextSourceOrder;
          } else {
            addDiagnostic(actualReport, {
              code: 'ASSET_UNRESOLVED',
              severity: 'warning',
              message: `Stylesheet could not be resolved: ${href}`,
              location: { path: href, tagName: 'link' },
              details: { href },
            });
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          addDiagnostic(actualReport, {
            code: 'ASSET_UNRESOLVED',
            severity: 'warning',
            message: `Failed to fetch stylesheet at ${href}: ${errMsg}`,
            location: { path: href, tagName: 'link' },
            details: { href, error: errMsg },
          });
        }
      } else {
        addDiagnostic(actualReport, {
          code: 'ASSET_UNRESOLVED',
          severity: 'warning',
          message: `External stylesheet not fetched (no fetchStylesheet handler provided): ${href}`,
          location: { path: href, tagName: 'link' },
          details: { href },
        });
      }
    } else if (item.type === 'style') {
      const content = item.content ?? '';
      const parsed = parseCssString(content, currentSourceOrder, actualReport, item.media);
      allRules.push(...parsed.rules);
      Object.assign(customProperties, parsed.customProperties);
      currentSourceOrder = parsed.nextSourceOrder;
    }
  }

  // 3. Process options.stylesheets
  if (options?.stylesheets && Array.isArray(options.stylesheets)) {
    for (const sheet of options.stylesheets) {
      if (typeof sheet !== 'string' || sheet.trim().length === 0) continue;

      if (isUrlLike(sheet)) {
        if (options.fetchStylesheet) {
          try {
            const resolved = resolveStylesheetHref(sheet, options.baseUrl);
            const fetched = await options.fetchStylesheet(resolved);
            if (typeof fetched === 'string') {
              const parsed = parseCssString(fetched, currentSourceOrder, actualReport);
              allRules.push(...parsed.rules);
              Object.assign(customProperties, parsed.customProperties);
              currentSourceOrder = parsed.nextSourceOrder;
            } else {
              addDiagnostic(actualReport, {
                code: 'ASSET_UNRESOLVED',
                severity: 'warning',
                message: `Stylesheet could not be resolved: ${sheet}`,
                location: { path: sheet },
                details: { sheet },
              });
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addDiagnostic(actualReport, {
              code: 'ASSET_UNRESOLVED',
              severity: 'warning',
              message: `Failed to fetch stylesheet at ${sheet}: ${errMsg}`,
              location: { path: sheet },
              details: { sheet, error: errMsg },
            });
          }
        } else {
          addDiagnostic(actualReport, {
            code: 'ASSET_UNRESOLVED',
            severity: 'warning',
            message: `External stylesheet not fetched (no fetchStylesheet handler provided): ${sheet}`,
            location: { path: sheet },
            details: { sheet },
          });
        }
      } else {
        const parsed = parseCssString(sheet, currentSourceOrder, actualReport);
        allRules.push(...parsed.rules);
        Object.assign(customProperties, parsed.customProperties);
        currentSourceOrder = parsed.nextSourceOrder;
      }
    }
  }

  // 4. Tailwind utility classes (STORA-622): mapped to plain class rules appended last,
  //    like the Play CDN's utilities layer, so the regular cascade resolves them.
  let tailwindRules: ParsedCssRule[] = [];
  let tailwindApplied = false;
  if (parsedDoc.rootElement && typeof parsedDoc.rootElement === 'object') {
    const tailwind = buildTailwindRules({
      root: parsedDoc.rootElement,
      detection: parsedDoc.tailwind,
      mode: (options as { tailwind?: TailwindMode } | undefined)?.tailwind,
      existingRules: allRules,
      sourceOrderStart: currentSourceOrder,
      report: actualReport,
      isSafeDeclaration: (property, value) => !isDangerousDeclaration(property, value),
    });
    allRules.push(...tailwind.rules);
    tailwindRules = tailwind.rules;
    tailwindApplied = tailwind.applied;
  }

  return {
    bundle: { rules: allRules, customProperties },
    tailwindRules,
    tailwindApplied,
  };
}

const CSS_PROPERTY_NAME = /^-{0,2}[a-z][a-z0-9-]*$/i;
const CSS_STRUCTURAL_TOKEN = /[{};]|\/\*|\*\/|</;

/**
 * Serializes parsed rules back to CSS text (one rule per line, media rules wrapped in
 * `@media`). Rules or declarations containing structural characters (`{`, `}`, `;`,
 * comment markers, `<`) are dropped rather than escaped, so the output can never break out
 * of the rule it belongs to. DOM-free.
 */
export function serializeCssRules(rules: readonly ParsedCssRule[]): string {
  const lines: string[] = [];
  for (const rule of rules) {
    if (CSS_STRUCTURAL_TOKEN.test(rule.selector)) continue;
    if (rule.mediaQuery !== undefined && CSS_STRUCTURAL_TOKEN.test(rule.mediaQuery)) continue;
    const decls = rule.declarations
      .filter((d) => CSS_PROPERTY_NAME.test(d.property) && !CSS_STRUCTURAL_TOKEN.test(d.value))
      .map((d) => `${d.property}: ${d.value}${d.important ? ' !important' : ''};`);
    if (decls.length === 0) continue;
    const body = `${rule.selector} { ${decls.join(' ')} }`;
    lines.push(rule.mediaQuery ? `@media ${rule.mediaQuery} { ${body} }` : body);
  }
  return lines.join('\n');
}

/** CSS generated by the Tailwind mapper for one parsed document (STORA-649). */
export interface TailwindStylesheet {
  /** True when Tailwind mapping is active for this document (detected or forced). */
  applied: boolean;
  /** The generated rules, in cascade order (they come after all page/host CSS). */
  rules: ParsedCssRule[];
  /** `rules` serialized as CSS text; empty when nothing was generated. */
  css: string;
}

/**
 * Returns the CSS rules the Tailwind mapper (STORA-622) generates for a sanitized parsed
 * document, using exactly the detection, mode (`options.tailwind`) and "classes defined by
 * page stylesheets win" logic of `importHtml`. Meant for consumers that render the page
 * themselves (e.g. the editor's browser-snapshot frames), which must append `css` after the
 * page CSS and `options.stylesheets`. Linked/extra stylesheets are resolved through
 * `options.fetchStylesheet` like `importHtml` does. Diagnostics are discarded (`importHtml`
 * reports them). DOM-free; never executes page scripts or a Tailwind runtime.
 */
export async function buildTailwindStylesheet(
  parsedDoc: ParsedHtmlDocument,
  options?: HtmlImportOptions,
): Promise<TailwindStylesheet> {
  const { tailwindRules, tailwindApplied } = await collectStylesheetBundle(
    parsedDoc,
    options,
    createEmptyReport(),
  );
  return {
    applied: tailwindApplied,
    rules: tailwindRules,
    css: serializeCssRules(tailwindRules),
  };
}
