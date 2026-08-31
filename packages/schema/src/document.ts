import { z } from 'zod';
import { ActionPipeline, ActionPipelineSchema } from './actions';
import { FormConfig, FormConfigSchema } from './form';

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
 *
 * Values are restricted to safe, serializable primitives (string, number,
 * boolean, null) — no functions, objects, or arrays — and string values are
 * screened against known CSS/HTML injection vectors (e.g. `url(javascript:...)`,
 * legacy IE `expression()`, `@import`, embedded `<script>` tags).
 */
const DANGEROUS_STYLE_VALUE_PATTERN = /javascript:|expression\(|@import|<script|vbscript:|data:text\/html/i;

export const StyleValueSchema = z.union([
  z.string().refine((value) => !DANGEROUS_STYLE_VALUE_PATTERN.test(value), {
    message: 'Style value contains a disallowed or unsafe pattern',
  }),
  z.number(),
  z.boolean(),
  z.null(),
  z.undefined(),
]);
export const StyleDefinitionSchema = z.record(z.string(), StyleValueSchema);
export type StyleDefinition = Record<string, string | number | boolean | null | undefined>;

/**
 * Pseudo-state style definitions keyed by CSS pseudo-class selector
 * (e.g. `:hover`, `:focus`, `:active`). Each entry is a style layer applied
 * on top of the resolved breakpoint styles when the state is active.
 */
export const PseudoStateStylesSchema = z.record(z.string(), StyleDefinitionSchema);
export type PseudoStateStyles = Record<string, StyleDefinition>;

/**
 * Responsive Styles Schema
 * Breakpoint-specific style definitions: base (all viewports), desktop, tablet, and mobile.
 * Optionally carries `states` — pseudo-class style layers (e.g. `:hover`).
 */
export const ResponsiveStylesSchema = z
  .object({
    base: StyleDefinitionSchema.optional(),
    desktop: StyleDefinitionSchema.optional(),
    tablet: StyleDefinitionSchema.optional(),
    mobile: StyleDefinitionSchema.optional(),
    states: PseudoStateStylesSchema.optional(),
  })
  .passthrough()
  .default({});

export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

/**
 * Animation Configuration Schema
 * Defines scroll entrance animations (AOS), duration, delay, easing curve,
 * trigger behavior (once), hover micro-interactions, and continuous loop effects.
 */
export const AnimationConfigSchema = z.object({
  type: z
    .string()
    .refine((value) => !DANGEROUS_STYLE_VALUE_PATTERN.test(value), {
      message: 'Animation type contains a disallowed or unsafe pattern',
    })
    .optional()
    .default('none'),
  duration: z.number().min(0, 'Duration must be non-negative').optional().default(600),
  delay: z.number().min(0, 'Delay must be non-negative').optional().default(0),
  easing: z
    .string()
    .refine((value) => !DANGEROUS_STYLE_VALUE_PATTERN.test(value), {
      message: 'Animation easing contains a disallowed or unsafe pattern',
    })
    .optional()
    .default('ease-out'),
  once: z.boolean().optional().default(true),
  hoverEffect: z
    .string()
    .refine((value) => !DANGEROUS_STYLE_VALUE_PATTERN.test(value), {
      message: 'Hover effect contains a disallowed or unsafe pattern',
    })
    .optional()
    .default('none'),
  loopEffect: z
    .string()
    .refine((value) => !DANGEROUS_STYLE_VALUE_PATTERN.test(value), {
      message: 'Loop effect contains a disallowed or unsafe pattern',
    })
    .optional()
    .default('none'),
});

export type AnimationConfig = z.infer<typeof AnimationConfigSchema>;

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  type: 'none',
  duration: 600,
  delay: 0,
  easing: 'ease-out',
  once: true,
  hoverEffect: 'none',
  loopEffect: 'none',
};

/**
 * Recursive Node Type Definition
 */
export type Node = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: ResponsiveStyles;
  animation?: AnimationConfig;
  actions?: ActionPipeline[];
  formConfig?: FormConfig;
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
    animation: AnimationConfigSchema.optional(),
    actions: z.array(ActionPipelineSchema).optional(),
    formConfig: FormConfigSchema.optional(),
    children: z.array(NodeSchema).optional().default([]),
  }),
);

export type RootPageNode = Node & { type: 'page' };

/**
 * Root Page Node Schema
 * The root node of a PageDocument must be of type 'page'.
 */
export const RootPageNodeSchema: z.ZodType<RootPageNode> = NodeSchema.refine(
  (node): node is RootPageNode => node.type === 'page',
  {
    message: 'Root node must have type "page"',
    path: ['type'],
  },
);


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
  metadata: DocumentMetadataSchema.optional(),
  document: RootPageNodeSchema,
});

export type PageDocument = z.infer<typeof PageDocumentSchema>;



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

export function isAnimationConfig(value: unknown): value is AnimationConfig {
  return AnimationConfigSchema.safeParse(value).success;
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
