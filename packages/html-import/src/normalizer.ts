/**
 * @kubuild/html-import
 * Tree normalization pipeline: wrapper collapsing, text node merging,
 * style stripping, deterministic ID generation, depth limiting, and limit checks.
 */

import { DEFAULT_DOCUMENT_SECURITY_LIMITS } from '@kubuild/core';
import type { ResponsiveStyles, StyleDefinition } from '@kubuild/schema';
import {
  addDiagnostic,
  type HtmlImportOptions,
  type HtmlImportReport,
  type PageNode,
} from './types.js';
import { INHERITED_TEXT_PROPERTIES } from './cascade.js';

/**
 * Properties that are considered negligible / default on container/flex wrappers.
 */
const NEGLIGIBLE_STYLE_PROPERTIES = new Set([
  'display',
  'boxSizing',
]);

/**
 * Values for negligible properties that do not provide meaningful layout distinction.
 */
const NEGLIGIBLE_STYLE_VALUES: Record<string, Set<string>> = {
  display: new Set(['block', 'flex', 'inline', 'inline-block', 'contents']),
  boxSizing: new Set(['border-box', 'content-box']),
};

/**
 * Cleans an individual StyleDefinition by stripping undefined, null, and empty string values.
 * Returns undefined if no non-empty style properties remain.
 */
