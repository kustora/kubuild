import {
  TemplateRecordSchema,
  collectNodeIds,
  isTemplateRecord,
  type TemplateRecord,
  type TemplateRequirements,
  type PageDocument,
  type Node,
} from '@kubuild/schema';
import { deepClone } from '../document/command-tree-utils';
import { validateDocument } from '../validation/validator';

/**
 * Standard core built-in component types
 */
export const CORE_BUILTIN_COMPONENTS = new Set([
  'page',
  'section',
  'container',
  'columns',
  'column',
  'heading',
  'text',
  'image',
  'button',
  'collection',
]);

/**
 * Structured validation error entry
 */
export interface TemplateValidationError {
  code: string;
  message: string;
  path: string;
}

/**
 * Result of template record validation
 */
export interface TemplateValidationResult {
  valid: boolean;
  data?: TemplateRecord;
  errors?: TemplateValidationError[];
}

/**
 * Validates a template record value against TemplateRecordSchema and returns structured errors.
 */
export function validateTemplate(value: unknown): TemplateValidationResult {
  const parseResult = TemplateRecordSchema.safeParse(value);

  if (parseResult.success) {
    return {
      valid: true,
      data: parseResult.data,
    };
  }

  const errors: TemplateValidationError[] = parseResult.error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: `/${issue.path.join('/')}`,
  }));

  return {
    valid: false,
    errors,
  };
}

/**
 * Helper to recursively collect all component types used in a node tree.
 */
function collectComponentTypes(node: Node, types: Set<string>): void {
  if (node.type) {
    types.add(node.type);
  }
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      collectComponentTypes(child, types);
    }
  }
}

/**
 * Extracts required components and capabilities from a PageDocument.
 * Detects any custom/non-core component types used in the document tree.
 */
export function extractTemplateRequirements(
  doc: PageDocument,
  builtinComponents: Set<string> = CORE_BUILTIN_COMPONENTS
): TemplateRequirements {
  const componentTypes = new Set<string>();
  if (doc?.document) {
    collectComponentTypes(doc.document, componentTypes);
  }

  const customComponents: string[] = [];
  for (const type of componentTypes) {
    if (!builtinComponents.has(type)) {
      customComponents.push(type);
    }
  }

  return {
    requiredComponents: customComponents.sort(),
    requiredCapabilities: [],
  };
}

/**
 * Parameters for creating a TemplateRecord
 */
export interface CreateTemplateParams {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  thumbnail?: TemplateRecord['thumbnail'];
  author?: string;
  version?: string;
  document?: PageDocument;
  packageReference?: TemplateRecord['packageReference'];
  requirements?: TemplateRequirements;
  createdAt?: string;
  updatedAt?: string;
  custom?: Record<string, unknown>;
}

/**
 * Creates and validates a TemplateRecord.
 * Automatically extracts requirements from the embedded document if requirements are not explicitly supplied.
 */
