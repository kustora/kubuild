/**
 * @kubuild/html-import
 * Rule registry and evaluation engine for HTML element mapping.
 */

import type { DefaultTreeAdapterMap } from 'parse5';
import { BUILTIN_COMPONENT_TYPES } from '@kubuild/schema';
import {
  addDiagnostic,
  createEmptyReport,
  type HtmlImportOptions,
  type PageNode,
} from '../types.js';
import { computeElementStyles, type ComputedElementStyles, type Parse5Element } from '../cascade.js';
import type { ParsedStylesheetBundle } from '../stylesheet.js';
import { isElement } from '../sanitizer.js';
import {
  DEFAULT_LAYOUT_TYPOGRAPHY_RULES,
  convertRawTextNode,
  isTextNode,
} from './layout-typography.js';
import { DEFAULT_MEDIA_FORM_DATA_RULES } from './media-form-data.js';
import { createFallbackEmbedNode, handleFallbackElement } from './fallback.js';
import type {
  HtmlMappingContext,
  HtmlMappingRule,
} from './types.js';

/**
 * Default HTML element mapping rules registered across layout, typography,
 * media, form, list, and table domains.
 */
export const DEFAULT_HTML_MAPPING_RULES: readonly HtmlMappingRule[] = Object.freeze([
  ...DEFAULT_LAYOUT_TYPOGRAPHY_RULES,
  ...DEFAULT_MEDIA_FORM_DATA_RULES,
]);

/**
 * Set of built-in KUBUILD component types for fast O(1) membership checking.
 */
const BUILTIN_COMPONENT_SET = new Set<string>(BUILTIN_COMPONENT_TYPES);

/**
 * Creates a deterministic, sequential node ID generator.
 *
 * @param defaultPrefix Default prefix when none is provided to generator calls
 * @returns Function returning unique ID strings like 'node-1', 'heading-2', etc.
 */
export function createIdGenerator(defaultPrefix = 'node'): (prefix?: string) => string {
  let counter = 0;
  return (prefix?: string) => {
    counter += 1;
    const p = prefix || defaultPrefix;
    return `${p}-${counter}`;
  };
}

/**
 * Engine that maintains, sorts, and executes element mapping rules.
 */
export class HtmlRuleRegistry {
  private rules: HtmlMappingRule[] = [];
  private orderCounter = 0;
  private ruleOrder = new Map<string, number>();
  private allowedCustomTypes = new Set<string>();

  /**
   * Initializes a new rule registry with optional default rules and allowed custom types.
   *
   * @param rules Optional array of initial mapping rules
   * @param options Configuration options including allowed custom component types
   */
  constructor(
    rules?: HtmlMappingRule[],
    options?: { allowedCustomTypes?: Iterable<string> },
  ) {
    if (options?.allowedCustomTypes) {
      for (const t of options.allowedCustomTypes) {
        this.allowedCustomTypes.add(t);
      }
    }
    if (rules && rules.length > 0) {
      this.registerMany(rules);
    }
  }

  /**
   * Registers a single rule or an array of rules.
   * If a rule with the same ID already exists, it is replaced.
   */
  register(ruleOrRules: HtmlMappingRule | HtmlMappingRule[]): this {
    if (Array.isArray(ruleOrRules)) {
      return this.registerMany(ruleOrRules);
    }

    const rule = ruleOrRules;
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);

    if (existingIndex !== -1) {
      this.rules[existingIndex] = rule;
    } else {
      this.orderCounter += 1;
      this.ruleOrder.set(rule.id, this.orderCounter);
      this.rules.push(rule);
    }