export function cleanStyleDefinition(
  styleDef?: StyleDefinition,
): StyleDefinition | undefined {
  if (!styleDef || typeof styleDef !== 'object') {
    return undefined;
  }
  const cleaned: StyleDefinition = {};
  for (const [key, value] of Object.entries(styleDef)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

/**
 * Strips empty style objects and empty/undefined/null values from ResponsiveStyles.
 * Removes empty base, desktop, tablet, mobile, and states objects.
 */
export function stripRedundantStyles(
  styles?: ResponsiveStyles,
): ResponsiveStyles {
  if (!styles || typeof styles !== 'object') {
    return {};
  }

  const result: ResponsiveStyles = {};

  const base = cleanStyleDefinition(styles.base);
  if (base) result.base = base;

  const desktop = cleanStyleDefinition(styles.desktop);
  if (desktop) result.desktop = desktop;

  const tablet = cleanStyleDefinition(styles.tablet);
  if (tablet) result.tablet = tablet;

  const mobile = cleanStyleDefinition(styles.mobile);
  if (mobile) result.mobile = mobile;

  if (styles.states && typeof styles.states === 'object') {
    const cleanedStates: Record<string, StyleDefinition> = {};
    for (const [st, def] of Object.entries(styles.states)) {
      const cleanedDef = cleanStyleDefinition(def);
      if (cleanedDef) {
        cleanedStates[st] = cleanedDef;
      }
    }
    if (Object.keys(cleanedStates).length > 0) {
      result.states = cleanedStates;
    }
  }

  return result;
}

/**
 * Recursively applies `stripRedundantStyles` across all nodes in the tree.
 */
export function stripStylesFromTree(nodes: PageNode[]): PageNode[] {
  return nodes.map((node) => {
    const copy: PageNode = {
      ...node,
      styles: stripRedundantStyles(node.styles),
    };
    if (copy.children && Array.isArray(copy.children) && copy.children.length > 0) {
      copy.children = stripStylesFromTree(copy.children);
    }
    return copy;
  });
}

/**
 * Removes inherited text properties (`INHERITED_TEXT_PROPERTIES`) from each node's base
 * styles when the value equals what the node already inherits from its mapped parent.
 * The cascade resolves inheritance per element, so without this step every descendant
 * would repeat the parent's `color`/`font-*`/`line-height`/`text-align`.
 */
export function stripInheritedTextStyles(
  nodes: PageNode[],
  inherited: Readonly<Record<string, string>> = {},
): PageNode[] {
  return nodes.map((node) => {
    const base = node.styles?.base;
    let effective = inherited;
    let copy: PageNode = node;

    if (base && typeof base === 'object') {
      const nextBase: StyleDefinition = { ...base };
      const nextEffective: Record<string, string> = { ...inherited };
      for (const prop of INHERITED_TEXT_PROPERTIES) {
        const value = nextBase[prop];
        if (value === undefined || value === null || value === '') continue;
        const normalized = String(value);
        if (inherited[prop] === normalized) {
          delete nextBase[prop];
        } else {
          nextEffective[prop] = normalized;
        }
      }
      effective = nextEffective;
      copy = { ...node, styles: { ...node.styles, base: nextBase } };
    }

    if (copy.children && Array.isArray(copy.children) && copy.children.length > 0) {
      copy = { ...copy, children: stripInheritedTextStyles(copy.children, effective) };
    }
    return copy;
  });
}

/**
 * Checks whether a node's styles are empty or negligible (i.e. default display/box-sizing only,
 * with no custom background, border, padding, margin, width, height, etc.).
 */
export function isNegligibleStyles(styles?: ResponsiveStyles): boolean {
  if (!styles || typeof styles !== 'object') {
    return true;
  }

  // Any breakpoint or interactive state layer implies distinct styling
  if (styles.desktop && Object.keys(styles.desktop).length > 0) return false;
  if (styles.tablet && Object.keys(styles.tablet).length > 0) return false;
  if (styles.mobile && Object.keys(styles.mobile).length > 0) return false;
  if (styles.states && Object.keys(styles.states).length > 0) return false;

  if (!styles.base || Object.keys(styles.base).length === 0) {
    return true;
  }

  // Base styles must only contain negligible properties with standard default values
  for (const [prop, val] of Object.entries(styles.base)) {
    if (val === undefined || val === null || val === '') continue;
    if (!NEGLIGIBLE_STYLE_PROPERTIES.has(prop)) {
      return false;
    }
    const strVal = String(val).toLowerCase().trim();
    const allowed = NEGLIGIBLE_STYLE_VALUES[prop];
    if (!allowed || !allowed.has(strVal)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether a node has meaningful custom props other than default ID.
 */
export function hasMeaningfulCustomProps(node: PageNode): boolean {
  if (!node.props || typeof node.props !== 'object') {
    return false;
  }

  for (const [key, value] of Object.entries(node.props)) {
    if (key === 'id') continue;
    if (value !== undefined && value !== null && value !== '') {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a node qualifies as a redundant wrapper container that can be collapsed.
 */
export function isCollapsibleWrapperNode(node: PageNode): boolean {
  if (node.type !== 'container' && node.type !== 'flex') {
    return false;
  }
  if (!node.children || node.children.length !== 1) {
    return false;
  }
  if (hasMeaningfulCustomProps(node)) {
    return false;
  }
  if (!isNegligibleStyles(node.styles)) {
    return false;
  }
  return true;
}

/**
 * Collapses redundant wrapper containers by promoting their single child in place.
 */
export function collapseRedundantWrappers(nodes: PageNode[]): PageNode[] {
  const result: PageNode[] = [];

  for (let node of nodes) {
    // 1. Recursively collapse children first (bottom-up)
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      node.children = collapseRedundantWrappers(node.children);
    }

    // 2. While this node itself is a collapsible wrapper, promote its single child
    while (isCollapsibleWrapperNode(node)) {
      const child = node.children![0];
      node = child;
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        node.children = collapseRedundantWrappers(node.children);
      }
    }

    result.push(node);
  }

  return result;
}

/**
 * Checks whether two style objects are functionally equivalent after redundant style stripping.
 */
export function areStylesEquivalent(
  stylesA?: ResponsiveStyles,
  stylesB?: ResponsiveStyles,
): boolean {
  const cleanA = stripRedundantStyles(stylesA);
  const cleanB = stripRedundantStyles(stylesB);

  const keysA = Object.keys(cleanA);
  const keysB = Object.keys(cleanB);
  if (keysA.length === 0 && keysB.length === 0) {
    return true;
  }

  return JSON.stringify(cleanA) === JSON.stringify(cleanB);
}

/**
 * Checks if two consecutive sibling nodes can be merged into a single text component.
 */
export function areTextNodesMergeable(nodeA: PageNode, nodeB: PageNode): boolean {
  if (nodeA.type !== 'text' || nodeB.type !== 'text') {
    return false;
  }

  const asA = (nodeA.props?.as as string | undefined) || 'span';
  const asB = (nodeB.props?.as as string | undefined) || 'span';
  if (asA !== asB) {
    return false;
  }

  if (!areStylesEquivalent(nodeA.styles, nodeB.styles)) {
    return false;
  }

  const keysA = Object.keys(nodeA.props || {}).filter(
    (k) => k !== 'text' && k !== 'id' && nodeA.props![k] !== undefined,
  );
  const keysB = Object.keys(nodeB.props || {}).filter(
    (k) => k !== 'text' && k !== 'id' && nodeB.props![k] !== undefined,
  );
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (nodeA.props![k] !== nodeB.props![k]) return false;
  }

  return true;
}

/**
 * Merges consecutive text components with identical tag (props.as) and styles.
 */
export function mergeConsecutiveTextNodes(nodes: PageNode[]): PageNode[] {
  const merged: PageNode[] = [];

  for (const node of nodes) {
    const nodeCopy = { ...node };
    if (nodeCopy.children && Array.isArray(nodeCopy.children) && nodeCopy.children.length > 0) {
      nodeCopy.children = mergeConsecutiveTextNodes(nodeCopy.children);
    }

    const prev = merged[merged.length - 1];
    if (prev && areTextNodesMergeable(prev, nodeCopy)) {
      prev.props = {
        ...prev.props,
        text: String(prev.props?.text ?? '') + String(nodeCopy.props?.text ?? ''),
      };
    } else {
      merged.push(nodeCopy);
    }
  }

  return merged;
}

/**
 * Traverses the tree, enforcing maxTreeDepth by flattening deeper branches.
 */
export function flattenTreeDepth(
  nodes: PageNode[],
  maxDepth: number,
  currentDepth = 1,
  currentPath = '',
  report?: HtmlImportReport,
): PageNode[] {
  const result: PageNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = { ...nodes[i] };
    const nodePath = currentPath ? `${currentPath}/${i}` : `node-${i + 1}`;

    if (currentDepth >= maxDepth) {
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        if (report) {
          addDiagnostic(report, {
            code: 'DEPTH_FLATTENED',
            severity: 'warning',
            message: `Tree depth (${currentDepth + 1}) exceeded maximum limit (${maxDepth}) at '${nodePath}'. Deeper children were flattened.`,
            location: { path: nodePath },
            details: { depth: currentDepth + 1, maxDepth, path: nodePath },
          });
        }
        delete node.children;
      }
      result.push(node);
      continue;
    }

    if (currentDepth >= maxDepth - 1) {
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        let hasDeeperChildren = false;
        const flatChildren: PageNode[] = [];

        function collectDescendants(childNode: PageNode) {
          const childCopy = { ...childNode };
          const grandChildren = childCopy.children;
          delete childCopy.children;
          flatChildren.push(childCopy);

          if (grandChildren && Array.isArray(grandChildren) && grandChildren.length > 0) {
            hasDeeperChildren = true;
            for (const gc of grandChildren) {
              collectDescendants(gc);
            }
          }
        }

        for (const child of node.children) {
          collectDescendants(child);
        }

        if (hasDeeperChildren) {
          if (report) {
            addDiagnostic(report, {
              code: 'DEPTH_FLATTENED',
              severity: 'warning',
              message: `Tree depth exceeded maximum limit (${maxDepth}) at '${nodePath}'. Deeper children were flattened.`,
              location: { path: nodePath },
              details: { depth: currentDepth + 2, maxDepth, path: nodePath },
            });
          }
          node.children = flatChildren;
        } else {
          node.children = node.children.map((c) => {
            const copy = { ...c };
            delete copy.children;
            return copy;
          });
        }
      }
      result.push(node);
      continue;
    }

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      node.children = flattenTreeDepth(
        node.children,
        maxDepth,
        currentDepth + 1,
        nodePath,
        report,
      );
    }
    result.push(node);
  }

  return result;
}

/**
 * Assigns deterministic node IDs based on hierarchy path and sibling index.
 * Format: root-page, node-1, node-1-1, node-1-2, etc.
 */
export function assignDeterministicNodeIds(
  nodes: PageNode[],
  parentPath?: string,
): void {
  nodes.forEach((node, index) => {
    const siblingIndex = index + 1;

    if (node.type === 'page') {
      node.id = 'root-page';
      if (node.children && Array.isArray(node.children) && node.children.length > 0) {
        assignDeterministicNodeIds(node.children, 'node');
      }
      return;
    }

    const currentId =
      parentPath && parentPath !== ''
        ? `${parentPath}-${siblingIndex}`
        : `node-${siblingIndex}`;

    node.id = currentId;

    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      assignDeterministicNodeIds(node.children, currentId);
    }
  });
}

