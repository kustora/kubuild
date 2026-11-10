/**
 * @kubuild/html-import
 * Final validation for compiled PageDocument against PageDocumentSchema and DocumentSecurityLimits.
 */

import {
  CURRENT_SCHEMA_VERSION,
  PageDocumentSchema,
  SCHEMA_NAME,
  type DocumentMetadata,
  type PageDocument,
  type Theme,
} from '@kubuild/schema';
import {
  validateDocumentSecurity,
  type DocumentSecurityLimits,
} from '@kubuild/core';
import {
  addDiagnostic,
  type HtmlImportDiagnosticCode,
  type HtmlImportReport,
  type PageNode,
} from './types.js';

/**
 * Parameters for assembling a PageDocument.
 */
export interface AssemblePageDocumentParams {
  rootNode: PageNode & { type: 'page' };
  title?: string;
  description?: string;
  metadata?: Partial<DocumentMetadata>;
  theme?: Theme;
}

/**
 * Result of validating an assembled PageDocument.
 */
export interface DocumentValidationResult {
  valid: boolean;
  document?: PageDocument;
  errors: string[];
}

/**
 * Assembles a valid KUBUILD PageDocument structure from a root page node and metadata.
 *
 * @param params Root node, metadata, and optional theme tokens
 * @returns Assembled PageDocument
 */
export function assemblePageDocument(params: AssemblePageDocumentParams): PageDocument {
  const { rootNode, title = 'Untitled Page', description = '', metadata, theme } = params;
  const now = new Date().toISOString();

  return {
    schema: SCHEMA_NAME,
    version: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: metadata?.title ?? title,
      description: metadata?.description ?? description,
      author: metadata?.author ?? '',
      tags: metadata?.tags ?? [],
      category: metadata?.category ?? 'general',
      version: metadata?.version ?? '1.0.0',
      createdAt: metadata?.createdAt ?? now,
      updatedAt: metadata?.updatedAt ?? now,
      ...(metadata?.custom ? { custom: metadata.custom } : {}),
      ...(metadata?.tracking ? { tracking: metadata.tracking } : {}),
    },
    ...(theme ? { theme } : {}),
    document: rootNode,
  };
}

/**
 * Performs final validation of an assembled document against both PageDocumentSchema
 * and validateDocumentSecurity limits.
 *
 * Both schema conformity and security bounds must pass. If either fails,
 * structured diagnostics are recorded in the report, errors are collected,
 * and valid is set to false.
 *
 * @param doc The candidate document to validate
 * @param limits Security and size limits
 * @param report Optional HtmlImportReport to record diagnostics into
 * @returns DocumentValidationResult containing validation status, errors, and typed document if valid
 */
export function validatePageDocument(
  doc: unknown,
  limits?: Partial<DocumentSecurityLimits>,
  report?: HtmlImportReport,
): DocumentValidationResult {
  const errors: string[] = [];

  // 1. Zod Schema Validation
  const schemaResult = PageDocumentSchema.safeParse(doc);
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      const pathStr = issue.path.length > 0 ? issue.path.join('.') : 'root';
      const msg = `Schema validation failed at "${pathStr}": ${issue.message}`;
      errors.push(msg);
      if (report) {
        addDiagnostic(report, {
          code: 'LIMIT_EXCEEDED',
          severity: 'error',
          message: msg,
          location: { path: pathStr },
          details: {
            zodCode: issue.code,
            path: issue.path,
            issue,
          },
        });
      }
    }
  }

  // 2. Security Limits Validation via @kubuild/core
  const securityResult = validateDocumentSecurity(doc, limits);
  if (!securityResult.safe) {
    for (const violation of securityResult.errors) {
      const pathStr = violation.path || 'document';
      const msg = `Security violation [${violation.code}] at "${pathStr}": ${violation.message}`;
      errors.push(msg);
      if (report) {
        const diagCode: HtmlImportDiagnosticCode =
          violation.code === 'UNSAFE_URL_DETECTED' ? 'URL_BLOCKED' : 'LIMIT_EXCEEDED';
        addDiagnostic(report, {
          code: diagCode,
          severity: 'error',
          message: msg,
          location: { path: pathStr },
          details: {
            securityCode: violation.code,
            violationDetails: violation.details,
          },
        });
      }
    }
  }

  if (!schemaResult.success || !securityResult.safe) {
    return {
      valid: false,
      document: undefined,
      errors,
    };
  }

  return {
    valid: true,
    document: schemaResult.data as PageDocument,
    errors: [],
  };
}
