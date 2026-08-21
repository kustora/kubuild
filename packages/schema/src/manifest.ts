import { z } from 'zod';

export const ManifestAssetItemSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().nonnegative(),
  checksum: z.string().optional(),
});

export type ManifestAssetItem = z.infer<typeof ManifestAssetItemSchema>;

export const ManifestSchema = z.object({
  schemaVersion: z.string().min(1).default('1.0.0'),
  packageVersion: z.string().min(1).default('1.0.0'),
  builderCompatibility: z.string().default('>=0.1.0'),
  requiredComponents: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  assets: z.array(ManifestAssetItemSchema).default([]),
  createdAt: z.string().optional(),
});

export type Manifest = z.infer<typeof ManifestSchema>;