export function createTemplateRecord(params: CreateTemplateParams): TemplateRecord {
  const now = new Date().toISOString();

  let requirements = params.requirements;
  if (!requirements && params.document) {
    requirements = extractTemplateRequirements(params.document);
  }

  const candidate: TemplateRecord = {
    id: params.id,
    name: params.name,
    description: params.description ?? '',
    category: params.category ?? 'general',
    tags: params.tags ?? [],
    thumbnail: params.thumbnail,
    author: params.author ?? '',
    version: params.version ?? '1.0.0',
    document: params.document,
    packageReference: params.packageReference,
    requirements: requirements ?? { requiredComponents: [], requiredCapabilities: [] },
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    custom: params.custom,
  };

  const validation = validateTemplate(candidate);
  if (!validation.valid || !validation.data) {
    const errorDetails = validation.errors?.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid template record: ${errorDetails}`);
  }

  return validation.data;
}

/**
 * Required metadata parameters for saving a draft as a template.
 * id and name are strictly required and non-empty.
 */
export interface SaveTemplateMetadata {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  thumbnail?: TemplateRecord['thumbnail'];
  author?: string;
  version?: string;
  custom?: Record<string, unknown>;
}

export interface SaveDraftAsTemplateOptions {
  validateDraft?: boolean;
  requirements?: TemplateRequirements;
}

/**
 * Exports a draft document snapshot as an immutable reusable TemplateRecord.
 * - Requires mandatory metadata (id, name).
 * - Validates draft document structure.
 * - Extracts component/capability requirements.
 * - Creates a deep-cloned immutable snapshot completely decoupled from the active draft.
 */
export function saveDraftAsTemplate(
  draft: PageDocument,
  metadata: SaveTemplateMetadata,
  options: SaveDraftAsTemplateOptions = {}
): TemplateRecord {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Save as template requires metadata with id and name.');
  }

  const cleanId = metadata.id?.trim();
  if (!cleanId) {
    throw new Error('Template ID is required and cannot be empty.');
  }

  const cleanName = metadata.name?.trim();
  if (!cleanName) {
    throw new Error('Template name is required and cannot be empty.');
  }

  if (!draft || !draft.document) {
    throw new Error('Invalid draft document: document tree is missing.');
  }

  if (options.validateDraft !== false) {
    const validation = validateDocument(draft);
    if (!validation.valid) {
      const errorMsg = validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      throw new Error(`Cannot save invalid draft as template: ${errorMsg}`);
    }
  }

  // Deep clone to guarantee the template snapshot is isolated from future draft edits
  const draftSnapshot: PageDocument = deepClone(draft);

  return createTemplateRecord({
    id: cleanId,
    name: cleanName,
    description: metadata.description?.trim() ?? '',
    category: metadata.category?.trim() ?? 'general',
    tags: metadata.tags ? [...metadata.tags] : [],
    thumbnail: metadata.thumbnail,
    author: metadata.author?.trim() ?? '',
    version: metadata.version?.trim() ?? '1.0.0',
    document: draftSnapshot,
    requirements: options.requirements,
    custom: metadata.custom ? deepClone(metadata.custom) : undefined,
  });
}

/**
 * Options for cloning/instantiating a template into a new page document.
 */
export interface CloneTemplateOptions {
  /**
   * Title for the newly created page document. Defaults to template name or document title.
   */
  title?: string;
  /**
   * Author for the newly created page document.
   */
  author?: string;
  /**
   * Optional custom ID generator function for node duplication.
   */
  idGenerator?: (oldId: string, node: Node) => string;
  /**
   * Custom ID prefix for freshly generated node IDs. Defaults to random string / timestamp.
   */
  idPrefix?: string;
  /**
   * Whether to record origin template metadata in metadata.custom.originTemplate (defaults to true).
   */
  recordOrigin?: boolean;
  /**
   * Additional custom metadata for the new document.
   */
  customMetadata?: Record<string, unknown>;
}

/**
 * Recursively clone a node tree, regenerating 100% fresh unique node IDs for every node
 * including root page node and all descendants, while strictly preserving props and styles.
 */
function cloneTreeWithFreshIds(
  root: Node,
  idGen: (oldId: string, node: Node) => string
): Node {
  function cloneRec(node: Node): Node {
    const newId = idGen(node.id, node);
    const clonedProps = node.props ? deepClone(node.props) : undefined;
    const clonedStyles = node.styles ? deepClone(node.styles) : undefined;
    const clonedChildren = node.children
      ? node.children.map((child) => cloneRec(child))
      : [];

    return {
      id: newId,
      type: node.type,
      ...(clonedProps ? { props: clonedProps } : {}),
      ...(clonedStyles ? { styles: clonedStyles } : {}),
      children: clonedChildren,
    };
  }

  return cloneRec(root);
}

/**
 * Clones a template (or existing document) into a brand new PageDocument.
 * - Generates ALL NEW node IDs across the entire tree (root page node and all children).
 * - Ensures 100% ID difference from the source template.
 * - Sets fresh creation/update timestamps.
 * - Preserves origin template version/id in custom metadata.
 * - Guarantees full memory and reference isolation from the template source.
 */
export function cloneTemplateAsPage(
  templateOrDoc: TemplateRecord | PageDocument,
  options: CloneTemplateOptions = {}
): PageDocument {
  let sourceDoc: PageDocument;
  let templateOrigin: { id: string; name: string; version: string } | null = null;

  if (isTemplateRecord(templateOrDoc)) {
    if (!templateOrDoc.document) {
      throw new Error(
        `Template "${templateOrDoc.name}" (${templateOrDoc.id}) does not contain an inline document snapshot to clone from.`
      );
    }
    sourceDoc = templateOrDoc.document;
    templateOrigin = {
      id: templateOrDoc.id,
      name: templateOrDoc.name,
      version: templateOrDoc.version ?? '1.0.0',
    };
  } else if ('schema' in templateOrDoc && 'document' in templateOrDoc) {
    sourceDoc = templateOrDoc;
  } else {
    throw new Error('Invalid input: expected a TemplateRecord or PageDocument.');
  }

  const existingIdsInSource = new Set(collectNodeIds(sourceDoc.document));
  const assignedNewIds = new Set<string>();

  // Determine unique seed prefix for this clone instance
  const prefix = options.idPrefix || `page_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  let counter = 1;

  const defaultIdGen = (oldId: string, node: Node): string => {
    // Generate an ID that is guaranteed never to match oldId or any existing ID in source
    let candidate = `${node.type}_${prefix}_${counter}`;
    while (existingIdsInSource.has(candidate) || assignedNewIds.has(candidate)) {
      counter++;
      candidate = `${node.type}_${prefix}_${counter}`;
    }
    counter++;
    assignedNewIds.add(candidate);
    return candidate;
  };

  const idGen = options.idGenerator || defaultIdGen;

  const clonedRootNode = cloneTreeWithFreshIds(sourceDoc.document, idGen);

  // Guarantee root node type is 'page'
  const rootPageNode: Node & { type: 'page' } = {
    ...clonedRootNode,
    type: 'page',
  };

  const now = new Date().toISOString();
  const pageTitle =
    options.title ??
    (templateOrigin ? `${templateOrigin.name}` : sourceDoc.metadata?.title ?? 'Untitled Page');

  const customMetadata: Record<string, unknown> = {
    ...(sourceDoc.metadata?.custom ? deepClone(sourceDoc.metadata.custom) : {}),
    ...(options.customMetadata ? deepClone(options.customMetadata) : {}),
  };

  if (options.recordOrigin !== false && templateOrigin) {
    customMetadata.originTemplate = templateOrigin;
  }

  const newDoc: PageDocument = {
    schema: sourceDoc.schema,
    version: sourceDoc.version,
    metadata: {
      title: pageTitle,
      description: sourceDoc.metadata?.description ?? '',
      author: options.author ?? sourceDoc.metadata?.author ?? '',
      tags: sourceDoc.metadata?.tags ? [...sourceDoc.metadata.tags] : [],
      category: sourceDoc.metadata?.category ?? 'general',
      version: '1.0.0',
      createdAt: now,
      updatedAt: now,
      custom: customMetadata,
    },
    document: rootPageNode,
  };

  return newDoc;
}

/**
 * Helper to verify that two PageDocuments share ZERO overlapping node IDs.
 */
export function areNodeIdsCompletelyDistinct(docA: PageDocument, docB: PageDocument): boolean {
  if (!docA?.document || !docB?.document) return true;
  const idsA = new Set(collectNodeIds(docA.document));
  const idsB = collectNodeIds(docB.document);

  for (const id of idsB) {
    if (idsA.has(id)) {
      return false;
    }
  }
  return true;
}
