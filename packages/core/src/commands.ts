import {
  PageDocument,
  Node,
  ResponsiveStyles,
  StyleDefinition,
  StyleDefinitionSchema,
  ResponsiveStylesSchema,
} from '@kubuild/schema';
import {
  deepClone,
  findNodeLocation,
  isDescendantOf,
  collectNodeIdSet,
  cloneTreeWithNewIds,
} from './command-tree-utils';

export type DocumentChangeType =
  | 'NODE_INSERTED'
  | 'NODE_MOVED'
  | 'PROPS_UPDATED'
  | 'STYLE_UPDATED'
  | 'NODE_REMOVED'
  | 'NODE_DUPLICATED';

export interface DocumentChangeEvent {
  type: DocumentChangeType;
  timestamp: string;
  nodeId: string;
  parentId?: string;
  previousParentId?: string;
  index?: number;
  previousIndex?: number;
  payload?: Record<string, unknown>;
}

export interface CommandResult {
  document: PageDocument;
  event: DocumentChangeEvent;
}

export interface InsertNodeParams {
  parentId: string;
  node: Node;
  index?: number;
}

export interface MoveNodeParams {
  nodeId: string;
  targetParentId: string;
  index?: number;
}

export interface UpdatePropsParams {
  nodeId: string;
  props: Record<string, unknown>;
  /**
   * If true (default), shallow merges new props with existing props.
   * If false, replaces the entire props object.
   */
  merge?: boolean;
}

export interface UpdateStyleParams {
  nodeId: string;
  styles: ResponsiveStyles | StyleDefinition;
  /**
   * Target breakpoint to update directly, or if omitted, applies to whole ResponsiveStyles structure.
   */
  breakpoint?: 'base' | 'desktop' | 'tablet' | 'mobile';
  /**
   * Target pseudo-state layer (e.g. ':hover', ':active', ':focus') — STORA-221.
   * When set, `styles` is written to `node.styles.states[state]` instead of a
   * breakpoint layer, leaving default (breakpoint) values untouched.
   */
  state?: string;
  /**
   * If true (default), shallow merges style definitions at target breakpoint.
   * If false, replaces the style definition object.
   */
  merge?: boolean;
}

export interface RemoveNodeParams {
  nodeId: string;
}

export interface DuplicateNodeParams {
  nodeId: string;
  targetParentId?: string;
  index?: number;
  idGenerator?: (oldId: string) => string;
}

/**
 * 1. Insert a node into a target parent node.
 * Returns a new PageDocument and a NODE_INSERTED event.
 */
export function insertNode(
  document: PageDocument,
  params: InsertNodeParams,
): CommandResult {
  const { parentId, node, index } = params;

  if (!node || typeof node !== 'object' || !node.id || !node.type) {
    throw new Error('Invalid node: Node must be an object with non-empty "id" and "type"');
  }

  const newDoc = deepClone(document);
  const existingIds = collectNodeIdSet(newDoc.document);

  // Check duplicate ID
  const incomingIds = collectNodeIdSet(node);
  for (const incId of incomingIds) {
    if (existingIds.has(incId)) {
      throw new Error(`Cannot insert node: Duplicate node ID "${incId}" already exists in document.`);
    }
  }

  const parentLoc = findNodeLocation(newDoc.document, parentId);
  if (!parentLoc) {
    throw new Error(`Cannot insert node: Target parent node with ID "${parentId}" not found.`);
  }

  const parentNode = parentLoc.node;
  if (!parentNode.children) {
    parentNode.children = [];
  }

  const insertIndex =
    typeof index === 'number' && index >= 0 && index <= parentNode.children.length
      ? index
      : parentNode.children.length;

  parentNode.children.splice(insertIndex, 0, deepClone(node));

  return {
    document: newDoc,
    event: {
      type: 'NODE_INSERTED',
      timestamp: new Date().toISOString(),
      nodeId: node.id,
      parentId,
      index: insertIndex,
      payload: {
        nodeType: node.type,
      },
    },
  };
}

/**
 * 2. Move a node from its current location to a new parent location.
 * Prevents moving the root node or moving a node into its own descendant tree.
 * Returns a new PageDocument and a NODE_MOVED event.
 */
