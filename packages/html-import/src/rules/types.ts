/**
 * @kubuild/html-import
 * Type definitions for element mapping rules and execution context.
 */

import type { DefaultTreeAdapterMap } from 'parse5';
import type { PageNode, HtmlImportOptions, HtmlImportReport } from '../types.js';
import type { ParsedStylesheetBundle } from '../stylesheet.js';
import type { ComputedElementStyles } from '../cascade.js';

export type Parse5DocumentFragment = DefaultTreeAdapterMap['documentFragment'];

/**
 * Context provided to element mapping rules during AST conversion.
 */
export interface HtmlMappingContext {
  /**
   * Import configuration options passed to importHtml or htmlToNodes.
   */
  options: HtmlImportOptions;
  /**
   * Diagnostic and statistics reporting target.
   */
  report: HtmlImportReport;
  /**
   * Fully parsed stylesheet bundle containing cascade rules and custom properties.
   */
  bundle: ParsedStylesheetBundle;
  /**
   * Computed styles of the direct parent element, enabling CSS inheritance down the tree.
   */
  parentStyles?: Record<string, string | number>;
  /**
   * Recursively converts children of an element or document fragment into PageNodes.
   */
  convertChildren: (
    element:
      | DefaultTreeAdapterMap['element']
      | DefaultTreeAdapterMap['documentFragment']
      | DefaultTreeAdapterMap['document'],
  ) => PageNode[];
  /**
   * Converts a single DOM element using registered rules.
   */
  convertElement: (
    element: DefaultTreeAdapterMap['element'],
  ) => PageNode | PageNode[] | null;
  /**
   * Generates a unique, schema-valid node identifier.
   */
  generateId: (prefix?: string) => string;
  /**
   * Optional set of custom component types allowed by the host application.
   */
  allowedComponentTypes?: Set<string>;
}

/**
 * Rule definition for translating a parse5 HTML DOM element into KUBUILD PageNode(s).
 */
export interface HtmlMappingRule {
  /**
   * Unique identifier for the rule (e.g. 'heading', 'link', 'custom-card').
   * Host rules sharing the same ID override default rules.
   */
  id: string;
  /**
   * Rule evaluation priority. Higher numbers indicate higher precedence.
   * Default rules typically occupy priorities 0–100; host custom rules 200+.
   */
  priority: number;
  /**
   * Predicate testing whether this rule applies to the specified element and computed styles.
   */
  match: (
    element: DefaultTreeAdapterMap['element'],
    computed: ComputedElementStyles,
    context: HtmlMappingContext,
  ) => boolean;
  /**
   * Translates the matched DOM element into one or more KUBUILD PageNodes, or null.
   */
  convert: (
    element: DefaultTreeAdapterMap['element'],
    context: HtmlMappingContext,
    computed: ComputedElementStyles,
  ) => PageNode | PageNode[] | null;
}
