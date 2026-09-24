import { Node, collectNodeIds, type ActionStep } from '@kubuild/schema';

/**
 * Deep clone an object immutably (JSON-safe).
 */
export function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

export interface NodeLocation {
  node: Node;
  parent: Node | null;
  index: number;
}

/**
 * Find a node, its parent, and index within the parent's children array.
 */
export function findNodeLocation(root: Node, targetId: string): NodeLocation | null {
  if (root.id === targetId) {
    return {
      node: root,
      parent: null,
      index: -1,
    };
  }

  return searchNodeLocationRecursive(root, targetId);
}

function searchNodeLocationRecursive(currentParent: Node, targetId: string): NodeLocation | null {
  if (!currentParent.children || currentParent.children.length === 0) {
    return null;
  }

  for (let i = 0; i < currentParent.children.length; i++) {
    const child = currentParent.children[i];
    if (child.id === targetId) {
      return {
        node: child,
        parent: currentParent,
        index: i,
      };
    }

    const foundInSubtree = searchNodeLocationRecursive(child, targetId);
    if (foundInSubtree) {
      return foundInSubtree;
    }
  }

  return null;
}

export type NavigationDirection = 'parent' | 'child' | 'previous-sibling' | 'next-sibling';

/**
 * Resolve the node id reached by moving from `nodeId` in a tree-navigation direction.
 * Returns null when there is nowhere to go (e.g. root has no parent, a leaf has no child,
 * or the node sits at the start/end of its sibling list).
 */
export function getNavigationTarget(
  root: Node,
  nodeId: string,
  direction: NavigationDirection,
): string | null {
  const location = findNodeLocation(root, nodeId);
  if (!location) return null;

  switch (direction) {
    case 'parent':
      return location.parent?.id ?? null;
    case 'child':
      return location.node.children?.[0]?.id ?? null;
    case 'previous-sibling': {
      if (!location.parent) return null;
      return (location.parent.children ?? [])[location.index - 1]?.id ?? null;
    }
    case 'next-sibling': {
      if (!location.parent) return null;
      return (location.parent.children ?? [])[location.index + 1]?.id ?? null;
    }
  }
}

/**
 * Returns the chain of ancestor node ids from the root down to (but excluding)
 * `targetId`, root first. Returns [] if targetId is the root or is not found.
 */
export function getAncestorChain(root: Node, targetId: string): string[] {
  if (root.id === targetId) return [];

  function walk(node: Node, acc: string[]): string[] | null {
    if (!node.children) return null;
    for (const child of node.children) {
      if (child.id === targetId) return acc;
      const found = walk(child, [...acc, child.id]);
      if (found) return found;
    }
    return null;
  }

  return walk(root, [root.id]) ?? [];
}

/**
 * STORA-232: Find the direct parent node of `targetId` in a single O(N) traversal.
 * Returns null when the target is the root or is not found in the tree.
 */
export function getParentNodeId(root: Node, targetId: string): string | null {
  if (root.id === targetId) return null;

  const stack: Node[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = current.children;
    if (!children) continue;
    for (const child of children) {
      if (child.id === targetId) return current.id;
      stack.push(child);
    }
  }
  return null;
}

/**
 * STORA-232: Return the full ancestor path of `targetId` as an array of nodes,
 * ordered from the root down to (and including) the target node itself.
 * Single O(N) traversal: the path is tracked during descent, so no re-walks.
 * Returns [] when the target is not found.
 */
export function getNodeAncestors(root: Node, targetId: string): Node[] {
  const path: Node[] = [];

  function walk(node: Node): boolean {
    path.push(node);
    if (node.id === targetId) return true;
    if (node.children) {
      for (const child of node.children) {
        if (walk(child)) return true;
      }
    }
    path.pop();
    return false;
  }

  return walk(root) ? path : [];
}

/**
 * Check whether `targetId` is a descendant of `ancestorNode` (or equal to ancestorNode.id).
 */
export function isDescendantOf(ancestorNode: Node, targetId: string): boolean {
  if (ancestorNode.id === targetId) {
    return true;
  }

  if (!ancestorNode.children || ancestorNode.children.length === 0) {
    return false;
  }

  for (const child of ancestorNode.children) {
    if (isDescendantOf(child, targetId)) {
      return true;
    }
  }

  return false;
}

/**
 * Collect all node IDs present in a node subtree as a Set.
 */
export function collectNodeIdSet(root: Node): Set<string> {
  return new Set(collectNodeIds(root));
}

/**
 * Default unique ID generator function for node duplication.
 */
export function defaultIdGenerator(oldId: string, existingIds?: Set<string>): string {
  // Strip existing suffix like _copy or _copy_1 if exists
  const baseName = oldId.replace(/_copy(_\d+)?$/, '');
  let candidate = `${baseName}_copy`;
  let counter = 1;

  if (existingIds) {
    while (existingIds.has(candidate)) {
      candidate = `${baseName}_copy_${counter}`;
      counter++;
    }
    existingIds.add(candidate);
  }

  return candidate;
}

