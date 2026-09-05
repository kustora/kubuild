import {
  PageDocument,
  Node,
  ResponsiveStyles,
  StyleDefinition,
  StyleDefinitionSchema,
  ResponsiveStylesSchema,
  AnimationConfig,
  AnimationConfigSchema,
  ActionPipeline,
  ActionPipelineSchema,
  FormConfig,
  FormConfigSchema,
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
  | 'ANIMATION_UPDATED'
  | 'ACTIONS_UPDATED'
  | 'FORM_CONFIG_UPDATED'
  | 'NODE_REMOVED'
  | 'NODE_DUPLICATED'
  | 'NODE_WRAPPED'
  | 'NODE_UNGROUPED';

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

export interface WrapNodeIntoFrameParams {
  /** Single node ID to wrap into a frame. */
  nodeId?: string;
  /** Multiple node IDs to wrap into a frame. */
  nodeIds?: string[] | string;
  /** Optional custom ID for the created flex frame container. */
  frameId?: string;
  /** Optional custom props for the flex frame container. */
  frameProps?: Record<string, unknown>;
  /** Optional custom responsive styles for the flex frame container. */
  frameStyles?: ResponsiveStyles;
}

export interface UngroupNodeFrameParams {
  /** Node ID of the flex container to unwrap. */
  nodeId: string;
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

export interface UpdateAnimationParams {
  nodeId: string;
  animation: Partial<AnimationConfig> | null;
  /**
   * If true (default), shallow merges new animation properties with existing animation config.
   * If false, replaces the animation config with the provided object.
   * If animation is null, removes the animation configuration from the node.
   */
  merge?: boolean;
}

/**
 * 7. Update the animation configuration of an existing node.
 * Returns a new PageDocument and an ANIMATION_UPDATED event.
 */
export function updateAnimation(
  document: PageDocument,
  params: UpdateAnimationParams,
): CommandResult {
  const { nodeId, animation, merge = true } = params;

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc) {
    throw new Error(`Cannot update animation: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const previousAnimation = targetNode.animation ? deepClone(targetNode.animation) : undefined;

  if (animation === null) {
    delete targetNode.animation;
  } else {
    const currentAnimation = targetNode.animation ? deepClone(targetNode.animation) : {};
    const candidate = merge
      ? { ...currentAnimation, ...deepClone(animation) }
      : deepClone(animation);
    targetNode.animation = AnimationConfigSchema.parse(candidate);
  }

  return {
    document: newDoc,
    event: {
      type: 'ANIMATION_UPDATED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: loc.parent ? loc.parent.id : undefined,
      payload: {
        animation: targetNode.animation,
        previousAnimation,
      },
    },
  };
}

export interface UpdateActionsParams {
  nodeId: string;
  actions: ActionPipeline[] | null;
}

/**
 * 8. Update the action pipelines of an existing node.
 * Returns a new PageDocument and an ACTIONS_UPDATED event.
 */
export function updateActions(
  document: PageDocument,
  params: UpdateActionsParams,
): CommandResult {
  const { nodeId, actions } = params;

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc) {
    throw new Error(`Cannot update actions: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const previousActions = targetNode.actions ? deepClone(targetNode.actions) : undefined;

  if (actions === null || (Array.isArray(actions) && actions.length === 0)) {
    delete targetNode.actions;
  } else {
    targetNode.actions = ActionPipelineSchema.array().parse(actions);
  }

  return {
    document: newDoc,
    event: {
      type: 'ACTIONS_UPDATED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: loc.parent ? loc.parent.id : undefined,
      payload: {
        actions: targetNode.actions,
        previousActions,
      },
    },
  };
}

export interface UpdateFormConfigParams {
  nodeId: string;
  formConfig: Partial<FormConfig> | null;
  /**
   * If true (default), shallow merges new formConfig properties with existing config.
   * If false, replaces the formConfig with the provided object.
   * If formConfig is null, removes the form configuration from the node.
   */
  merge?: boolean;
}

/**
 * 9. Update the form configuration of an existing node.
 * Returns a new PageDocument and a FORM_CONFIG_UPDATED event.
 */
export function updateFormConfig(
  document: PageDocument,
  params: UpdateFormConfigParams,
): CommandResult {
  const { nodeId, formConfig, merge = true } = params;

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc) {
    throw new Error(`Cannot update formConfig: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const previousFormConfig = targetNode.formConfig ? deepClone(targetNode.formConfig) : undefined;

  if (formConfig === null) {
    delete targetNode.formConfig;
  } else {
    const currentFormConfig = targetNode.formConfig ? deepClone(targetNode.formConfig) : { formId: nodeId };
    const candidate = merge
      ? { ...currentFormConfig, ...deepClone(formConfig) }
      : deepClone(formConfig);
    if (!candidate.formId) {
      candidate.formId = nodeId;
    }
    targetNode.formConfig = FormConfigSchema.parse(candidate);
  }

  return {
    document: newDoc,
    event: {
      type: 'FORM_CONFIG_UPDATED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: loc.parent ? loc.parent.id : undefined,
      payload: {
        formConfig: targetNode.formConfig,
        previousFormConfig,
      },
    },
  };
}

/**
 * 10. Wrap specified node(s) into a new flex container node at the same position in the parent.
 * Preserves sibling ordering and returns a new PageDocument and a NODE_WRAPPED event.
 * Full undo/redo compatibility with DocumentHistoryManager. (STORA-105)
 */
export function wrapNodeIntoFrame(
  document: PageDocument,
  params: WrapNodeIntoFrameParams,
): CommandResult {
  const rawIds =
    params.nodeIds !== undefined
      ? Array.isArray(params.nodeIds)
        ? params.nodeIds
        : [params.nodeIds]
      : params.nodeId
        ? [params.nodeId]
        : [];

  const targetIds = Array.from(
    new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)),
  );

  if (targetIds.length === 0) {
    throw new Error('Cannot wrap nodes: At least one node ID must be provided.');
  }

  // Prevent wrapping the root page node
  if (targetIds.includes(document.document.id)) {
    throw new Error('Cannot wrap the root page node.');
  }

  const newDoc = deepClone(document);

  // Locate all target nodes in the tree
  const locations: Array<{ node: Node; parent: Node; index: number }> = [];
  for (const id of targetIds) {
    const loc = findNodeLocation(newDoc.document, id);
    if (!loc || !loc.parent) {
      throw new Error(`Cannot wrap node: Node with ID "${id}" not found in document.`);
    }
    locations.push(loc as { node: Node; parent: Node; index: number });
  }

  // Verify all target nodes share the exact same parent container
  const parentId = locations[0].parent.id;
  const parentNode = locations[0].parent;
  for (const loc of locations) {
    if (loc.parent.id !== parentId) {
      throw new Error('Cannot wrap nodes: All nodes must share the same parent container.');
    }
  }

  // Determine frame ID
  const existingIds = collectNodeIdSet(newDoc.document);
  let frameId = params.frameId;
  if (frameId) {
    if (existingIds.has(frameId)) {
      throw new Error(`Cannot wrap nodes: Node ID "${frameId}" already exists in document.`);
    }
  } else {
    let counter = 1;
    while (existingIds.has(`flex_${counter}`)) {
      counter++;
    }
    frameId = `flex_${counter}`;
  }

  // Sort locations by their index in the parent to preserve original sibling order
  locations.sort((a, b) => a.index - b.index);

  // The insertion position in the parent is the index of the first node being wrapped
  const minIndex = locations[0].index;
  const wrappedNodes = locations.map((loc) => loc.node);

  // Remove the target nodes from the parent's children
  const targetIdSet = new Set(targetIds);
  parentNode.children = (parentNode.children || []).filter((child) => !targetIdSet.has(child.id));

  // Default flex container styles (STORA-102)
  const defaultFlexStyles: ResponsiveStyles = {
    base: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    },
  };

  const frameNode: Node = {
    id: frameId,
    type: 'flex',
    props: deepClone(params.frameProps || {}),
    styles: deepClone(params.frameStyles || defaultFlexStyles),
    children: wrappedNodes,
  };

  // Insert the frame node into the parent at minIndex
  const insertIndex = Math.min(minIndex, parentNode.children.length);
  parentNode.children.splice(insertIndex, 0, frameNode);

  return {
    document: newDoc,
    event: {
      type: 'NODE_WRAPPED',
      timestamp: new Date().toISOString(),
      nodeId: frameId,
      parentId,
      index: insertIndex,
      payload: {
        wrappedNodeIds: targetIds,
        frameNode: deepClone(frameNode),
      },
    },
  };
}

/**
 * 11. Unwrap a flex frame container, moving all of its children to its parent at its position,
 * and removing the container.
 * Returns a new PageDocument and a NODE_UNGROUPED event.
 * Full undo/redo compatibility with DocumentHistoryManager. (STORA-106)
 */
export function ungroupNodeFrame(
  document: PageDocument,
  params: UngroupNodeFrameParams,
): CommandResult {
  const { nodeId } = params;

  if (!nodeId || typeof nodeId !== 'string' || nodeId.trim().length === 0) {
    throw new Error('Invalid nodeId: Node ID must be a non-empty string.');
  }

  if (nodeId === document.document.id) {
    throw new Error('Cannot ungroup the root page node.');
  }

  const newDoc = deepClone(document);
  const loc = findNodeLocation(newDoc.document, nodeId);
  if (!loc || !loc.parent) {
    throw new Error(`Cannot ungroup node: Node with ID "${nodeId}" not found in document.`);
  }

  const targetNode = loc.node;
  const parentNode = loc.parent;
  const targetIndex = loc.index;

  // Verify that the node is a flex container
  if (targetNode.type !== 'flex') {
    throw new Error(`Cannot ungroup node: Node "${nodeId}" is not a flex container (type is "${targetNode.type}").`);
  }

  const unwrappedChildren = targetNode.children ? deepClone(targetNode.children) : [];

  if (!parentNode.children) {
    parentNode.children = [];
  }

  // Replace the frame container at targetIndex with all of its children in place
  parentNode.children.splice(targetIndex, 1, ...unwrappedChildren);

  return {
    document: newDoc,
    event: {
      type: 'NODE_UNGROUPED',
      timestamp: new Date().toISOString(),
      nodeId,
      parentId: parentNode.id,
      index: targetIndex,
      payload: {
        unwrappedChildIds: unwrappedChildren.map((c) => c.id),
        unwrappedChildren,
        removedNode: deepClone(targetNode),
      },
    },
  };
}

