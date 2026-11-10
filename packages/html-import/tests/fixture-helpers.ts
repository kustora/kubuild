/**
 * @kubuild/html-import
 * Shared helpers for the real-world and security fixture suites (STORA-620).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { validateDocumentSecurity } from '@kubuild/core';
import { PageDocumentSchema, type PageDocument } from '@kubuild/schema';
import type { HtmlImportResult, PageNode } from '../src/index.js';

export const FIXTURES_DIR = join(__dirname, 'fixtures');

export function readFixture(group: 'real-world' | 'security', name: string): string {
  return readFileSync(join(FIXTURES_DIR, group, name), 'utf8');
}

/**
 * Executable/injection markers that must never survive into an imported document.
 * Fixture text content is kept free of these words so any hit is a sanitizer leak.
 */
export const DANGEROUS_SUBSTRINGS = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  '<script',
  'onerror=',
  'onload=',
  'onclick=',
  'onmouseover=',
  'srcdoc',
  'formaction',
  'expression(',
  'behavior:',
  '-moz-binding',
  '@import',
  '<object',
  '<embed',
  '<foreignobject',
  'alert(',
] as const;

/** Returns every dangerous marker found in the serialized document (case-insensitive). */
export function findDangerousSubstrings(document: PageDocument): string[] {
  const serialized = JSON.stringify(document).toLowerCase();
  return DANGEROUS_SUBSTRINGS.filter((marker) => serialized.includes(marker));
}

/** Asserts a successful import is schema-valid, passes core security and carries no XSS markers. */
export function expectSafeDocument(result: HtmlImportResult): PageDocument {
  expect(result.success, result.error).toBe(true);
  const document = result.document!;
  expect(document).toBeDefined();
  expect(PageDocumentSchema.safeParse(document).success).toBe(true);
  const security = validateDocumentSecurity(document);
  expect(security.errors).toEqual([]);
  expect(security.safe).toBe(true);
  expect(findDangerousSubstrings(document)).toEqual([]);
  return document;
}

export function walkNodes(
  node: PageNode,
  visit: (node: PageNode, depth: number) => void,
  depth = 1,
) {
  visit(node, depth);
  for (const child of node.children ?? []) walkNodes(child, visit, depth + 1);
}

export function maxTreeDepth(document: PageDocument): number {
  let max = 0;
  walkNodes(document.document as PageNode, (_node, depth) => {
    if (depth > max) max = depth;
  });
  return max;
}

/** Diagnostic count per code, sorted by code for stable snapshots. */
export function diagnosticCounts(result: HtmlImportResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const diagnostic of result.report.diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

/** Node type histogram, sorted by type for stable snapshots. */
export function nodeTypeHistogram(document: PageDocument): Record<string, number> {
  const counts: Record<string, number> = {};
  walkNodes(document.document as PageNode, (node) => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  });
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

/** Stable, timing-free summary of an import result for snapshots. */
export function summarizeImport(result: HtmlImportResult) {
  const stats = { ...result.report.stats };
  delete stats.durationMs;
  return {
    success: result.success,
    stats,
    maxTreeDepth: result.document ? maxTreeDepth(result.document) : 0,
    diagnostics: diagnosticCounts(result),
    nodeTypes: result.document ? nodeTypeHistogram(result.document) : {},
  };
}
