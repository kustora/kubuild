import {
  Artboard,
  ArtboardType,
  Node,
  PageDocument,
  ProjectDocument,
  SCHEMA_NAME,
  PROJECT_SCHEMA_NAME,
  CURRENT_PROJECT_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION,
  ARTBOARD_REFERENCE_NODE_TYPE,
} from '@kubuild/schema';
import { deepClone, findNodeLocation, collectNodeIdSet } from './command-tree-utils';
import { createBlankDocument } from './document-utils';

export type ArtboardChangeType =
  | 'ARTBOARD_ADDED'
  | 'ARTBOARD_REMOVED'
  | 'ARTBOARD_RENAMED'
  | 'ACTIVE_ARTBOARD_CHANGED'
  | 'NODE_EXTRACTED_TO_ARTBOARD';

export interface ArtboardChangeEvent {
  type: ArtboardChangeType;
  timestamp: string;
  artboardId: string;
  /** Source artboard, for operations that move content between artboards. */
  sourceArtboardId?: string;
  nodeId?: string;
  payload?: Record<string, unknown>;
}

/**
 * Mirrors CommandResult from commands.ts, but at the project (multi-artboard) level.
 * Node-level commands keep returning CommandResult and keep operating on a single
 * PageDocument, unchanged.
 */
export interface ProjectCommandResult {
  project: ProjectDocument;
  event: ArtboardChangeEvent;
}

export interface AddArtboardParams {
  artboard: Artboard;
  index?: number;
  /** Make the newly added artboard active (default: true). */
  activate?: boolean;
}

export interface RemoveArtboardParams {
  artboardId: string;
}

export interface RenameArtboardParams {
  artboardId: string;
  name: string;
}

export interface SetActiveArtboardParams {
  artboardId: string;
}

export interface ExtractNodeToArtboardParams {
  /** Artboard currently holding the node. */
  artboardId: string;
  /** Node whose subtree becomes the new artboard's content. */
  nodeId: string;
  /** Optional explicit name for the new artboard (defaults to the node type). */
  name?: string;
  /** Optional explicit id for the new artboard. */
  newArtboardId?: string;
  /** Make the new artboard active (default: false — authors usually keep editing the page). */
  activate?: boolean;
}

const now = (): string => new Date().toISOString();

/**
 * Collect every node id used anywhere in the project (across all artboards).
 * Node ids must be unique project-wide so that content can move between artboards
 * without silently colliding.
 */
export function collectProjectNodeIds(project: ProjectDocument): Set<string> {
  const ids = new Set<string>();
  for (const artboard of project.artboards) {
    for (const id of collectNodeIdSet(artboard.document.document)) {
      ids.add(id);
    }
  }
  return ids;
}

function uniqueId(prefix: string, taken: Set<string>): string {
  let counter = 1;
  while (taken.has(`${prefix}_${counter}`)) {
    counter++;
  }
  return `${prefix}_${counter}`;
}

export function findArtboardById(
  project: ProjectDocument,
  artboardId: string,
): Artboard | undefined {
  return project.artboards.find((artboard) => artboard.id === artboardId);
}

/**
 * Resolve the component artboard an `open_modal` / `close_modal` action targets.
 * ModalManager keys off plain strings, so a trigger in one artboard can address
 * content in another with no additional wiring.
 */
export function findArtboardByTriggerId(
  project: ProjectDocument,
  triggerId: string,
): Artboard | undefined {
  if (!triggerId) return undefined;
  return project.artboards.find(
    (artboard) => artboard.artboardType === 'component' && artboard.triggerId === triggerId,
  );
}

export function getActiveArtboard(project: ProjectDocument): Artboard | undefined {
  if (project.activeArtboardId) {
    const active = findArtboardById(project, project.activeArtboardId);
    if (active) return active;
  }
  return project.artboards[0];
}

export function getPageArtboards(project: ProjectDocument): Artboard[] {
  return project.artboards.filter((artboard) => artboard.artboardType === 'page');
}

export function getComponentArtboards(project: ProjectDocument): Artboard[] {
  return project.artboards.filter((artboard) => artboard.artboardType === 'component');
}

export interface CreateArtboardOptions {
  id?: string;
  slug?: string;
  triggerId?: string;
  viewport?: Artboard['viewport'];
  width?: number;
}

/**
 * Build a page artboard around a fresh blank document.
 */
