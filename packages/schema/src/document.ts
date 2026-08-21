import { z } from 'zod';

export const VariableBindingSchema = z.object({
  type: z.literal('variable'),
  key: z.string().min(1),
  fallback: z.unknown().optional(),
});

export type VariableBinding = z.infer<typeof VariableBindingSchema>;

export const ActionBindingSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export type ActionBinding = z.infer<typeof ActionBindingSchema>;

export const StyleDefinitionSchema = z.record(z.string(), z.unknown()).optional();
export type StyleDefinition = z.infer<typeof StyleDefinitionSchema>;

export const ResponsiveStylesSchema = z
  .object({
    base: StyleDefinitionSchema,
    desktop: StyleDefinitionSchema,
    tablet: StyleDefinitionSchema,
    mobile: StyleDefinitionSchema,
  })
  .partial();

export type ResponsiveStyles = z.infer<typeof ResponsiveStylesSchema>;

// Recursive Node Schema
export type Node = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  styles?: ResponsiveStyles;
  children?: Node[];
};

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()).optional().default({}),
    styles: ResponsiveStylesSchema.optional().default({}),
    children: z.array(NodeSchema).optional().default([]),
  }),
);

export const DocumentMetadataSchema = z.object({
  title: z.string().default('Untitled Page'),
  description: z.string().optional().default(''),
  author: z.string().optional().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().optional().default('general'),
  version: z.string().optional().default('1.0.0'),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const PageDocumentSchema = z.object({
  schema: z.literal('stora.page'),
  version: z.string().min(1).default('1.0.0'),
  metadata: DocumentMetadataSchema.optional().default({
    title: 'Untitled Page',
    description: '',
    author: '',
    tags: [],
    category: 'general',
    version: '1.0.0',
  }),
  document: NodeSchema,
});

export type PageDocument = z.infer<typeof PageDocumentSchema>;
