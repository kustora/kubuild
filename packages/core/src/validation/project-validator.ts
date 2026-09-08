import {
  Artboard,
  Node,
  ProjectDocument,
  ProjectDocumentSchema,
  PROJECT_SCHEMA_NAME,
  ARTBOARD_REFERENCE_NODE_TYPE,
} from '@kubuild/schema';
import {
  DocumentValidationError,
  ValidationOptions,
  validateDocument,
} from './validator';

export type ProjectValidationErrorCode =
  | 'PROJECT_SCHEMA_INVALID'
  | 'DUPLICATE_ARTBOARD_ID'
  | 'DUPLICATE_NODE_ID_ACROSS_ARTBOARDS'
  | 'DANGLING_ARTBOARD_REFERENCE'
  | 'DUPLICATE_TRIGGER_ID'
  | 'INVALID_ACTIVE_ARTBOARD'
  | 'ARTBOARD_DOCUMENT_INVALID';

export interface ProjectValidationError {
  code: ProjectValidationErrorCode;
  message: string;
  path: string;
  artboardId?: string;
  nodeId?: string;
  details?: Record<string, unknown>;
}

export interface ProjectValidationResult {
  valid: boolean;
  success: boolean;
  errors: ProjectValidationError[];
  /** Per-artboard results from the existing single-document validator. */
  artboardErrors: Record<string, DocumentValidationError[]>;
  data?: ProjectDocument;
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of node.children ?? []) {
    walk(child, visit);
  }
}

function collectArtboardReferences(artboard: Artboard): Array<{ nodeId: string; artboardId?: string }> {
  const refs: Array<{ nodeId: string; artboardId?: string }> = [];
  walk(artboard.document.document, (node) => {
    if (node.type === ARTBOARD_REFERENCE_NODE_TYPE) {
      const target = node.props?.artboardId;
      refs.push({
        nodeId: node.id,
        artboardId: typeof target === 'string' ? target : undefined,
      });
    }
  });
  return refs;
}

/**
 * Validate a multi-artboard project.
 *
 * Each artboard's document is handed to the existing `validateDocument` unchanged; this
 * function only adds the checks that cannot exist at single-document scope:
 * artboard-id uniqueness, node-id uniqueness *across* artboards (so content moved between
 * artboards can't silently collide), duplicate component trigger ids, and reference stubs
 * that point at an artboard which no longer exists.
 */
export function validateProject(
  input: unknown,
  options: ValidationOptions = {},
): ProjectValidationResult {
  const errors: ProjectValidationError[] = [];
  const artboardErrors: Record<string, DocumentValidationError[]> = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      success: false,
      errors: [
        {
          code: 'PROJECT_SCHEMA_INVALID',
          message: 'Project must be a valid non-null object',
          path: '',
        },
      ],
      artboardErrors,
    };
  }

  const parsed = ProjectDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      success: false,
      errors: [
        {
          code: 'PROJECT_SCHEMA_INVALID',
          message: `Project failed schema validation. Expected schema "${PROJECT_SCHEMA_NAME}".`,
          path: '',
          details: { issues: parsed.error.issues },
        },
      ],
      artboardErrors,
    };
  }

  const project = parsed.data;

  // 1. Artboard id uniqueness
  const seenArtboardIds = new Set<string>();
  for (const artboard of project.artboards) {
    if (seenArtboardIds.has(artboard.id)) {
      errors.push({
        code: 'DUPLICATE_ARTBOARD_ID',
        message: `Duplicate artboard id "${artboard.id}"`,
        path: '/artboards',
        artboardId: artboard.id,
      });
    }
    seenArtboardIds.add(artboard.id);
  }

  // 2. Active artboard must resolve
  if (project.activeArtboardId && !seenArtboardIds.has(project.activeArtboardId)) {
    errors.push({
      code: 'INVALID_ACTIVE_ARTBOARD',
      message: `activeArtboardId "${project.activeArtboardId}" does not match any artboard`,
      path: '/activeArtboardId',
    });
  }

  // 3. Per-artboard document validation, reusing the existing single-document validator
  const nodeIdOwner = new Map<string, string>();
  for (const artboard of project.artboards) {
    const result = validateDocument(artboard.document, options);
    if (!result.valid) {
      artboardErrors[artboard.id] = result.errors;
      errors.push({
        code: 'ARTBOARD_DOCUMENT_INVALID',
        message: `Artboard "${artboard.id}" has ${result.errors.length} document validation error(s)`,
        path: `/artboards/${artboard.id}/document`,
        artboardId: artboard.id,
      });
    }

    // 4. Node id uniqueness across artboards
    walk(artboard.document.document, (node) => {
      const owner = nodeIdOwner.get(node.id);
      if (owner && owner !== artboard.id) {
        errors.push({
          code: 'DUPLICATE_NODE_ID_ACROSS_ARTBOARDS',
          message: `Node id "${node.id}" appears in both artboard "${owner}" and "${artboard.id}"`,
          path: `/artboards/${artboard.id}/document`,
          artboardId: artboard.id,
          nodeId: node.id,
        });
      } else if (!owner) {
        nodeIdOwner.set(node.id, artboard.id);
      }
    });
  }

  // 5. Duplicate trigger ids among component artboards (would make open_modal ambiguous)
  const seenTriggerIds = new Set<string>();
  for (const artboard of project.artboards) {
    if (artboard.artboardType !== 'component' || !artboard.triggerId) continue;
    if (seenTriggerIds.has(artboard.triggerId)) {
      errors.push({
        code: 'DUPLICATE_TRIGGER_ID',
        message: `Duplicate component triggerId "${artboard.triggerId}" — open_modal targets would be ambiguous`,
        path: `/artboards/${artboard.id}/triggerId`,
        artboardId: artboard.id,
      });
    }
    seenTriggerIds.add(artboard.triggerId);
  }

  // 6. Reference stubs must point at an existing artboard
  for (const artboard of project.artboards) {
    for (const ref of collectArtboardReferences(artboard)) {
      if (!ref.artboardId || !seenArtboardIds.has(ref.artboardId)) {
        errors.push({
          code: 'DANGLING_ARTBOARD_REFERENCE',
          message: `Node "${ref.nodeId}" references artboard "${String(ref.artboardId)}" which does not exist`,
          path: `/artboards/${artboard.id}/document`,
          artboardId: artboard.id,
          nodeId: ref.nodeId,
        });
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    success: valid,
    errors,
    artboardErrors,
    data: valid ? project : undefined,
  };
}

/**
 * Collect artboard-reference stubs in a single page document. Used by the exporter guard
 * to refuse silently-incomplete single-page exports.
 */
export function collectArtboardReferenceNodes(root: Node): Array<{ nodeId: string; artboardId?: string }> {
  const refs: Array<{ nodeId: string; artboardId?: string }> = [];
  walk(root, (node) => {
    if (node.type === ARTBOARD_REFERENCE_NODE_TYPE) {
      const target = node.props?.artboardId;
      refs.push({ nodeId: node.id, artboardId: typeof target === 'string' ? target : undefined });
    }
  });
  return refs;
}