export function createPageArtboard(
  name = 'Untitled Page',
  options: CreateArtboardOptions = {},
): Artboard {
  return {
    id: options.id ?? `artboard-page-${Date.now()}`,
    name,
    artboardType: 'page',
    slug: options.slug ?? '/',
    document: createBlankDocument(name),
    ...(options.viewport ? { viewport: options.viewport } : {}),
    ...(options.width !== undefined ? { width: options.width } : {}),
  };
}

/**
 * Wrap an existing node as the sole child of a synthetic `page` root and return it as a
 * component artboard. The synthetic root exists so each artboard's `document` stays a
 * fully valid PageDocument, meaning no existing command, validator, or history code
 * needs to know that component artboards exist at all.
 */
export function createComponentArtboard(
  node: Node,
  options: CreateArtboardOptions & { name?: string; rootId?: string } = {},
): Artboard {
  const name = options.name ?? node.type;
  const triggerId =
    options.triggerId ??
    (typeof node.props?.modalId === 'string' && node.props.modalId.trim().length > 0
      ? (node.props.modalId as string)
      : node.id);

  const document: PageDocument = {
    schema: SCHEMA_NAME,
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: name,
      description: '',
      author: '',
      tags: [],
      category: 'component',
      version: CURRENT_SCHEMA_VERSION,
      createdAt: now(),
      updatedAt: now(),
    },
    document: {
      id: options.rootId ?? `${node.id}-artboard-root`,
      type: 'page',
      props: { title: name },
      // Transparent surface: a component artboard is a canvas for the node, not a page.
      styles: { base: { minHeight: 'auto', backgroundColor: 'transparent' } },
      children: [deepClone(node)],
    },
  };

  return {
    id: options.id ?? `artboard-component-${node.id}`,
    name,
    artboardType: 'component',
    triggerId,
    document,
    ...(options.viewport ? { viewport: options.viewport } : {}),
    ...(options.width !== undefined ? { width: options.width } : {}),
  };
}

/**
 * Create a project containing a single blank page artboard.
 */
export function createBlankProject(title = 'Untitled Page'): ProjectDocument {
  const artboard = createPageArtboard(title, { id: 'artboard-page-1' });
  return {
    schema: PROJECT_SCHEMA_NAME,
    version: CURRENT_PROJECT_SCHEMA_VERSION,
    metadata: artboard.document.metadata,
    artboards: [artboard],
    activeArtboardId: artboard.id,
  };
}

export function addArtboard(
  project: ProjectDocument,
  params: AddArtboardParams,
): ProjectCommandResult {
  const { artboard } = params;
  if (!artboard?.id) {
    throw new Error('Cannot add artboard: artboard must have an id.');
  }
  if (findArtboardById(project, artboard.id)) {
    throw new Error(`Cannot add artboard: id "${artboard.id}" already exists in the project.`);
  }

  const next = deepClone(project);
  const index = params.index ?? next.artboards.length;
  next.artboards.splice(Math.max(0, Math.min(index, next.artboards.length)), 0, deepClone(artboard));

  if (params.activate !== false) {
    next.activeArtboardId = artboard.id;
  }

  return {
    project: next,
    event: {
      type: 'ARTBOARD_ADDED',
      timestamp: now(),
      artboardId: artboard.id,
      payload: { artboardType: artboard.artboardType, index },
    },
  };
}

export function removeArtboard(
  project: ProjectDocument,
  params: RemoveArtboardParams,
): ProjectCommandResult {
  const { artboardId } = params;
  const existing = findArtboardById(project, artboardId);
  if (!existing) {
    throw new Error(`Cannot remove artboard: id "${artboardId}" not found.`);
  }
  if (project.artboards.length === 1) {
    throw new Error('Cannot remove artboard: a project must keep at least one artboard.');
  }

  const next = deepClone(project);
  next.artboards = next.artboards.filter((artboard) => artboard.id !== artboardId);

  if (next.activeArtboardId === artboardId) {
    next.activeArtboardId = next.artboards[0]?.id;
  }

  return {
    project: next,
    event: {
      type: 'ARTBOARD_REMOVED',
      timestamp: now(),
      artboardId,
      payload: { artboardType: existing.artboardType },
    },
  };
}

export function renameArtboard(
  project: ProjectDocument,
  params: RenameArtboardParams,
): ProjectCommandResult {
  const { artboardId, name } = params;
  if (!name || name.trim().length === 0) {
    throw new Error('Cannot rename artboard: name must be a non-empty string.');
  }
  const existing = findArtboardById(project, artboardId);
  if (!existing) {
    throw new Error(`Cannot rename artboard: id "${artboardId}" not found.`);
  }

  const next = deepClone(project);
  const target = findArtboardById(next, artboardId)!;
  const previousName = target.name;
  target.name = name;

  return {
    project: next,
    event: {
      type: 'ARTBOARD_RENAMED',
      timestamp: now(),
      artboardId,
      payload: { previousName, name },
    },
  };
}

