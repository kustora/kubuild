/**
 * @kubuild/html-import
 * Type definitions and reporting structures for HTML import.
 */

import type {
  AssetReference,
  DocumentMetadata,
  Node,
  PageDocument,
  Theme,
} from '@kubuild/schema';
import type { DocumentSecurityLimits } from '@kubuild/core';

/**
 * Diagnostic codes emitted during HTML import and compilation.
 */
export const HTML_IMPORT_DIAGNOSTIC_CODES = [
  'ELEMENT_DROPPED',
  'ELEMENT_FALLBACK_EMBED',
  'CSS_UNSUPPORTED_SELECTOR',
  'CSS_UNSUPPORTED_PROPERTY',
  'CSS_MEDIA_APPROXIMATED',
  'ASSET_UNRESOLVED',
  'URL_BLOCKED',
  'DEPTH_FLATTENED',
  'LIMIT_EXCEEDED',
] as const;

export type HtmlImportDiagnosticCode = (typeof HTML_IMPORT_DIAGNOSTIC_CODES)[number];

/**
 * Severity level of an HTML import diagnostic.
 */
export type HtmlImportSeverity = 'error' | 'warning' | 'info';

/**
 * Source location or DOM/CSS selector reference for a diagnostic.
 */
export interface HtmlImportDiagnosticLocation {
  line?: number;
  column?: number;
  tagName?: string;
  selector?: string;
  path?: string;
}

/**
 * Diagnostic record representing an issue, adjustment, or security event during HTML import.
 */
export interface HtmlImportDiagnostic {
  /**
   * Structured diagnostic code.
   */
  code: HtmlImportDiagnosticCode;
  /**
   * Diagnostic severity level.
   */
  severity: HtmlImportSeverity;
  /**
   * Human-readable diagnostic message.
   */
  message: string;
  /**
   * Optional source location in the input HTML or CSS.
   */
  location?: HtmlImportDiagnosticLocation;
  /**
   * Optional arbitrary contextual details.
   */
  details?: Record<string, unknown>;
}

/**
 * Quantitative statistics and fidelity score for an HTML import operation.
 */
export interface HtmlImportStats {
  /**
   * Total number of KUBUILD nodes generated.
   */
  nodeCount: number;
  /**
   * Number of elements converted to fallback embeds (e.g. html-embed).
   */
  fallbackCount: number;
  /**
   * Number of elements dropped/sanitized out.
   */
  droppedCount: number;
  /**
   * Computed fidelity score between 0 and 100.
   */
  fidelityScore: number;
  /**
   * Elapsed time in milliseconds for the import operation.
   */
  durationMs?: number;
}

/**
 * Comprehensive report containing all diagnostics and statistics from an import run.
 */
export interface HtmlImportReport {
  diagnostics: HtmlImportDiagnostic[];
  stats: HtmlImportStats;
}

/**
 * Alias for the core PageNode representing elements in the document tree.
 */
export type PageNode = Node;

export type { HtmlMappingContext, HtmlMappingRule } from './rules/types.js';
import type { HtmlMappingRule } from './rules/types.js';

/**
 * Asset descriptor passed to custom asset resolvers.
 */
export interface HtmlImportAssetDescriptor {
  url: string;
  type: 'image' | 'video' | 'font' | 'other';
}

/**
 * Configuration options for HTML import and node compilation.
 */
