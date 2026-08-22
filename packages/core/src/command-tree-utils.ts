import { Node, collectNodeIds } from '@kubuild/schema';

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
 * Recursively clone a node and its entire subtree, generating fresh unique IDs
 * for every node while preserving types, props, and responsive styles.
 */
export function cloneTreeWithNewIds(
  root: Node,
  idGenerator?: (oldId: string) => string,
  existingIds?: Set<string>,
): ClonedSubtreeResult {
  const idMap = new Map<string, string>();
  const idGen = idGenerator || ((oldId: string) => defaultIdGenerator(oldId, existingIds));

  function cloneRecursive(node: Node): Node {
    const newId = idGen(node.id);
    idMap.set(node.id, newId);

    const clonedProps = node.props ? deepClone(node.props) : undefined;
    const clonedStyles = node.styles ? deepClone(node.styles) : undefined;
    const clonedChildren = node.children
      ? node.children.map((child) => cloneRecursive(child))
      : [];

    return {
      id: newId,
      type: node.type,
      ...(clonedProps ? { props: clonedProps } : {}),
      ...(clonedStyles ? { styles: clonedStyles } : {}),
      children: clonedChildren,
    };
  }

  const clonedNode = cloneRecursive(root);
  return { clonedNode, idMap };
}
