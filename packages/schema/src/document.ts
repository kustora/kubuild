import { z } from 'zod';
import { ActionPipeline, ActionPipelineSchema } from './actions';
import { FormConfig, FormConfigSchema } from './form';
import { TrackingConfig, TrackingConfigSchema } from './tracking';
import { ThemeSchema } from './theme';

export const SCHEMA_NAME = 'stora.page' as const;
export const CURRENT_SCHEMA_VERSION = '1.2.0' as const;

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

export type StyleValue = z.infer<typeof StyleValueSchema>;

/**
 * Standard CSS style definition supporting Flexbox (STORA-101), Sizing constraints (STORA-101),
 * Effects & rounded corners (STORA-101), CSS Grid (STORA-110), and arbitrary CSS properties/tokens.
 */
export interface StyleDefinition extends Record<string, StyleValue> {
  // Display
  display?: string;

  // Flexbox / Auto Layout (STORA-101)
  flexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse' | (string & {});
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse' | (string & {});
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | 'start'
    | 'end'
    | 'left'
    | 'right'
    | (string & {});
  alignItems?:
    | 'stretch'
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'baseline'
    | 'start'
    | 'end'
    | 'self-start'
    | 'self-end'
    | (string & {});
  alignContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly'
    | 'stretch'
    | 'start'
    | 'end'
    | (string & {});
  gap?: string | number;
  rowGap?: string | number;
  columnGap?: string | number;
  flexGrow?: number | string;
  flexShrink?: number | string;
  flexBasis?: string | number;
  alignSelf?:
    | 'auto'
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'baseline'
    | 'stretch'
    | (string & {});

  // Sizing constraints (STORA-101)
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;

  // Replaced-element fitting — how an image/video fills its own box. Portable and
  // per-breakpoint overridable like any other style property.
  objectFit?: 'fill' | 'contain' | 'cover' | 'none' | 'scale-down' | (string & {});
  objectPosition?: string;

  // Effects & Rounded Corners (STORA-101)
  borderRadius?: string | number;
  borderTopLeftRadius?: string | number;
  borderTopRightRadius?: string | number;
  borderBottomRightRadius?: string | number;
  borderBottomLeftRadius?: string | number;
  backdropFilter?: string;
  filter?: string;
  boxShadow?: string;

  // Background & Image Styling
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto' | (string & {});
  backgroundPosition?: string;
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y' | (string & {});
  backgroundAttachment?: 'scroll' | 'fixed' | 'local' | (string & {});

  // CSS Grid (STORA-110)
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridAutoFlow?: string;
  gridAutoColumns?: string;
  gridAutoRows?: string;
  gridColumn?: string | number;
  gridRow?: string | number;
  gridColumnStart?: string | number;
  gridColumnEnd?: string | number;
  gridRowStart?: string | number;
  gridRowEnd?: string | number;
  colSpan?: number | string;
  rowSpan?: number | string;
  justifySelf?: string;
}

