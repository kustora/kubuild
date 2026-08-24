import { z } from 'zod';
import { AssetReferenceSchema, PageDocumentSchema, type AssetReference, type PageDocument } from './document';

/**
 * Regex for screening dangerous URI schemes and payloads in thumbnail URLs.
 * Rejects javascript:, vbscript:, data: URIs that are not images (e.g. data:text/html),
 * and embedded <script> tags.
 */
const DANGEROUS_URI_PATTERN = /^(javascript:|vbscript:|data:(?!image\/))|<script/i;

/**
 * Validates a string as a safe URL or safe asset path.
 */
export function isSafeThumbnailUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  if (DANGEROUS_URI_PATTERN.test(trimmed)) return false;
  return true;
}

/**
 * Safe Thumbnail URL String Schema
 */
export const SafeThumbnailUrlSchema = z.string().min(1, 'Thumbnail URL cannot be empty').refine(
  (url) => isSafeThumbnailUrl(url),
  { message: 'Thumbnail URL contains an unsafe protocol or payload' }
);

/**
 * Safe Thumbnail Object Schema
 */
export const SafeThumbnailObjectSchema = z.object({
  url: SafeThumbnailUrlSchema,
  alt: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

export type SafeThumbnailObject = z.infer<typeof SafeThumbnailObjectSchema>;

/**
 * Safe Thumbnail Schema (AssetReference | safe URL string | safe thumbnail object)
 */
export const SafeThumbnailSchema = z.union([
  AssetReferenceSchema,
  SafeThumbnailObjectSchema,
  SafeThumbnailUrlSchema,
]);

export type SafeThumbnail = AssetReference | SafeThumbnailObject | string;

/**
 * Template Package Reference Schema
 * Points to an external or archived .stora / JSON package file.
 */
export const TemplatePackageRefSchema = z.object({
  path: z.string().optional(),
  url: SafeThumbnailUrlSchema.optional(),
  checksum: z.string().optional(),
  format: z.enum(['stora', 'json']).default('stora'),
});

export type TemplatePackageRef = z.infer<typeof TemplatePackageRefSchema>;

/**
 * Template Requirements Schema
 * Declares custom components and host capabilities required by this template.
 */
export const TemplateRequirementsSchema = z.object({
  requiredComponents: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
});

export type TemplateRequirements = z.infer<typeof TemplateRequirementsSchema>;

/**
 * Template Record Schema v1
 * Represents a reusable page template with full metadata, safe thumbnail,
 * component/capability requirements, and snapshot document / package reference.
 */
export const TemplateRecordSchema = z.object({
  id: z.string().min(1, 'Template ID must be a non-empty string'),
  name: z.string().min(1, 'Template name must be a non-empty string'),
  description: z.string().optional().default(''),
  category: z.string().optional().default('general'),
  tags: z.array(z.string()).optional().default([]),
  thumbnail: SafeThumbnailSchema.optional(),
  author: z.string().optional().default(''),
  version: z.string().optional().default('1.0.0'),
  document: PageDocumentSchema.optional(),
  packageReference: TemplatePackageRefSchema.optional(),
  requirements: TemplateRequirementsSchema.default({
    requiredComponents: [],
    requiredCapabilities: [],
  }),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  custom: z.record(z.string(), z.unknown()).optional(),
});

export type TemplateRecord = z.infer<typeof TemplateRecordSchema>;

/**
 * Type guard for TemplateRecord
 */
export function isTemplateRecord(value: unknown): value is TemplateRecord {
  return TemplateRecordSchema.safeParse(value).success;
}

/**
 * Type guard for SafeThumbnail
 */
export function isSafeThumbnail(value: unknown): value is SafeThumbnail {
  return SafeThumbnailSchema.safeParse(value).success;
}