export function moveNode(
  document: PageDocument,
  params: MoveNodeParams,
): CommandResult {
  const { nodeId, targetParentId, index } = params;

  if (nodeId === document.document.id) {
    throw new Error('Cannot move the root page node.');
  }

  const newDoc = deepClone(document);

  const sourceLoc = findNodeLocation(newDoc.document, nodeId);
  if (!sourceLoc || !sourceLoc.parent) {
    throw new Error(`Cannot move node: Node with ID "${nodeId}" not found in document.`);
  }

  const targetLoc = findNodeLocation(newDoc.document, targetParentId);
  if (!targetLoc) {
    throw new Error(`Cannot move node: Target parent with ID "${targetParentId}" not found in document.`);
  }

  // Descendant cycle check: Cannot move node into itself or any of its descendants
  if (isDescendantOf(sourceLoc.node, targetParentId)) {
    throw new Error(
      `Cannot move node: Target parent "${targetParentId}" is the node itself or a descendant of node "${nodeId}".`,
    );
  }

  const previousParentId = sourceLoc.parent.id;
  const previousIndex = sourceLoc.index;

  // Remove node from source parent
  const [removedNode] = sourceLoc.parent.children!.splice(previousIndex, 1);

  // Target parent might be the same parent or different parent
  const targetParent = targetLoc.node;
  if (!targetParent.children) {
    targetParent.children = [];
  }

  let targetIndex =
    typeof index === 'number' && index >= 0 && index <= targetParent.children.length
      ? index
      : targetParent.children.length;

  targetParent.children.splice(targetIndex, 0, removedNode);

  return {
    document: newDoc,
    event: {
      type: 'NODE_MOVED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: targetParentId,
      previousParentId,
      index: targetIndex,
      previousIndex,
    },
  };
}

/**
 * 3. Update the props of an existing node.
 * Returns a new PageDocument and a PROPS_UPDATED event.
 */
export function updateProps(
  document: PageDocument,
  params: UpdatePropsParams,
): CommandResult {
  const { nodeId, props, merge = true } = params;

  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    throw new Error('Props must be an object.');
  }

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc) {
    throw new Error(`Cannot update props: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const previousProps = targetNode.props ? deepClone(targetNode.props) : {};

  if (merge) {
    targetNode.props = {
      ...previousProps,
      ...deepClone(props),
    };
  } else {
    targetNode.props = deepClone(props);
  }

  return {
    document: newDoc,
    event: {
      type: 'PROPS_UPDATED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: loc.parent ? loc.parent.id : undefined,
      payload: {
        props: targetNode.props,
        previousProps,
      },
    },
  };
}

/**
 * 4. Update the responsive styles of an existing node.
 * Supports updating a specific breakpoint ('base', 'desktop', etc.) or the whole ResponsiveStyles object.
 * Returns a new PageDocument and a STYLE_UPDATED event.
 */
export function updateStyle(
  document: PageDocument,
  params: UpdateStyleParams,
): CommandResult {
  const { nodeId, styles, breakpoint, state, merge = true } = params;

  if (!styles || typeof styles !== 'object' || Array.isArray(styles)) {
    throw new Error('Styles must be an object.');
  }

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc) {
    throw new Error(`Cannot update style: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const currentStyles: ResponsiveStyles = targetNode.styles ? deepClone(targetNode.styles) : {};
  const previousStyles = deepClone(currentStyles);

  if (state) {
    // Pseudo-state layer update (STORA-221): writes into styles.states[state]
    // without touching default breakpoint values. Parsed through
    // StyleDefinitionSchema so unsafe values are rejected here too.
    const newBreakpointStyles = StyleDefinitionSchema.parse(styles);
    const states = { ...(currentStyles.states ?? {}) };
    const currentStateStyles = states[state] ?? {};

    if (merge) {
      states[state] = { ...currentStateStyles, ...deepClone(newBreakpointStyles) };
    } else {
      states[state] = deepClone(newBreakpointStyles);
    }

    targetNode.styles = { ...currentStyles, states } as ResponsiveStyles;

    return {
      document: newDoc,
      event: {
        type: 'STYLE_UPDATED',
        timestamp: new Date().toISOString(),
        nodeId,
        parentId: loc.parent ? loc.parent.id : undefined,
        payload: {
          styles: targetNode.styles,
          previousStyles,
          state,
        },
      },
    };
  }

  if (breakpoint) {
    // Updating a single breakpoint style definition. Parsed through
    // StyleDefinitionSchema so unsafe/non-serializable values (STORA-023)
    // are rejected here too, not just at document-parse time.
    const currentBreakpointStyles = (currentStyles[breakpoint] as StyleDefinition) || {};
    const newBreakpointStyles = StyleDefinitionSchema.parse(styles);

    if (merge) {
      currentStyles[breakpoint] = {
        ...currentBreakpointStyles,
        ...deepClone(newBreakpointStyles),
      };
    } else {
      currentStyles[breakpoint] = deepClone(newBreakpointStyles);
    }
  } else {
    // Updating responsive styles container
    const responsiveStylesInput = ResponsiveStylesSchema.parse(styles);
    if (merge) {
      for (const bp of ['base', 'desktop', 'tablet', 'mobile'] as const) {
        if (responsiveStylesInput[bp] !== undefined) {
          const currentBp = (currentStyles[bp] as StyleDefinition) || {};
          const incomingBp = (responsiveStylesInput[bp] as StyleDefinition) || {};
          currentStyles[bp] = {
            ...currentBp,
            ...deepClone(incomingBp),
          };
        }
      }
    } else {
      targetNode.styles = deepClone(responsiveStylesInput);
      return {
        document: newDoc,
        event: {
          type: 'STYLE_UPDATED',
          timestamp: new Date().toISOString(),
          nodeId,
          parentId: loc.parent ? loc.parent.id : undefined,
          payload: {
            styles: targetNode.styles,
            previousStyles,
          },
        },
      };
    }
  }

  targetNode.styles = currentStyles;

  return {
    document: newDoc,
    event: {
      type: 'STYLE_UPDATED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: loc.parent ? loc.parent.id : undefined,
      payload: {
        styles: currentStyles,
        previousStyles,
        breakpoint,
      },
    },
  };
}

/**
 * 5. Remove a node from the document tree.
 * Prevents removing the root page node.
 * Returns a new PageDocument and a NODE_REMOVED event.
 */
export function removeNode(
  document: PageDocument,
  params: RemoveNodeParams,
): CommandResult {
  const { nodeId } = params;

  if (nodeId === document.document.id) {
    throw new Error('Cannot remove the root page node.');
  }

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc || !loc.parent) {
    throw new Error(`Cannot remove node: Node with ID "${nodeId}" not found in document.`);
  }

  const parentId = loc.parent.id;
  const index = loc.index;

  const [removedNode] = loc.parent.children!.splice(index, 1);

  return {
    document: newDoc,
    event: {
      type: 'NODE_REMOVED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId,
      index,
      payload: {
        node: removedNode,
      },
    },
  };
}