export interface HtmlImportOptions {
  /**
   * Base URL used to resolve relative URLs for stylesheets, images, and links.
   */
  baseUrl?: string;
  /**
   * Additional CSS stylesheet contents or external stylesheet URLs to apply.
   */
  stylesheets?: string[];
  /**
   * Custom fetch handler for external CSS stylesheets.
   */
  fetchStylesheet?: (url: string) => Promise<string | null> | string | null;
  /**
   * Custom asset resolver to rehost or remap media/font URLs into .stora asset IDs or CDN URLs.
   */
  assetResolver?: (asset: {
    url: string;
    type: 'image' | 'video' | 'font' | 'other';
  }) =>
    | Promise<string | AssetReference | null>
    | string
    | AssetReference
    | null;
  /**
   * Custom element mapping rules extending or overriding default component mappings.
   */
  rules?: HtmlMappingRule[];
  /**
   * Optional set or array of custom component types allowed by the host application.
   */
  allowedComponentTypes?: Set<string> | string[];
  /**
   * Security and document limits (e.g. maxNodeCount, maxDocumentSizeBytes).
   */
  limits?: Partial<DocumentSecurityLimits>;
  /**
   * Metadata overrides for the generated PageDocument.
   */
  metadata?: Partial<DocumentMetadata>;
  /**
   * Optional initial theme tokens to merge with collected fonts and tokens.
   */
  theme?: Partial<Theme>;
  /**
   * Fallback strategy when an unmapped element cannot be natively translated.
   * - 'embed': converts to an html-embed component (preserves visual layout, lower fidelity).
   * - 'drop': drops the element entirely.
   * Default: 'embed'.
   */
  fallback?: 'embed' | 'drop';
  /**
   * Whether to preserve `<button>` elements with navigation links as link components.
   */
  preserveButtonLinks?: boolean;
}

/**
 * Result of importing full HTML document into a PageDocument.
 */
export interface HtmlImportResult {
  success: boolean;
  document?: PageDocument;
  report: HtmlImportReport;
  error?: string;
}

/**
 * Result of importing an HTML fragment into an array of PageNodes.
 */
export interface HtmlNodesResult {
  success: boolean;
  nodes: PageNode[];
  report: HtmlImportReport;
  error?: string;
}

/**
 * Options for exporting imported HTML directly to a .stora package.
 */
export interface HtmlStoraPackageOptions extends HtmlImportOptions {
  packageName?: string;
  assets?: Array<{
    assetId: string;
    data: Uint8Array;
    filename?: string;
    mimeType?: string;
  }>;
}

/**
 * Result of exporting imported HTML directly to a .stora package.
 */
export interface HtmlStoraPackageResult {
  success: boolean;
  packageBuffer?: Uint8Array;
  document?: PageDocument;
  report: HtmlImportReport;
  error?: string;
}

/**
 * Creates an initial empty import report with 0 counts and 100% fidelity score.
 */
export function createEmptyReport(): HtmlImportReport {
  return {
    diagnostics: [],
    stats: {
      nodeCount: 0,
      fallbackCount: 0,
      droppedCount: 0,
      fidelityScore: 100,
    },
  };
}

/**
 * Computes a fidelity score (0–100) based on native node count, fallback count, and dropped count.
 *
 * Scoring logic:
 * - Native nodes (nodeCount - fallbackCount) have full fidelity weight (1.0).
 * - Fallback nodes (fallback embeds) retain partial visual fidelity weight (0.5).
 * - Dropped nodes contribute 0 fidelity weight.
 * - If no nodes or drops are present, returns 100.
 */
export function computeFidelityScore(
  stats: Pick<HtmlImportStats, 'nodeCount' | 'fallbackCount' | 'droppedCount'>,
): number {
  const nodeCount = Math.max(0, stats.nodeCount || 0);
  const fallbackCount = Math.max(0, stats.fallbackCount || 0);
  const droppedCount = Math.max(0, stats.droppedCount || 0);

  const nativeCount = Math.max(0, nodeCount - fallbackCount);
  const total = nativeCount + fallbackCount + droppedCount;

  if (total === 0) {
    return 100;
  }

  const weighted = nativeCount * 1.0 + fallbackCount * 0.5;
  const score = (weighted / total) * 100;

  // Round to one decimal place, bounded between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

/**
 * Adds a diagnostic entry to the report and updates associated stats and fidelity score.
 */
export function addDiagnostic(
  report: HtmlImportReport,
  diagnostic: HtmlImportDiagnostic,
): void {
  report.diagnostics.push(diagnostic);
  if (diagnostic.code === 'ELEMENT_DROPPED') {
    report.stats.droppedCount += 1;
  } else if (diagnostic.code === 'ELEMENT_FALLBACK_EMBED') {
    report.stats.fallbackCount += 1;
  }
  report.stats.fidelityScore = computeFidelityScore(report.stats);
}