export interface ClonedSubtreeResult {
  clonedNode: Node;
  idMap: Map<string, string>; // oldId -> newId
}

/**
 * Keys (in step payloads, legacy `props.action.payload`, and node props) whose string value
 * is a reference to another node's id. When a subtree is cloned with fresh ids, references
 * that point at a node *inside* that subtree are rewritten to the clone's new id; references
 * to nodes outside the subtree are left untouched.
 */
export const NODE_ID_REFERENCE_KEYS: ReadonlySet<string> = new Set([
  'modalId',
  'modalNodeId',
  'targetModalId',
  'targetNodeId',
  'nodeId',
  'formId',
  'targetId',
]);

/**
 * Keys whose string value may be an in-page anchor (`#<nodeId>`) — a node's DOM id is its
 * node id, so anchors to nodes inside a cloned subtree must follow the new id as well.
 */
const ANCHOR_REFERENCE_KEYS: ReadonlySet<string> = new Set(['url', 'href']);

function remapReferenceValue(key: string, value: unknown, idMap: ReadonlyMap<string, string>): unknown {
  if (typeof value !== 'string') return value;
  if (NODE_ID_REFERENCE_KEYS.has(key)) {
    return idMap.get(value) ?? idMap.get(value.trim()) ?? value;
  }
  if (ANCHOR_REFERENCE_KEYS.has(key) && value.startsWith('#')) {
    const mapped = idMap.get(value.slice(1));
    return mapped ? `#${mapped}` : value;
  }
  return value;
}

/** Remaps node-id references in a flat key/value record (props, step payloads). Mutates in place. */
function remapReferenceRecord(record: Record<string, unknown>, idMap: ReadonlyMap<string, string>): void {
  for (const [key, value] of Object.entries(record)) {
    record[key] = remapReferenceValue(key, value, idMap);
  }
}

function remapStepReferences(steps: ActionStep[] | undefined, idMap: ReadonlyMap<string, string>): void {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (step.payload && typeof step.payload === 'object') {
      remapReferenceRecord(step.payload, idMap);
    }
    remapStepReferences(step.onSuccess, idMap);
    remapStepReferences(step.onError, idMap);
  }
}

/**
 * Rewrites node-id references inside a single (already cloned) node so they follow `idMap`.
 * Covers action pipeline step payloads (incl. onSuccess/onError branches), `formConfig.formId`,
 * id-reference props (e.g. `modalId`, `formId`), `#anchor` hrefs, and the legacy `props.action`
 * payload. Mutates the node in place; callers must pass a clone they own.
 */
export function remapNodeReferences(node: Node, idMap: ReadonlyMap<string, string>): void {
  if (node.props && typeof node.props === 'object') {
    remapReferenceRecord(node.props, idMap);
    const legacyAction = node.props.action as { payload?: unknown } | undefined;
    if (
      legacyAction &&
      typeof legacyAction === 'object' &&
      legacyAction.payload &&
      typeof legacyAction.payload === 'object' &&
      !Array.isArray(legacyAction.payload)
    ) {
      remapReferenceRecord(legacyAction.payload as Record<string, unknown>, idMap);
    }
  }
  if (node.formConfig && typeof node.formConfig.formId === 'string') {
    node.formConfig.formId = idMap.get(node.formConfig.formId) ?? node.formConfig.formId;
  }
  if (Array.isArray(node.actions)) {
    for (const pipeline of node.actions) {
      remapStepReferences(pipeline.steps, idMap);
    }
  }
}

/**
 * Deep-clones a node subtree assigning every node a fresh id via `idGen`, preserving every
 * other `Node` field (props, styles, animation, actions, formConfig, and any future field),
 * then rewrites intra-subtree node-id references (see {@link remapNodeReferences}).
 */
export function cloneNodeTreeWithFreshIds(
  root: Node,
  idGen: (oldId: string, node: Node) => string,
): ClonedSubtreeResult {
  const idMap = new Map<string, string>();
  const clonedNodes: Node[] = [];

  function cloneRecursive(node: Node): Node {
    const newId = idGen(node.id, node);
    idMap.set(node.id, newId);

    const { children, ...rest } = node;
    const cloned: Node = {
      ...deepClone(rest),
      id: newId,
      children: children ? children.map((child) => cloneRecursive(child)) : [],
    };
    clonedNodes.push(cloned);
    return cloned;
  }

  const clonedNode = cloneRecursive(root);
  for (const cloned of clonedNodes) {
    remapNodeReferences(cloned, idMap);
  }
  return { clonedNode, idMap };
}

/**
 * Recursively clone a node and its entire subtree, generating fresh unique IDs
 * for every node while preserving every other node field (props, styles, animation,
 * actions, formConfig) and remapping intra-subtree node-id references.
 */
export function cloneTreeWithNewIds(
  root: Node,
  idGenerator?: (oldId: string) => string,
  existingIds?: Set<string>,
): ClonedSubtreeResult {
  const idGen = idGenerator || ((oldId: string) => defaultIdGenerator(oldId, existingIds));
  return cloneNodeTreeWithFreshIds(root, (oldId) => idGen(oldId));
}
