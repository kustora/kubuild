/**
 * @kubuild/html-import
 * Static HTML to KUBUILD PageDocument importer and compiler
 */

import { parse, parseFragment } from 'parse5';
import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_NAME,
  type PageDocument,
} from '@kubuild/schema';
import { DEFAULT_DOCUMENT_SECURITY_LIMITS } from '@kubuild/core';
import {
  addDiagnostic,
  computeFidelityScore,
  createEmptyReport,
  type HtmlImportOptions,
  type HtmlImportResult,
  type HtmlNodesResult,
  type PageNode,
} from './types.js';

export const HTML_IMPORT_VERSION = '0.1.0';

export * from './types.js';

/**
 * Maximum document size in bytes if not specified in options.
 */
const DEFAULT_MAX_DOCUMENT_SIZE_BYTES =
  DEFAULT_DOCUMENT_SECURITY_LIMITS.maxDocumentSizeBytes ?? 10 * 1024 * 1024;

/**
 * Imports an untrusted HTML string (document or fragment) and compiles it into a valid KUBUILD PageDocument.
 *
 * This function is guaranteed never to throw; unexpected errors or malformed input
 * return a structured result with `success: false` and diagnostics in `report`.
 *
 * @param html The HTML string to import
 * @param options Import configuration options including security limits and metadata
 * @returns Promise resolving to an HtmlImportResult
 */
export async function importHtml(
  html: string,
  options?: HtmlImportOptions,
): Promise<HtmlImportResult> {
  const startTime = Date.now();
  const report = createEmptyReport();

  try {
    if (typeof html !== 'string') {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: 'HTML input must be a string',
      });
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        report,
        error: 'HTML input must be a string',
      };
    }

    const maxSizeBytes =
      options?.limits?.maxDocumentSizeBytes ?? DEFAULT_MAX_DOCUMENT_SIZE_BYTES;
    const inputByteLength = new TextEncoder().encode(html).length;

    if (inputByteLength > maxSizeBytes) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: `HTML input size (${inputByteLength} bytes) exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        details: { size: inputByteLength, limit: maxSizeBytes },
      });
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        report,
        error: `Input size limit exceeded: ${inputByteLength} bytes exceeds limit of ${maxSizeBytes} bytes`,
      };
    }

    // Parse HTML with parse5 (spec-compliant HTML5 parser)
    parse(html);

    const title = options?.metadata?.title ?? 'Untitled Page';
    const rootPageNode: PageNode & { type: 'page' } = {
      id: 'root-page',
      type: 'page',
      props: { title },
      styles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
      children: [],
    };

    const document: PageDocument = {
      schema: SCHEMA_NAME,
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        title,
        description: options?.metadata?.description ?? '',
        author: options?.metadata?.author ?? '',
        tags: options?.metadata?.tags ?? [],
        category: options?.metadata?.category ?? 'general',
        version: options?.metadata?.version ?? '1.0.0',
        createdAt: options?.metadata?.createdAt ?? new Date().toISOString(),
        updatedAt: options?.metadata?.updatedAt ?? new Date().toISOString(),
        ...(options?.metadata?.custom ? { custom: options.metadata.custom } : {}),
        ...(options?.metadata?.tracking ? { tracking: options.metadata.tracking } : {}),
      },
      document: rootPageNode,
    };

    const nodeCount = 1; // root page node
    const maxNodeCount =
      options?.limits?.maxNodeCount ?? DEFAULT_DOCUMENT_SECURITY_LIMITS.maxNodeCount;
    if (maxNodeCount !== undefined && nodeCount > maxNodeCount) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: `Document node count (${nodeCount}) exceeds maximum allowed node count (${maxNodeCount})`,
        details: { count: nodeCount, limit: maxNodeCount },
      });
      report.stats.nodeCount = nodeCount;
      report.stats.fidelityScore = computeFidelityScore(report.stats);
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        report,
        error: `Node count limit exceeded: ${nodeCount} exceeds limit of ${maxNodeCount}`,
      };
    }

    report.stats.nodeCount = nodeCount;
    report.stats.fidelityScore = computeFidelityScore(report.stats);
    report.stats.durationMs = Date.now() - startTime;

    return {
      success: true,
      document,
      report,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.stats.durationMs = Date.now() - startTime;
    return {
      success: false,
      report,
      error: message,
    };
  }
}

/**
 * Imports an untrusted HTML fragment and compiles it into an array of KUBUILD PageNodes.
 *
 * This function is guaranteed never to throw; unexpected errors or malformed input
 * return a structured result with `success: false` and diagnostics in `report`.
 *
 * @param html The HTML fragment string to import
 * @param options Import configuration options
 * @returns Promise resolving to an HtmlNodesResult
 */
export async function htmlToNodes(
  html: string,
  options?: HtmlImportOptions,
): Promise<HtmlNodesResult> {
  const startTime = Date.now();
  const report = createEmptyReport();

  try {
    if (typeof html !== 'string') {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: 'HTML input must be a string',
      });
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        nodes: [],
        report,
        error: 'HTML input must be a string',
      };
    }

    const maxSizeBytes =
      options?.limits?.maxDocumentSizeBytes ?? DEFAULT_MAX_DOCUMENT_SIZE_BYTES;
    const inputByteLength = new TextEncoder().encode(html).length;

    if (inputByteLength > maxSizeBytes) {
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: `HTML input size (${inputByteLength} bytes) exceeds maximum allowed size of ${maxSizeBytes} bytes`,
        details: { size: inputByteLength, limit: maxSizeBytes },
      });
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        nodes: [],
        report,
        error: `Input size limit exceeded: ${inputByteLength} bytes exceeds limit of ${maxSizeBytes} bytes`,
      };
    }

    // Parse fragment with parse5
    parseFragment(html);

    // Baseline Phase H0: returns empty nodes array (populated in subsequent phases)
    const nodes: PageNode[] = [];

    report.stats.nodeCount = nodes.length;
    report.stats.fidelityScore = computeFidelityScore(report.stats);
    report.stats.durationMs = Date.now() - startTime;

    return {
      success: true,
      nodes,
      report,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.stats.durationMs = Date.now() - startTime;
    return {
      success: false,
      nodes: [],
      report,
      error: message,
    };
  }
}
