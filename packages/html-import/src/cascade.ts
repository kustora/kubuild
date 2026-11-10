/**
 * @kubuild/html-import
 * Selector matching, specificity calculation, and CSS cascade resolution.
 */

import * as cssSelect from 'css-select';
import * as csstree from 'css-tree';
import type { DefaultTreeAdapterMap } from 'parse5';
import { addDiagnostic, type HtmlImportReport } from './types.js';
import { getAttribute } from './parser.js';
import {
  isDangerousDeclaration,
  type ParsedCssDeclaration,
  type ParsedCssRule,
  type ParsedStylesheetBundle,
} from './stylesheet.js';
import { isSafeStyleValue } from './sanitizer.js';

export type Parse5Node = DefaultTreeAdapterMap['node'];
export type Parse5Element = DefaultTreeAdapterMap['element'];

/**
 * Adapter interface used by css-select to traverse and query parse5 AST nodes.
 */
export type CssSelectAdapter<Node, ElementNode extends Node> = NonNullable<
  cssSelect.Options<Node, ElementNode>['adapter']
>;

/**
 * Specificity vector: [ids, classesAndAttrs, tags]
 */
export type Specificity = [number, number, number];

/**
 * Adapter enabling `css-select` to query and traverse parse5 AST trees.
 */
export const parse5Adapter: CssSelectAdapter<Parse5Node, Parse5Element> = {
  isTag(node: Parse5Node): node is Parse5Element {
    return Boolean(
      node !== null &&
        typeof node === 'object' &&
        'tagName' in node &&
        typeof (node as { tagName: unknown }).tagName === 'string',
    );
  },
  getAttributeValue(element: Parse5Element, name: string): string | undefined {
    if (!element.attrs || !Array.isArray(element.attrs)) {
      return undefined;
    }
    const match = element.attrs.find(
      (attr) => attr.name.toLowerCase() === name.toLowerCase(),
    );
    return match?.value;
  },
  getChildren(node: Parse5Node): Parse5Node[] {
    if ('childNodes' in node && Array.isArray((node as { childNodes?: unknown }).childNodes)) {
      return (node as { childNodes: Parse5Node[] }).childNodes;
    }
    if (
      'content' in node &&
      (node as { content?: { childNodes?: Parse5Node[] } }).content &&
      Array.isArray((node as { content: { childNodes: Parse5Node[] } }).content.childNodes)
    ) {
      return (node as { content: { childNodes: Parse5Node[] } }).content.childNodes;
    }
    return [];
  },
  getName(element: Parse5Element): string {
    return element.tagName?.toLowerCase() || '';
  },
  getParent(node: Parse5Element): Parse5Node | null {
    return (node as { parentNode?: Parse5Node | null }).parentNode ?? null;
  },
  getSiblings(node: Parse5Node): Parse5Node[] {
    const parent = (node as { parentNode?: Parse5Node | null }).parentNode;
    if (parent && 'childNodes' in parent && Array.isArray(parent.childNodes)) {
      return parent.childNodes as Parse5Node[];
    }
    return [node];
  },
  prevElementSibling(node: Parse5Node): Parse5Element | null {
    const parent = (node as { parentNode?: Parse5Node | null }).parentNode;
    if (parent && 'childNodes' in parent && Array.isArray(parent.childNodes)) {
      const siblings = parent.childNodes as Parse5Node[];
      const index = siblings.indexOf(node);
      if (index > 0) {
        for (let i = index - 1; i >= 0; i--) {
          const sibling = siblings[i];
          if (parse5Adapter.isTag(sibling)) {
            return sibling as Parse5Element;
          }
        }
      }
    }
    return null;
  },
  getText(node: Parse5Node): string {
    if ('nodeName' in node && (node as { nodeName: unknown }).nodeName === '#text') {
      return (node as { value?: string }).value ?? '';
    }
    if ('childNodes' in node && Array.isArray((node as { childNodes?: unknown }).childNodes)) {
      return (node as { childNodes: Parse5Node[] }).childNodes
        .map((child) => parse5Adapter.getText(child))
        .join('');
    }
    return '';
  },
  hasAttrib(element: Parse5Element, name: string): boolean {
    if (!element.attrs || !Array.isArray(element.attrs)) {
      return false;
    }
    return element.attrs.some(
      (attr) => attr.name.toLowerCase() === name.toLowerCase(),
    );
  },
  removeSubsets(nodes: Parse5Node[]): Parse5Node[] {
    return nodes.filter((node, i) => {
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        let p = (node as { parentNode?: Parse5Node | null }).parentNode;
        while (p) {
          if (p === nodes[j]) return false;
          p = (p as { parentNode?: Parse5Node | null }).parentNode;
        }
      }
      return true;
    });
  },
  equals(a: Parse5Node, b: Parse5Node): boolean {
    return a === b;
  },
};

