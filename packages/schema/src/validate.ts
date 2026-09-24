/**
 * `@kubuild/schema/validate` — runtime validators with a zod-free public surface
 * (STORA-552).
 *
 * The implementation uses the package's own (bundled-dependency) zod schemas, but every
 * exported signature is expressed purely in terms of `./types`, so the emitted `.d.ts`
 * never references zod. A host on a different zod major (e.g. a zod v3 backend) can call
 * `validateDocument(json)` and get a plain result object back without any version clash.
 *
 * Keep all zod-typed values local to this module; never export them.
 */
import { NodeSchema, PageDocumentSchema, ProjectDocumentSchema } from './document';
import { ManifestSchema } from './manifest';
import { TemplateRecordSchema } from './template';
import { ThemeSchema } from './theme';
import type {
  Manifest,
  Node,
  PageDocument,
  ProjectDocument,
  SchemaValidationIssue,
  SchemaValidationResult,
  TemplateRecord,
  Theme,
} from './types';

export type { SchemaValidationIssue, SchemaValidationResult } from './types';

interface SafeParser {
  safeParse(input: unknown):
    | { success: true; data: unknown }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string; code: string }> } };
}

function run<T>(schema: SafeParser, input: unknown): SchemaValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data as T, issues: [] };
  }
  const issues: SchemaValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    message: issue.message,
    code: String(issue.code),
  }));
  return { success: false, issues };
}

/**
 * Validates (and normalizes defaults of) a `stora.page` document. Structural schema check
 * only — for component-registry, cycle and security checks use `validateDocument` from
 * `@kubuild/core`.
 */
export function validateDocument(input: unknown): SchemaValidationResult<PageDocument> {
  return run<PageDocument>(PageDocumentSchema as unknown as SafeParser, input);
}

export function validateNode(input: unknown): SchemaValidationResult<Node> {
  return run<Node>(NodeSchema as unknown as SafeParser, input);
}

export function validateProjectDocument(input: unknown): SchemaValidationResult<ProjectDocument> {
  return run<ProjectDocument>(ProjectDocumentSchema as unknown as SafeParser, input);
}

export function validateTemplateRecord(input: unknown): SchemaValidationResult<TemplateRecord> {
  return run<TemplateRecord>(TemplateRecordSchema as unknown as SafeParser, input);
}

export function validateManifest(input: unknown): SchemaValidationResult<Manifest> {
  return run<Manifest>(ManifestSchema as unknown as SafeParser, input);
}

export function validateTheme(input: unknown): SchemaValidationResult<Theme> {
  return run<Theme>(ThemeSchema as unknown as SafeParser, input);
}

/** Boolean shorthand for `validateDocument(input).success`. */
export function isValidPageDocument(input: unknown): input is PageDocument {
  return validateDocument(input).success;
}