/**
 * Recursively counts the total number of nodes in a PageNode hierarchy.
 */
export function countTotalNodes(nodes: PageNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children && Array.isArray(node.children) && node.children.length > 0) {
      count += countTotalNodes(node.children);
    }
  }
  return count;
}

/**
 * Normalizes a PageNode tree:
 * 1. Strips redundant / empty style objects.
 * 2. Collapses redundant unstyled single-child wrapper containers.
 * 3. Merges consecutive text nodes with identical tags and styles.
 * 4. Limits tree depth according to maxTreeDepth and flattens excess depth.
 * 5. Generates deterministic node IDs (e.g. root-page, node-1, node-1-1).
 * 6. Checks total node count against maxNodeCount limit.
 *
 * @param nodes List of PageNodes to normalize
 * @param options HTML import options containing security limits
 * @param report Optional report to record diagnostics
 * @param maxDepth Optional explicit override for maximum tree depth
 * @returns Array of normalized PageNodes
 */
export function normalizeNodeTree(
  nodes: PageNode[],
  options?: HtmlImportOptions,
  report?: HtmlImportReport,
  maxDepth?: number,
): PageNode[] {
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  const effectiveMaxDepth =
    maxDepth ??
    options?.limits?.maxTreeDepth ??
    DEFAULT_DOCUMENT_SECURITY_LIMITS.maxTreeDepth ??
    32;

  // 1. Strip inherited duplicates and redundant / default styles first
  let tree = stripStylesFromTree(stripInheritedTextStyles(nodes));

  // 2. Collapse redundant wrapper containers
  tree = collapseRedundantWrappers(tree);

  // 3. Merge consecutive text nodes
  tree = mergeConsecutiveTextNodes(tree);

  // 4. Depth limiting & flattening
  tree = flattenTreeDepth(tree, effectiveMaxDepth, 1, '', report);

  // 5. Deterministic Node IDs
  assignDeterministicNodeIds(tree);

  // 6. Node count limit checking
  const maxNodeCount = options?.limits?.maxNodeCount ?? 1000;
  const totalCount = countTotalNodes(tree);
  if (report && totalCount > maxNodeCount) {
    addDiagnostic(report, {
      code: 'LIMIT_EXCEEDED',
      severity: 'error',
      message: `Document node count (${totalCount}) exceeds maximum allowed node count (${maxNodeCount})`,
      details: { count: totalCount, limit: maxNodeCount },
    });
  }

  return tree;
}