/**
 * Compares two specificity vectors: returns positive if `a > b`, negative if `a < b`, 0 if equal.
 */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

/**
 * Calculates specificity `[ids, classesAndAttrs, tags]` for a selector string or CSS AST node.
 */
export function calculateSpecificity(selector: string | csstree.CssNode): Specificity {
  let ast: csstree.CssNode;
  if (typeof selector === 'string') {
    try {
      ast = csstree.parse(selector, { context: 'selector' });
    } catch {
      return [0, 0, 0];
    }
  } else {
    ast = selector;
  }

  let a = 0;
  let b = 0;
  let c = 0;

  function walk(node: csstree.CssNode) {
    if (node.type === 'IdSelector') {
      a++;
    } else if (node.type === 'ClassSelector' || node.type === 'AttributeSelector') {
      b++;
    } else if (node.type === 'PseudoClassSelector') {
      const name = node.name.toLowerCase();
      if (name === 'where') {
        // :where() carries 0 specificity
      } else if (name === 'not' || name === 'is' || name === 'has') {
        if (node.children) {
          let maxChild: Specificity = [0, 0, 0];
          node.children.forEach((child) => {
            const childSpec = calculateSpecificity(child);
            if (compareSpecificity(childSpec, maxChild) > 0) {
              maxChild = childSpec;
            }
          });
          a += maxChild[0];
          b += maxChild[1];
          c += maxChild[2];
        }
      } else {
        b++;
      }
    } else if (node.type === 'PseudoElementSelector') {
      c++;
    } else if (node.type === 'TypeSelector') {
      if (node.name !== '*') {
        c++;
      }
    } else if ('children' in node && node.children) {
      node.children.forEach((child) => {
        walk(child);
      });
    }
  }

  walk(ast);
  return [a, b, c];
}

/**
 * Converts kebab-case CSS property names to camelCase.
 * Preserves custom properties starting with `--`.
 */