/**
 * 6. Duplicate a node and its entire subtree.
 * Generates fresh unique IDs for all cloned nodes in the subtree, preserves props/styles,
 * and inserts the duplicate right after the original node (or at specified targetParentId/index).
 * Returns a new PageDocument and a NODE_DUPLICATED event.
 */
export function duplicateNode(
  document: PageDocument,
  params: DuplicateNodeParams,
): CommandResult {
  const { nodeId, targetParentId, index, idGenerator } = params;

  if (nodeId === document.document.id) {
    throw new Error('Cannot duplicate the root page node.');
  }

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc || !loc.parent) {
    throw new Error(`Cannot duplicate node: Node with ID "${nodeId}" not found in document.`);
  }

  const existingIds = collectNodeIdSet(newDoc.document);
  const { clonedNode, idMap } = cloneTreeWithNewIds(loc.node, idGenerator, existingIds);

  const destinationParentId = targetParentId || loc.parent.id;
  const destParentLoc = findNodeLocation(newDoc.document, destinationParentId);
  if (!destParentLoc) {
    throw new Error(`Cannot duplicate node: Destination parent "${destinationParentId}" not found.`);
  }

  const destParent = destParentLoc.node;
  if (!destParent.children) {
    destParent.children = [];
  }

  // Default insertion position is right after the source node if in same parent, else appended
  let insertIndex: number;
  if (typeof index === 'number' && index >= 0 && index <= destParent.children.length) {
    insertIndex = index;
  } else if (destinationParentId === loc.parent.id) {
    insertIndex = loc.index + 1;
  } else {
    insertIndex = destParent.children.length;
  }

  destParent.children.splice(insertIndex, 0, clonedNode);

  return {
    document: newDoc,
    event: {
      type: 'NODE_DUPLICATED',
      timestamp: new Date().toISOString(),
      nodeId: clonedNode.id,
      parentId: destinationParentId,
      index: insertIndex,
      payload: {
        originalNodeId: nodeId,
        idMap: Object.fromEntries(idMap.entries()),
      },
    },
  };
}