export function setActiveArtboard(
  project: ProjectDocument,
  params: SetActiveArtboardParams,
): ProjectCommandResult {
  const { artboardId } = params;
  if (!findArtboardById(project, artboardId)) {
    throw new Error(`Cannot activate artboard: id "${artboardId}" not found.`);
  }

  const next = deepClone(project);
  const previousArtboardId = next.activeArtboardId;
  next.activeArtboardId = artboardId;

  return {
    project: next,
    event: {
      type: 'ACTIVE_ARTBOARD_CHANGED',
      timestamp: now(),
      artboardId,
      payload: { previousArtboardId },
    },
  };
}

/**
 * Detach a node's subtree into its own component artboard, leaving an
 * `artboard-reference` stub at the original position.
 *
 * The stub matters: selection, move/delete, copy/paste, the Layers panel, and history
 * diffing all walk nodes that are physically present in the tree, so a bare deletion would
 * leave the page with no visible, selectable anchor for "this surface opens artboard X"
 * and would strand the trigger's id with nothing pointing back at it.
 *
 * Undo scoping caveat (Phase 1): the editor's history is per-document, so this operation —
 * which spans two artboards — is applied as one atomic project-level step rather than being
 * finely undoable inside each artboard's own stack.
 */
export function extractNodeToArtboard(
  project: ProjectDocument,
  params: ExtractNodeToArtboardParams,
): ProjectCommandResult {
  const { artboardId, nodeId } = params;

  const sourceArtboard = findArtboardById(project, artboardId);
  if (!sourceArtboard) {
    throw new Error(`Cannot extract node: artboard "${artboardId}" not found.`);
  }
  if (sourceArtboard.document.document.id === nodeId) {
    throw new Error('Cannot extract node: the artboard root cannot be detached.');
  }

  const next = deepClone(project);
  const workingArtboard = findArtboardById(next, artboardId)!;
  const location = findNodeLocation(workingArtboard.document.document, nodeId);
  if (!location || !location.parent) {
    throw new Error(`Cannot extract node: node "${nodeId}" not found in artboard "${artboardId}".`);
  }

  const { node, parent, index } = location as { node: Node; parent: Node; index: number };
  const extracted = deepClone(node);

  const takenNodeIds = collectProjectNodeIds(next);
  const takenArtboardIds = new Set(next.artboards.map((artboard) => artboard.id));

  const newArtboardId = params.newArtboardId ?? `artboard-component-${extracted.id}`;
  if (takenArtboardIds.has(newArtboardId)) {
    throw new Error(`Cannot extract node: artboard id "${newArtboardId}" already exists.`);
  }

  const componentArtboard = createComponentArtboard(extracted, {
    id: newArtboardId,
    name: params.name ?? extracted.type,
    rootId: uniqueId('artboard-root', takenNodeIds),
    viewport: sourceArtboard.viewport,
  });

  // Replace the node in place with a reference stub rather than deleting it outright.
  const stub: Node = {
    id: uniqueId('artboard_ref', takenNodeIds),
    type: ARTBOARD_REFERENCE_NODE_TYPE,
    props: {
      artboardId: componentArtboard.id,
      triggerId: componentArtboard.triggerId,
      label: componentArtboard.name,
    },
    styles: {},
    children: [],
  };
  parent.children = parent.children || [];
  parent.children.splice(index, 1, stub);

  next.artboards.push(componentArtboard);
  if (params.activate) {
    next.activeArtboardId = componentArtboard.id;
  }

  return {
    project: next,
    event: {
      type: 'NODE_EXTRACTED_TO_ARTBOARD',
      timestamp: now(),
      artboardId: componentArtboard.id,
      sourceArtboardId: artboardId,
      nodeId: extracted.id,
      payload: {
        stubNodeId: stub.id,
        triggerId: componentArtboard.triggerId,
        artboardType: 'component' satisfies ArtboardType,
      },
    },
  };
}

/**
 * Replace one artboard's document wholesale. Used by the editor when committing the
 * single active PageDocument it holds back into the project.
 */
export function updateArtboardDocument(
  project: ProjectDocument,
  artboardId: string,
  document: PageDocument,
): ProjectDocument {
  const next = deepClone(project);
  const target = findArtboardById(next, artboardId);
  if (!target) {
    throw new Error(`Cannot update artboard document: id "${artboardId}" not found.`);
  }
  target.document = deepClone(document);
  return next;
}
