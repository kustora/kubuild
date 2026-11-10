/**
 * @kubuild/html-import
 * Static HTML to KUBUILD PageDocument importer and compiler
 */

import {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_NAME,
  type PageDocument,
  type ResponsiveStyles,
} from '@kubuild/schema';
import {
  computeFidelityScore,
  createEmptyReport,
  type HtmlImportOptions,
  type HtmlImportResult,
  type HtmlNodesResult,
  type PageNode,
} from './types.js';
import { parseHtml } from './parser.js';
import { sanitizeAst } from './sanitizer.js';
import { collectAndParseStylesheets } from './stylesheet.js';
import { computeElementStyles } from './cascade.js';
import { buildResponsiveStyles } from './responsive.js';
import { createRuleRegistry } from './rules/index.js';
import { countTotalNodes, normalizeNodeTree } from './normalizer.js';

export const HTML_IMPORT_VERSION = '0.1.0';

export * from './types.js';
export * from './parser.js';
export * from './sanitizer.js';
export * from './stylesheet.js';
export * from './cascade.js';
export * from './responsive.js';
export * from './rules/index.js';
export * from './normalizer.js';

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
    const parseResult = parseHtml(html, options, report);
    if (!parseResult.success) {
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        report,
        error: parseResult.error,
      };
    }

    if (parseResult.rootElement) {
      sanitizeAst(parseResult.rootElement, report, options);
    }

    const bundle = await collectAndParseStylesheets(parseResult.parsed!, options, report);

    const registry = createRuleRegistry(undefined, {
      allowedCustomTypes: options?.allowedComponentTypes,
    });
    if (options?.rules && options.rules.length > 0) {
      registry.registerMany(options.rules);
    }

    const context = registry.createContext(options, {
      report,
      bundle,
    });

    const targetContainer = parseResult.bodyElement ?? parseResult.rootElement;
    const childrenNodes: PageNode[] = targetContainer
      ? registry.convertChildren(targetContainer, context)
      : [];

    const title = options?.metadata?.title ?? parseResult.title ?? 'Untitled Page';
    const description = options?.metadata?.description ?? parseResult.description ?? '';

    let rootStyles: ResponsiveStyles = {
      base: { minHeight: '100vh', backgroundColor: '#ffffff' },
    };
    if (parseResult.bodyElement) {
      const bodyComputed = computeElementStyles(parseResult.bodyElement, bundle, undefined, report);
      const bodyResponsive = buildResponsiveStyles(bodyComputed, report);
      rootStyles = {
        ...bodyResponsive,
        base: {
          minHeight: '100vh',
          backgroundColor: '#ffffff',
          ...(bodyResponsive.base ?? {}),
        },
      };
    }

    const rootPageNode: PageNode & { type: 'page' } = {
      id: 'root-page',
      type: 'page',
      props: { title },
      styles: rootStyles,
      children: childrenNodes,
    };

    const normalizedNodes = normalizeNodeTree([rootPageNode], options, report);
    const normalizedRoot = (normalizedNodes[0] ?? rootPageNode) as PageNode & { type: 'page' };

    const document: PageDocument = {
      schema: SCHEMA_NAME,
      version: CURRENT_SCHEMA_VERSION,
      metadata: {
        title,
        description,
        author: options?.metadata?.author ?? '',
        tags: options?.metadata?.tags ?? [],
        category: options?.metadata?.category ?? 'general',
        version: options?.metadata?.version ?? '1.0.0',
        createdAt: options?.metadata?.createdAt ?? new Date().toISOString(),
        updatedAt: options?.metadata?.updatedAt ?? new Date().toISOString(),
        ...(options?.metadata?.custom ? { custom: options.metadata.custom } : {}),
        ...(options?.metadata?.tracking ? { tracking: options.metadata.tracking } : {}),
      },
      document: normalizedRoot,
    };

    const nodeCount = countTotalNodes([normalizedRoot]);
    const maxNodeCount =
      options?.limits?.maxNodeCount ?? 1000;
    if (maxNodeCount !== undefined && nodeCount > maxNodeCount) {
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
    const parseResult = parseHtml(html, options, report);
    if (!parseResult.success) {
      report.stats.durationMs = Date.now() - startTime;
      return {
        success: false,
        nodes: [],
        report,
        error: parseResult.error,
      };
    }

    if (parseResult.rootElement) {
      sanitizeAst(parseResult.rootElement, report, options);
    }

    const bundle = await collectAndParseStylesheets(parseResult.parsed!, options, report);

    const registry = createRuleRegistry(undefined, {
      allowedCustomTypes: options?.allowedComponentTypes,
    });
    if (options?.rules && options.rules.length > 0) {
      registry.registerMany(options.rules);
    }

    const context = registry.createContext(options, {
      report,
      bundle,
    });

    const targetContainer = parseResult.bodyElement ?? parseResult.rootElement;
    const rawNodes: PageNode[] = targetContainer
      ? registry.convertChildren(targetContainer, context)
      : [];

    const nodes = normalizeNodeTree(rawNodes, options, report);

    const nodeCount = countTotalNodes(nodes);
    report.stats.nodeCount = nodeCount;
    report.stats.fidelityScore = computeFidelityScore(report.stats);
    report.stats.durationMs = Date.now() - startTime;

    const maxNodeCount = options?.limits?.maxNodeCount ?? 1000;
    if (maxNodeCount !== undefined && nodeCount > maxNodeCount) {
      return {
        success: false,
        nodes,
        report,
        error: `Node count limit exceeded: ${nodeCount} exceeds limit of ${maxNodeCount}`,
      };
    }

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