    this.sortRules();
    return this;
  }

  /**
   * Registers an array of mapping rules into the registry.
   */
  registerMany(rules: HtmlMappingRule[]): this {
    for (const rule of rules) {
      const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
      if (existingIndex !== -1) {
        this.rules[existingIndex] = rule;
      } else {
        this.orderCounter += 1;
        this.ruleOrder.set(rule.id, this.orderCounter);
        this.rules.push(rule);
      }
    }
    this.sortRules();
    return this;
  }

  /**
   * Unregisters a rule by its unique identifier.
   *
   * @param id Rule identifier to remove
   * @returns True if a rule was removed, false otherwise
   */
  unregister(id: string): boolean {
    const index = this.rules.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.ruleOrder.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Retrieves a rule by its identifier.
   */
  getRule(id: string): HtmlMappingRule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  /**
   * Checks whether a rule with the specified identifier is registered.
   */
  hasRule(id: string): boolean {
    return this.rules.some((r) => r.id === id);
  }

  /**
   * Returns a copy of registered rules sorted descending by priority.
   */
  getRules(): HtmlMappingRule[] {
    return [...this.rules];
  }

  /**
   * Clears all registered rules.
   */
  clear(): void {
    this.rules = [];
    this.ruleOrder.clear();
    this.orderCounter = 0;
  }

  /**
   * Clones this registry instance, preserving rules and allowed custom types.
   */
  clone(): HtmlRuleRegistry {
    const copy = new HtmlRuleRegistry();
    copy.rules = [...this.rules];
    copy.orderCounter = this.orderCounter;
    copy.ruleOrder = new Map(this.ruleOrder);
    copy.allowedCustomTypes = new Set(this.allowedCustomTypes);
    return copy;
  }

  /**
   * Adds allowed host custom component types.
   */
  allowComponentType(type: string | string[] | Iterable<string>): this {
    if (typeof type === 'string') {
      this.allowedCustomTypes.add(type);
    } else {
      for (const t of type) {
        this.allowedCustomTypes.add(t);
      }
    }
    return this;
  }

  /**
   * Retrieves all currently registered custom component types.
   */
  getAllowedComponentTypes(): Set<string> {
    return new Set(this.allowedCustomTypes);
  }

  /**
   * Checks whether a given component type is valid (builtin or explicitly allowed).
   */
  isAllowedType(type: string, extraAllowed?: Set<string>): boolean {
    if (typeof type !== 'string' || type.length === 0) {
      return false;
    }
    if (BUILTIN_COMPONENT_SET.has(type)) {
      return true;
    }
    if (this.allowedCustomTypes.has(type)) {
      return true;
    }
    if (extraAllowed && extraAllowed.has(type)) {
      return true;
    }
    return false;
  }

  /**
   * Merges host rules (e.g. from options.rules) into this registry in place.
   * Host rules sharing IDs with existing rules override them.
   */
  mergeHostRules(rules?: HtmlMappingRule[]): this {
    if (!rules || rules.length === 0) {
      return this;
    }
    return this.registerMany(rules);
  }

  /**
   * Returns a new registry cloned from this instance with host rules merged.
   * Leaves the current registry unaltered.
   */
  withHostRules(rules?: HtmlMappingRule[]): HtmlRuleRegistry {
    const cloned = this.clone();
    if (rules && rules.length > 0) {
      cloned.registerMany(rules);
    }
    return cloned;
  }

  /**
   * Computes the effective list of rules by combining registered rules with host rules.
   * Host rules with matching IDs override default rules. Higher priority rules evaluate first.
   */
  getEffectiveRules(hostRules?: HtmlMappingRule[]): HtmlMappingRule[] {
    if (!hostRules || hostRules.length === 0) {
      return this.getRules();
    }

    const ruleMap = new Map<string, { rule: HtmlMappingRule; order: number }>();

    for (const rule of this.rules) {
      ruleMap.set(rule.id, {
        rule,
        order: this.ruleOrder.get(rule.id) ?? 0,
      });
    }

    let nextOrder = this.orderCounter;
    for (const hostRule of hostRules) {
      nextOrder += 1;
      ruleMap.set(hostRule.id, {
        rule: hostRule,
        order: nextOrder,
      });
    }

    const combined = Array.from(ruleMap.values());
    combined.sort((a, b) => {
      if (b.rule.priority !== a.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }
      return a.order - b.order;
    });

    return combined.map((entry) => entry.rule);
  }

  /**
   * Finds the first rule matching the specified element and computed styles.
   */
  findMatchingRule(
    element: Parse5Element,
    computed: ComputedElementStyles,
    context: HtmlMappingContext,
    rules?: HtmlMappingRule[],
  ): HtmlMappingRule | undefined {
    const candidateRules = rules ?? this.getEffectiveRules(context.options.rules);
    for (const rule of candidateRules) {
      try {
        if (rule.match(element, computed, context)) {
          return rule;
        }
      } catch {
        // If match throws, proceed to next rule
        continue;
      }
    }
    return undefined;
  }

  /**
   * Converts a single DOM element into PageNode(s) by finding and executing matching rules.
   */
  convertElement(
    element: Parse5Element,
    context: HtmlMappingContext,
    computed?: ComputedElementStyles,
  ): PageNode | PageNode[] | null {
    return this.mapElement(element, context, computed);
  }

  /**
   * Evaluates rules against an element and returns the resulting validated PageNode(s).
   */
  mapElement(
    element: Parse5Element,
    context: HtmlMappingContext,
    computed?: ComputedElementStyles,
  ): PageNode | PageNode[] | null {
    if (!element || !isElement(element)) {
      return null;
    }

    const computedStyles =
      computed ??
      (context.bundle
        ? computeElementStyles(element, context.bundle, context.parentStyles, context.report)
        : { base: {}, mediaQueries: [], pseudoStates: {} });

    const effectiveRules = this.getEffectiveRules(context.options.rules);

    for (const rule of effectiveRules) {
      let matched = false;
      try {
        matched = rule.match(element, computedStyles, context);
      } catch {
        matched = false;
      }

      if (!matched) {
        continue;
      }

      // Matching rule found
      let converted: PageNode | PageNode[] | null = null;
      try {
        converted = rule.convert(element, context, computedStyles);
      } catch (err) {
        addDiagnostic(context.report, {
          code: 'ELEMENT_DROPPED',
          severity: 'error',
          message: `Mapping rule "${rule.id}" threw an exception for element <${element.tagName}>: ${err instanceof Error ? err.message : String(err)}`,
          location: {
            tagName: element.tagName,
            line: element.sourceCodeLocation?.startLine,
            column: element.sourceCodeLocation?.startCol,
          },
          details: {
            ruleId: rule.id,
            tagName: element.tagName,
            error: String(err),
          },
        });
        return this.handleFallback(element, context, computedStyles);
      }

      return this.validateConverted(converted, element, rule, context, computedStyles);
    }

    // No rule matched
    return this.handleUnmatchedElement(element, context, computedStyles);
  }

  /**
   * Recursively converts children of an element, document, or document fragment into PageNodes.
   */
  convertChildren(
    parent:
      | DefaultTreeAdapterMap['element']
      | DefaultTreeAdapterMap['documentFragment']
      | DefaultTreeAdapterMap['document'],
    context: HtmlMappingContext,
  ): PageNode[] {
    const nodes: PageNode[] = [];
    if (!parent || !('childNodes' in parent) || !Array.isArray(parent.childNodes)) {
      return nodes;
    }

    let childContext = context;
    if (isElement(parent)) {
      const parentComputed = computeElementStyles(
        parent,
        context.bundle,
        context.parentStyles,
        context.report,
      );
      if (parentComputed && parentComputed.base && Object.keys(parentComputed.base).length > 0) {
        childContext = {
          ...context,
          parentStyles: parentComputed.base,
        };
        childContext.convertElement = (el: Parse5Element) => this.mapElement(el, childContext);
        childContext.convertChildren = (
          p:
            | DefaultTreeAdapterMap['element']
            | DefaultTreeAdapterMap['documentFragment']
            | DefaultTreeAdapterMap['document'],
        ) => this.convertChildren(p, childContext);
      }
    }

    for (let i = 0; i < parent.childNodes.length; i++) {
      const child = parent.childNodes[i];
      if (isElement(child)) {
        const converted = childContext.convertElement(child);
        if (converted) {
          if (Array.isArray(converted)) {
            nodes.push(...converted);
          } else {
            nodes.push(converted);
          }
        }
      } else if (isTextNode(child)) {
        const textNode = convertRawTextNode(child, i, parent.childNodes, childContext);
        if (textNode) {
          nodes.push(textNode);
        }
      }
    }

    return nodes;
  }

  /**
   * Creates an execution context populated with defaults and helpers.
   */
  createContext(
    options: HtmlImportOptions = {},
    overrides?: Partial<HtmlMappingContext>,
  ): HtmlMappingContext {
    const report = overrides?.report ?? createEmptyReport();
    const bundle: ParsedStylesheetBundle = overrides?.bundle ?? {
      rules: [],
      customProperties: {},
    };

    const allowedComponentTypes = new Set<string>(this.allowedCustomTypes);
    if (options.allowedComponentTypes) {
      for (const t of options.allowedComponentTypes) {
        allowedComponentTypes.add(t);
      }
    }
    if (overrides?.allowedComponentTypes) {
      for (const t of overrides.allowedComponentTypes) {
        allowedComponentTypes.add(t);
      }
    }

    const generateId = overrides?.generateId ?? createIdGenerator();

    const baseContext: HtmlMappingContext = {
      options,
      report,
      bundle,
      parentStyles: overrides?.parentStyles,
      generateId,
      allowedComponentTypes,
      convertElement: (el: Parse5Element) => this.mapElement(el, baseContext),
      convertChildren: (
        p:
          | DefaultTreeAdapterMap['element']
          | DefaultTreeAdapterMap['documentFragment']
          | DefaultTreeAdapterMap['document'],
      ) => this.convertChildren(p, baseContext),
      ...overrides,
    };

    return baseContext;
  }

  /**
   * Validates converted node(s) against built-in and allowed custom component types.
   */
  private validateConverted(
    converted: PageNode | PageNode[] | null,
    element: Parse5Element,
    rule: HtmlMappingRule,
    context: HtmlMappingContext,
    computed: ComputedElementStyles,
  ): PageNode | PageNode[] | null {
    if (converted === null || converted === undefined) {
      return null;
    }

    if (Array.isArray(converted)) {
      const validNodes: PageNode[] = [];
      for (const node of converted) {
        if (this.isValidNode(node, context)) {
          validNodes.push(node);
        } else {
          this.recordDroppedDiagnostic(element, node?.type ?? 'unknown', rule.id, context);
          if (context.options.fallback === 'embed') {
            const fallbackNode = createFallbackEmbedNode(element, context, computed);
            if (fallbackNode) {
              validNodes.push(fallbackNode);
            }
          }
        }
      }
      return validNodes.length > 0 ? validNodes : null;
    }

    if (this.isValidNode(converted, context)) {
      return converted;
    }

    this.recordDroppedDiagnostic(element, converted?.type ?? 'unknown', rule.id, context);
    if (context.options.fallback === 'embed') {
      return createFallbackEmbedNode(element, context, computed);
    }
    return null;
  }

  private isValidNode(node: PageNode, context: HtmlMappingContext): boolean {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') {
      return false;
    }
    return this.isAllowedType(node.type, context.allowedComponentTypes);
  }

  private recordDroppedDiagnostic(
    element: Parse5Element,
    nodeType: string,
    ruleId: string,
    context: HtmlMappingContext,
  ): void {
    addDiagnostic(context.report, {
      code: 'ELEMENT_DROPPED',
      severity: 'warning',
      message: `Element <${element.tagName}> produced unallowed or unrecognized component type "${nodeType}". The node was dropped.`,
      location: {
        tagName: element.tagName,
        line: element.sourceCodeLocation?.startLine,
        column: element.sourceCodeLocation?.startCol,
      },
      details: {
        nodeType,
        tagName: element.tagName,
        ruleId,
      },
    });
  }

  private handleUnmatchedElement(
    element: Parse5Element,
    context: HtmlMappingContext,
    computed: ComputedElementStyles,
  ): PageNode | null {
    return handleFallbackElement(element, context, computed);
  }

  private handleFallback(
    element: Parse5Element,
    context: HtmlMappingContext,
    computed: ComputedElementStyles,
  ): PageNode | null {
    return handleFallbackElement(element, context, computed);
  }

  private sortRules(): void {
    this.rules.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      const orderA = this.ruleOrder.get(a.id) ?? 0;
      const orderB = this.ruleOrder.get(b.id) ?? 0;
      return orderA - orderB;
    });
  }
}

/**
 * Creates a new instance of HtmlRuleRegistry with optional rules and configuration.
 * When rules are omitted, defaults to DEFAULT_HTML_MAPPING_RULES.
 */
export function createRuleRegistry(
  rules?: HtmlMappingRule[],
  options?: { allowedCustomTypes?: Iterable<string> },
): HtmlRuleRegistry {
  const initialRules = rules !== undefined ? rules : [...DEFAULT_HTML_MAPPING_RULES];
  return new HtmlRuleRegistry(initialRules, options);
}

/**
 * Convenience helper to create an execution context for an HtmlRuleRegistry.
 */
export function createMappingContext(
  registry: HtmlRuleRegistry,
  options?: HtmlImportOptions,
  overrides?: Partial<HtmlMappingContext>,
): HtmlMappingContext {
  return registry.createContext(options, overrides);
}
