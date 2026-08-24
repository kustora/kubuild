import { z } from 'zod';
import { SCHEMA_NAME } from './document';

export const ManifestAssetItemSchema = z.object({
  id: z.string().min(1, 'Asset ID cannot be empty'),
  path: z.string().min(1, 'Asset archive path cannot be empty'),
  mimeType: z.string().min(1, 'MIME type cannot be empty'),
  size: z.number().nonnegative('Asset size must be non-negative'),
  checksum: z.string().optional(),
});

export type ManifestAssetItem = z.infer<typeof ManifestAssetItemSchema>;

export const ManifestSchema = z.object({
  schema: z.literal(SCHEMA_NAME).default(SCHEMA_NAME),
  schemaVersion: z.string().min(1, 'Schema version cannot be empty').default('1.0.0'),
  packageVersion: z.string().min(1, 'Package version cannot be empty').default('1.0.0'),
  builderCompatibility: z.string().default('>=0.1.0'),
  requiredComponents: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  assets: z.array(ManifestAssetItemSchema).default([]),
  createdAt: z.string().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;

export function isManifest(value: unknown): value is Manifest {
  return ManifestSchema.safeParse(value).success;
}
