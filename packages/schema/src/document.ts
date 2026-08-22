import { z } from 'zod';

export const SCHEMA_NAME = 'stora.page' as const;
export const CURRENT_SCHEMA_VERSION = '1.0.0' as const;

/**
 * Asset Reference Schema
 * Represents a reference to an asset stored either locally within the .stora package or hosted externally.
 */
export const AssetReferenceSchema = z.object({
  type: z.literal('asset'),
  assetId: z.string().min(1, 'Asset ID cannot be empty'),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  fallbackUrl: z.string().url().optional(),
});

export type AssetReference = z.infer<typeof AssetReferenceSchema>;

/**
 * Variable Binding Schema
 * Represents a dynamic runtime variable replacement (e.g. {{ site.name }}).
 */
export const VariableBindingSchema = z.object({
  type: z.literal('variable'),
  key: z.string().min(1, 'Variable key cannot be empty'),
  fallback: z.unknown().optional(),
});

export type VariableBinding = z.infer<typeof VariableBindingSchema>;

/**
 * Action Binding Schema
 * Represents an interactive action triggerable by UI components (e.g. navigation, modal, custom event).
 */
export const ActionBindingSchema = z.object({
  type: z.string().min(1, 'Action type cannot be empty'),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type ActionBinding = z.infer<typeof ActionBindingSchema>;

/**
 * Style Definition Schema
 * Key-value mapping of CSS properties or design tokens.
 */
export const StyleValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);
export const StyleDefinitionSchema = z.record(z.string(), z.unknown());
export type StyleDefinition = Record<string, unknown>;

/**
 * Responsive Styles Schema
 * Breakpoint-specific style definitions: base (all viewports), desktop, tablet, and mobile.
 */
export const ResponsiveStylesSchema = z
  .object({
    base: StyleDefinitionSchema.optional(),
    desktop: StyleDefinitionSchema.optional(),
    tablet: StyleDefinitionSchema.optional(),
    mobile: StyleDefinitionSchema.optional(),
  })
  .catchall(StyleDefinitionSchema)
  .default({});

export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

/**
 * Recursive Node Type Definition
 */
export type Node = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: ResponsiveStyles;
  children?: Node[];
};

/**
 * Recursive Node Schema
 * Represents any element/node in the document tree.
 * Node IDs are deterministic, independent of React keys, and unique across the document.
 */
export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({
    id: z.string().min(1, 'Node ID must be a non-empty string'),
    type: z.string().min(1, 'Node type must be a non-empty string'),
    props: z.record(z.string(), z.unknown()).optional().default({}),
    styles: ResponsiveStylesSchema.optional().default({}),
    children: z.array(NodeSchema).optional().default([]),
  }),
);

/**
 * Root Page Node Schema
 * The root node of a PageDocument must be of type 'page'.
 */
export const RootPageNodeSchema = NodeSchema.refine(
  (node) => node.type === 'page',
  {
    message: 'Root node must have type "page"',
    path: ['type'],
  },
);

export type RootPageNode = Node & { type: 'page' };

/**
 * Document Metadata Schema
 * Pure serializable metadata for the document.
 */
export const DocumentMetadataSchema = z.object({
  title: z.string().min(1, 'Title is required').default('Untitled Page'),
  description: z.string().optional().default(''),
  author: z.string().optional().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional().default('general'),
  version: z.string().optional().default('1.0.0'),
  custom: z.record(z.string(), z.unknown()).optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/**
 * Page Document Schema v1
 * Root portable document structure:
 * - schema: strictly "stora.page"
 * - version: schema version string (e.g. "1.0.0")
 * - metadata: serializable metadata
 * - document: root page node
 */
export const PageDocumentSchema = z.object({
  schema: z.literal(SCHEMA_NAME),
  version: z.string().min(1, 'Schema version is required').default(CURRENT_SCHEMA_VERSION),
  metadata: DocumentMetadataSchema.optional().default({
    title: 'Untitled Page',
    description: '',
    author: '',
    tags: [],
    category: 'general',
    version: '1.0.0',
  }),
  document: RootPageNodeSchema,
});

export type PageDocument = {
  schema: typeof SCHEMA_NAME;
  version: string;
  metadata?: DocumentMetadata;
  document: RootPageNode;
};

/**
 * Type guards
 */
export function isAssetReference(value: unknown): value is AssetReference {
  return AssetReferenceSchema.safeParse(value).success;
}

export function isVariableBinding(value: unknown): value is VariableBinding {
  return VariableBindingSchema.safeParse(value).success;
}

export function isActionBinding(value: unknown): value is ActionBinding {
  return ActionBindingSchema.safeParse(value).success;
}

/**
 * Deterministic Node ID Generator
 * Generates predictable IDs based on prefix and an index/identifier (not bound to React keys).
 */
export function generateDeterministicNodeId(prefix: string, indexOrKey: number | string): string {
  const cleanPrefix = prefix.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `${cleanPrefix}_${indexOrKey}`;
}

/**
 * Collect all Node IDs in a node tree
 */
export function collectNodeIds(node: Node): string[] {
  const ids: string[] = [node.id];
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      ids.push(...collectNodeIds(child));
    }
  }
  return ids;
}

/**
 * Validate Node ID uniqueness across a node tree or document
 */
export function validateNodeIdUniqueness(node: Node): { valid: boolean; duplicateIds: string[] } {
  const allIds = collectNodeIds(node);
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of allIds) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return {
    valid: duplicates.size === 0,
    duplicateIds: Array.from(duplicates),
  };
}