export function cssPropertyToCamelCase(prop: string): string {
  const trimmed = prop.trim();
  if (trimmed.startsWith('--')) {
    return trimmed;
  }
  const clean = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
  return clean.replace(/-([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
}

/**
 * Resolves CSS variables `var(--name, fallback)` using a custom property dictionary.
 * Supports nested variables and handles missing variables with fallbacks gracefully.
 */
export function resolveCssVariables(
  value: string,
  customProperties: Record<string, string>,
  maxDepth = 10,
): string {
  if (!value || !value.includes('var(')) {
    return value;
  }
  let current = value;
  let iterations = 0;
  const varRegex = /var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*((?:[^()]|\([^()]*\))*))?\s*\)/g;

  while (iterations < maxDepth && varRegex.test(current)) {
    iterations++;
    const prev = current;
    current = current.replace(varRegex, (fullMatch, varName, fallback) => {
      if (varName in customProperties) {
        return customProperties[varName];
      }
      if (fallback !== undefined && fallback !== null) {
        return fallback.trim();
      }
      return fullMatch;
    });
    if (current === prev) break;
  }

  return current;
}

/**
 * Tolerant parser for `style="..."` inline attribute strings.
 */
export function parseInlineStyle(
  styleText: string,
  report?: HtmlImportReport,
): ParsedCssDeclaration[] {
  const declarations: ParsedCssDeclaration[] = [];
  if (!styleText || !styleText.trim()) {
    return declarations;
  }

  let ast: csstree.CssNode;
  try {
    ast = csstree.parse(styleText, {
      context: 'declarationList',
      onParseError() {},
    });
  } catch {
    return declarations;
  }

  csstree.walk(ast, {
    enter(node: csstree.CssNode) {
      if (node.type === 'Declaration') {
        const property = node.property;
        const value = node.value ? csstree.generate(node.value).trim() : '';
        const important = Boolean(node.important);

        if (!value) return;

        if (isDangerousDeclaration(property, value)) {
          if (report) {
            const isUrlBlocked =
              /javascript:|vbscript:|data:text\/html/i.test(value) ||
              (/url\s*\(/i.test(value) && !isSafeStyleValue(value));
            const code = isUrlBlocked ? 'URL_BLOCKED' : 'CSS_UNSUPPORTED_PROPERTY';
            addDiagnostic(report, {
              code,
              severity: 'warning',
              message: `Dangerous inline style dropped: ${property}: ${value}`,
              details: { property, value },
            });
          }
          return;
        }

        declarations.push({
          property,
          value,
          important,
        });
      }
    },
  });

  return declarations;
}

const UNITLESS_NUMERIC_PROPERTIES = new Set([
  'zIndex',
  'opacity',
  'flexGrow',
  'flexShrink',
  'order',
  'colSpan',
  'rowSpan',
]);

/**
 * Normalizes CSS property values: converts unitless numeric strings to numbers for numeric properties.
 */
export function normalizeStyleValue(
  property: string,
  rawValue: string,
): string | number {
  const trimmed = rawValue.trim();
  if (UNITLESS_NUMERIC_PROPERTIES.has(property) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return trimmed;
}

/**
 * Text properties inherited from parent element computed styles.
 */
export const INHERITED_TEXT_PROPERTIES: ReadonlySet<string> = new Set([
  'color',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'textAlign',
  'letterSpacing',
]);

/**
 * Splits a comma-separated selector list into individual selector strings.
 */
export function splitSelectorList(selectorListStr: string): string[] {
  try {
    const ast = csstree.parse(selectorListStr, { context: 'selectorList' });
    if (ast.type === 'SelectorList') {
      const parts: string[] = [];
      ast.children.forEach((child) => {
        const text = csstree.generate(child).trim();
        if (text) {
          parts.push(text);
        }
      });
      return parts;
    }
  } catch {
    // Tolerant fallback
  }
  return selectorListStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Separates interactive pseudo-class suffixes (:hover, :focus, :active, :focus-visible, :visited, :disabled, [disabled])
 * from base selector.
 */
export function extractPseudoState(selectorStr: string): {
  baseSelector: string;
  pseudoState?: string;
} {
  const trimmed = selectorStr.trim();
  const match = trimmed.match(
    /(?::(hover|focus|active|focus-visible|visited|disabled)|\[disabled(?:="?[^"\]]*"?)?\])$/i,
  );
  if (match && match.index !== undefined) {
    const pseudoState = match[0].startsWith(':')
      ? `:${match[1].toLowerCase()}`
      : '[disabled]';
    const base = trimmed.slice(0, match.index).trim();
    return {
      baseSelector: base.length > 0 ? base : '*',
      pseudoState,
    };
  }
  return {
    baseSelector: trimmed,
  };
}

/**
 * Candidate declaration recorded during cascade collection.
 */
export interface StyleCandidate {
  property: string;
  value: string | number;
  important: boolean;
  isInline: boolean;
  specificity: Specificity;
  sourceOrder: number;
}

/**
 * Determines whether `incoming` candidate overrides `existing` according to CSS cascade rules:
 * 1. !important beats normal rules.
 * 2. Inline !important beats stylesheet !important.
 * 3. Inline normal beats stylesheet normal.
 * 4. Higher specificity beats lower specificity.
 * 5. Later sourceOrder wins ties.
 */
export function shouldOverride(
  existing: StyleCandidate,
  incoming: StyleCandidate,
): boolean {
  // 1. !important beats normal rules
  if (incoming.important && !existing.important) {
    return true;
  }
  if (!incoming.important && existing.important) {
    return false;
  }

  // Both !important OR both normal
  if (incoming.important) {
    // Inline !important beats stylesheet !important
    if (incoming.isInline && !existing.isInline) {
      return true;
    }
    if (!incoming.isInline && existing.isInline) {
      return false;
    }
    if (incoming.isInline && existing.isInline) {
      return incoming.sourceOrder >= existing.sourceOrder;
    }
    const specDiff = compareSpecificity(incoming.specificity, existing.specificity);
    if (specDiff !== 0) {
      return specDiff > 0;
    }
    return incoming.sourceOrder >= existing.sourceOrder;
  } else {
    // Both normal
    if (incoming.isInline && !existing.isInline) {
      return true;
    }
    if (!incoming.isInline && existing.isInline) {
      return false;
    }
    if (incoming.isInline && existing.isInline) {
      return incoming.sourceOrder >= existing.sourceOrder;
    }
    const specDiff = compareSpecificity(incoming.specificity, existing.specificity);
    if (specDiff !== 0) {
      return specDiff > 0;
    }
    return incoming.sourceOrder >= existing.sourceOrder;
  }
}

/**
 * Adds or replaces a candidate in a property map following cascade precedence.
 */
function addCandidate(
  map: Map<string, StyleCandidate>,
  candidate: StyleCandidate,
): void {
  const existing = map.get(candidate.property);
  if (!existing || shouldOverride(existing, candidate)) {
    map.set(candidate.property, candidate);
  }
}

/**
 * Computed style layers for a DOM element.
 */
export interface ComputedElementStyles {
  base: Record<string, string | number>;
  mediaQueries: Array<{ query: string; styles: Record<string, string | number> }>;
  pseudoStates: Record<string, Record<string, string | number>>; // ':hover', ':focus', etc.
}

/**
 * Result of matching a CSS rule against an element.
 */
export interface MatchedRuleResult {
  rule: ParsedCssRule;
  matchingSelector: string;
  specificity: Specificity;
  pseudoState?: string;
}

/** Selectors already reported per import, so each unsupported selector is reported once. */
const reportedUnsupportedSelectors = new WeakMap<HtmlImportReport, Set<string>>();

function reportUnsupportedSelector(
  report: HtmlImportReport | undefined,
  selector: string,
  message: string,
  details: Record<string, unknown>,
): void {
  if (!report) return;
  let seen = reportedUnsupportedSelectors.get(report);
  if (!seen) {
    seen = new Set();
    reportedUnsupportedSelectors.set(report, seen);
  }
  if (seen.has(selector)) return;
  seen.add(selector);
  addDiagnostic(report, {
    code: 'CSS_UNSUPPORTED_SELECTOR',
    severity: 'info',
    message,
    location: { selector },
    details,
  });
}

/**
 * Matches all rules in a stylesheet bundle against an element.
 * Reports unsupported selectors as `CSS_UNSUPPORTED_SELECTOR` without throwing.
 */
export function matchRulesForElement(
  element: Parse5Element,
  bundle: ParsedStylesheetBundle,
  report?: HtmlImportReport,
): MatchedRuleResult[] {
  const results: MatchedRuleResult[] = [];

  for (const rule of bundle.rules) {
    if (!rule.selector || rule.declarations.length === 0) {
      continue;
    }

    const parts = splitSelectorList(rule.selector);
    let bestMatchForThisRule: MatchedRuleResult | null = null;

    for (const part of parts) {
      // Check for unsupported selector constructs like :has
      if (/:has\s*\(/i.test(part)) {
        reportUnsupportedSelector(report, part, `Unsupported CSS selector: ${part}`, {
          selector: part,
          reason: ':has is unsupported',
        });
        continue;
      }

      const { baseSelector, pseudoState } = extractPseudoState(part);

      let matches = false;
      try {
        matches = cssSelect.is(element, baseSelector, { adapter: parse5Adapter });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        reportUnsupportedSelector(report, part, `Unsupported CSS selector: ${part} (${error})`, {
          selector: part,
          error,
        });
        continue;
      }

      if (matches) {
        const specificity = calculateSpecificity(part);
        const matchResult: MatchedRuleResult = {
          rule,
          matchingSelector: part,
          specificity,
          ...(pseudoState ? { pseudoState } : {}),
        };

        if (
          !bestMatchForThisRule ||
          compareSpecificity(matchResult.specificity, bestMatchForThisRule.specificity) > 0
        ) {
          bestMatchForThisRule = matchResult;
        }
      }
    }

    if (bestMatchForThisRule) {
      results.push(bestMatchForThisRule);
    }
  }

  return results;
}

function referencesCustomProperty(value: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`var\\(\\s*${escaped}\\s*[,)]`).test(value);
}

/**
 * Merges the custom properties (`--x`) won by `candidates` over `inherited`.
 */
function collectCustomProperties(
  inherited: Record<string, string>,
  candidates: Map<string, StyleCandidate>,
): Record<string, string> {
  const result: Record<string, string> = { ...inherited };
  for (const [prop, candidate] of candidates.entries()) {
    if (prop.startsWith('--')) result[prop] = String(candidate.value);
  }
  return result;
}

/**
 * Resolves full computed styles for an element, taking into account:
 * 1. Matching stylesheet rules (ordered by specificity, sourceOrder, and !important).
 * 2. Inline style declarations (normal and !important).
 * 3. CSS custom property resolution (`var(--x, fallback)`).
 * 4. Text property inheritance from parent styles.
 * 5. Media queries and pseudo-states (:hover, :focus, etc.).
 *
 * @param element The parse5 DOM element to style
 * @param bundle Parsed stylesheet bundle containing rules and custom properties
 * @param parentStyles Optional computed base styles of the parent element for text inheritance
 * @param report Optional report to record diagnostics (e.g. unsupported selectors)
 * @returns ComputedElementStyles containing base, mediaQueries, and pseudoStates
 */
export function computeElementStyles(
  element: Parse5Element,
  bundle: ParsedStylesheetBundle,
  parentStyles?: Record<string, string | number>,
  report?: HtmlImportReport,
): ComputedElementStyles {
  const baseCandidates = new Map<string, StyleCandidate>();
  const mediaQueryCandidates = new Map<string, Map<string, StyleCandidate>>();
  const pseudoStateCandidates = new Map<string, Map<string, StyleCandidate>>();

  // Parse inline style if present
  const styleAttr = getAttribute(element, 'style');
  const inlineDeclarations = styleAttr ? parseInlineStyle(styleAttr, report) : [];

  // 1. Collect raw candidates from matching stylesheet rules. Custom properties (`--x`)
  //    take part in the cascade like any other property, so element-level and
  //    per-breakpoint tokens resolve the way the browser would.
  const matchedRules = matchRulesForElement(element, bundle, report);

  for (const match of matchedRules) {
    const { rule, specificity, pseudoState } = match;

    let targetMap: Map<string, StyleCandidate>;
    if (rule.mediaQuery) {
      let map = mediaQueryCandidates.get(rule.mediaQuery);
      if (!map) {
        map = new Map();
        mediaQueryCandidates.set(rule.mediaQuery, map);
      }
      targetMap = map;
    } else if (pseudoState) {
      let map = pseudoStateCandidates.get(pseudoState);
      if (!map) {
        map = new Map();
        pseudoStateCandidates.set(pseudoState, map);
      }
      targetMap = map;
    } else {
      targetMap = baseCandidates;
    }

    for (let i = 0; i < rule.declarations.length; i++) {
      const decl = rule.declarations[i];
      addCandidate(targetMap, {
        property: cssPropertyToCamelCase(decl.property),
        value: decl.value,
        important: decl.important,
        isInline: false,
        specificity,
        sourceOrder: rule.sourceOrder * 10000 + i,
      });
    }
  }

  // 2. Inline declarations on the element (apply to base styles)
  let inlineIndex = 0;
  for (const decl of inlineDeclarations) {
    addCandidate(baseCandidates, {
      property: cssPropertyToCamelCase(decl.property),
      value: decl.value,
      important: decl.important,
      isInline: true,
      specificity: [0, 0, 0],
      sourceOrder: inlineIndex++,
    });
  }

  const baseCustomProps = collectCustomProperties(bundle.customProperties, baseCandidates);
  const resolveLayer = (
    map: Map<string, StyleCandidate>,
    customProps: Record<string, string>,
  ): Record<string, string | number> => {
    const styles: Record<string, string | number> = {};
    for (const [prop, candidate] of map.entries()) {
      if (prop.startsWith('--')) continue;
      styles[prop] = normalizeStyleValue(
        prop,
        resolveCssVariables(String(candidate.value), customProps),
      );
    }
    return styles;
  };

  // 3. Assemble base styles and inherit typography from parent
  const base = resolveLayer(baseCandidates, baseCustomProps);

  if (parentStyles) {
    for (const prop of INHERITED_TEXT_PROPERTIES) {
      const parentVal =
        parentStyles[prop] ??
        parentStyles[prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)];
      if (parentVal !== undefined) {
        if (base[prop] === undefined || base[prop] === 'inherit') {
          base[prop] = parentVal;
        }
      }
    }
  }

  // 4. Assemble mediaQueries. A query that only redefines a custom property still changes
  //    every base declaration that reads it, so those are re-resolved into the query.
  const mediaQueries: Array<{ query: string; styles: Record<string, string | number> }> = [];
  for (const [query, map] of mediaQueryCandidates.entries()) {
    const overridden = [...map.keys()].filter((prop) => prop.startsWith('--'));
    const customProps = collectCustomProperties(baseCustomProps, map);
    const styles = resolveLayer(map, customProps);
    if (overridden.length > 0) {
      for (const [prop, candidate] of baseCandidates.entries()) {
        if (prop.startsWith('--') || prop in styles) continue;
        const raw = String(candidate.value);
        if (overridden.some((name) => referencesCustomProperty(raw, name))) {
          styles[prop] = normalizeStyleValue(prop, resolveCssVariables(raw, customProps));
        }
      }
    }
    if (Object.keys(styles).length > 0) {
      mediaQueries.push({ query, styles });
    }
  }

  // 5. Assemble pseudoStates
  const pseudoStates: Record<string, Record<string, string | number>> = {};
  for (const [state, map] of pseudoStateCandidates.entries()) {
    const styles = resolveLayer(map, collectCustomProperties(baseCustomProps, map));
    if (Object.keys(styles).length > 0) {
      pseudoStates[state] = styles;
    }
  }

  return {
    base,
    mediaQueries,
    pseudoStates,
  };
}