export const StyleDefinitionSchema: z.ZodType<StyleDefinition> = z.record(z.string(), StyleValueSchema);

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
  tracking: TrackingConfigSchema.optional(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/**
 * Page Document Schema v1
 * Root portable document structure:
 * - schema: strictly "stora.page"
 * - version: schema version string (e.g. "1.0.0")
 * - metadata: serializable metadata
 * - document: root page node
 * - tracking: optional dynamic pixel & CAPI tracking configuration
 * - theme: optional design tokens (colors/fonts/radii/spacing), emitted as CSS custom
 *   properties and referenced from node styles as `var(--kb-color-<key>)` (STORA-551)
 */
export const PageDocumentSchema = z.object({
  schema: z.literal(SCHEMA_NAME),
  version: z.string().min(1, 'Schema version is required').default(CURRENT_SCHEMA_VERSION),
  metadata: DocumentMetadataSchema.optional(),
  tracking: TrackingConfigSchema.optional(),
  theme: ThemeSchema.optional(),
  document: RootPageNodeSchema,
});

export type PageDocument = z.infer<typeof PageDocumentSchema>;

export const PROJECT_SCHEMA_NAME = 'stora.project' as const;
export const CURRENT_PROJECT_SCHEMA_VERSION = '1.0.0' as const;

/**
 * Node type used as the in-tree placeholder left behind when a subtree is detached
 * into its own artboard. It carries no children — the real content lives in the
 * artboard named by `props.artboardId`.
 */
export const ARTBOARD_REFERENCE_NODE_TYPE = 'artboard-reference' as const;

/**
 * Artboard Type Schema
 * - 'page': a routable page surface (has a slug)
 * - 'component': a detached surface rendered as an overlay/portal at runtime
 *   (modal, drawer, collapsible, or any block the author detached), reached by `triggerId`
 */
export const ArtboardTypeSchema = z.enum(['page', 'component']);

export type ArtboardType = z.infer<typeof ArtboardTypeSchema>;

/**
 * Artboard Schema
 * One top-level surface on the builder canvas. Each artboard embeds a complete
 * PageDocument so that every existing document command, tree utility, validator,
 * and history engine keeps operating on exactly the shape it already understands.
 *
 * Component artboards always wrap their detached node as the sole child of a
 * synthetic `type: 'page'` root, so the root-type constraint never has to be relaxed.
 */
export const ArtboardSchema = z.object({
  id: z.string().min(1, 'Artboard ID is required'),
  name: z.string().min(1, 'Artboard name is required'),
  artboardType: ArtboardTypeSchema,
  /** Route for page artboards (e.g. "/about"). */
  slug: z.string().optional(),
  /**
   * For component artboards: the id that `open_modal` / `close_modal` actions target.
   * Mirrors the detached node's own `props.modalId` so ModalManager keeps working unchanged.
   */
  triggerId: z.string().optional(),
  /**
   * Viewport/breakpoint this artboard is currently authored at. Declared inline
   * (rather than imported) because viewport is otherwise an editor/renderer concept.
   */
  viewport: z.enum(['desktop', 'tablet', 'mobile']).optional(),
  /** Persisted artboard width in px, matching the canvas ViewportResizer's `width`. */
  width: z.number().positive().optional(),
  /**
   * Free position on the builder's infinite canvas, in unscaled canvas px. Absent means
   * "not placed yet" — the canvas then falls back to laying the artboard out in a row.
   */
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  document: PageDocumentSchema,
});

export type Artboard = z.infer<typeof ArtboardSchema>;

/**
 * Project Document Schema
 * Root portable structure holding many artboards:
 * - schema: strictly "stora.project" (distinct from the single-page "stora.page")
 * - version: project schema version string
 * - metadata: serializable metadata
 * - artboards: one or more page/component surfaces
 * - activeArtboardId: which artboard the editor should open
 */
export const ProjectDocumentSchema = z.object({
  schema: z.literal(PROJECT_SCHEMA_NAME),
  version: z.string().min(1, 'Schema version is required').default(CURRENT_PROJECT_SCHEMA_VERSION),
  metadata: DocumentMetadataSchema.optional(),
  tracking: TrackingConfigSchema.optional(),
  artboards: z.array(ArtboardSchema).min(1, 'A project needs at least one artboard'),
  activeArtboardId: z.string().optional(),
});

export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;

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

export function isProjectDocument(value: unknown): value is ProjectDocument {
  return ProjectDocumentSchema.safeParse(value).success;
}

/**
 * Cheap structural sniff used by the loader to route a raw payload to either the
 * project pipeline or the legacy single-page pipeline, before any parsing happens.
 * Intentionally does not validate — a malformed project must still be routed to the
 * project parser so its own errors surface, rather than being silently treated as a page.
 */
export function looksLikeProjectDocument(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { schema?: unknown; artboards?: unknown };
  return candidate.schema === PROJECT_SCHEMA_NAME || Array.isArray(candidate.artboards);
}

/**
 * Node type guard for the in-tree placeholder that points at a detached artboard.
 */
export function isArtboardReferenceNode(node: Node): boolean {
  return node.type === ARTBOARD_REFERENCE_NODE_TYPE;
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
