/**
 * @kubuild/html-import
 * Static HTML to KUBUILD PageDocument importer and compiler
 */

import type { ResponsiveStyles } from '@kubuild/schema';
import { exportStoraPackage } from '@kubuild/core';
import {
  addDiagnostic,
  computeFidelityScore,
  createEmptyReport,
  type HtmlImportOptions,
  type HtmlImportResult,
  type HtmlNodesResult,
  type HtmlStoraPackageOptions,
  type HtmlStoraPackageResult,
  type PageNode,
} from './types.js';
import { parseHtml } from './parser.js';
import { sanitizeAst } from './sanitizer.js';
import { collectAndParseStylesheets } from './stylesheet.js';
import { computeElementStyles } from './cascade.js';
import { buildResponsiveStyles } from './responsive.js';
import { createRuleRegistry } from './rules/index.js';
import { countTotalNodes, normalizeNodeTree } from './normalizer.js';
import { processDocumentAssets } from './asset.js';
import { assemblePageDocument, validatePageDocument } from './validator.js';

export const HTML_IMPORT_VERSION = '0.1.0';

export * from './types.js';
export * from './parser.js';
export * from './sanitizer.js';
export * from './stylesheet.js';
export * from './cascade.js';
export * from './responsive.js';
export * from './rules/index.js';
export * from './normalizer.js';
export * from './asset.js';
export * from './validator.js';

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

    // Process and rehost document assets, fonts, and inline styles
    const combinedStylesheets = [
      ...(parseResult.stylesheetUrls ?? []),
      ...((parseResult.styles ?? []).map((s) => s.content)),
      ...(options?.stylesheets ?? []),
    ];
    const assetOptions: HtmlImportOptions = {
      ...options,
      stylesheets: combinedStylesheets,
    };

    const { nodes: assetProcessedNodes, theme: extractedTheme } =
      await processDocumentAssets(
        [normalizedRoot],
        assetOptions,
        report,
        options?.theme,
      );

    const processedRoot = (assetProcessedNodes[0] ?? normalizedRoot) as PageNode & { type: 'page' };

    const document = assemblePageDocument({
      rootNode: processedRoot,
      title,
      description,
      metadata: options?.metadata,
      theme: extractedTheme,
    });

    const nodeCount = countTotalNodes([processedRoot]);
    report.stats.nodeCount = nodeCount;
    report.stats.fidelityScore = computeFidelityScore(report.stats);

    const maxNodeCount = options?.limits?.maxNodeCount ?? 1000;
    if (maxNodeCount !== undefined && nodeCount > maxNodeCount) {
      report.stats.durationMs = Date.now() - startTime;
      const errMsg = `Node count limit exceeded: ${nodeCount} exceeds limit of ${maxNodeCount}`;
      addDiagnostic(report, {
        code: 'LIMIT_EXCEEDED',
        severity: 'error',
        message: errMsg,
      });
      return {
        success: false,
        document: undefined,
        report,
        error: errMsg,
      };
    }

    const validation = validatePageDocument(document, options?.limits, report);
    report.stats.durationMs = Date.now() - startTime;

    if (!validation.valid || !validation.document) {
      return {
        success: false,
        document: undefined,
        report,
        error: validation.errors.join('; ') || 'Document validation failed',
      };
    }

    return {
      success: true,
      document: validation.document,
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
 * Imports an untrusted HTML string and exports it directly into a binary .stora package archive.
 *
 * @param html The HTML string to import
 * @param options Import options, package name, and optional binary assets
 * @returns Promise resolving to an HtmlStoraPackageResult
 */
export async function importHtmlToStoraPackage(
  html: string,
  options?: HtmlStoraPackageOptions,
): Promise<HtmlStoraPackageResult> {
  const result = await importHtml(html, options);
  if (!result.success || !result.document) {
    return {
      success: false,
      report: result.report,
      error: result.error,
    };
  }

  try {
    let exportAssets:
      | Record<string, { data: Uint8Array; filename?: string; mimeType?: string }>
      | undefined;

    if (Array.isArray(options?.assets)) {
      exportAssets = {};
      for (const asset of options.assets) {
        exportAssets[asset.assetId] = {
          data: asset.data,
          filename: asset.filename,
          mimeType: asset.mimeType,
        };
      }
    }

    const exported = await exportStoraPackage(result.document, {
      assets: exportAssets,
      ...(options?.packageName ? { metadata: { title: options.packageName } } : {}),
      ...(options?.allowedComponentTypes
        ? { knownComponentTypes: options.allowedComponentTypes }
        : {}),
    });

    if (!exported.success) {
      return {
        success: false,
        report: result.report,
        error: exported.diagnosticMessage || 'Failed to export .stora package',
      };
    }

    const packageBuffer: Uint8Array =
      'archive' in exported && exported.archive instanceof Uint8Array
        ? exported.archive
        : ('buffer' in exported && exported.buffer instanceof Uint8Array
          ? exported.buffer
          : new Uint8Array());

    return {
      success: true,
      packageBuffer,
      document: result.document,
      report: result.report,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      report: result.report,
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

    const normalizedNodes = normalizeNodeTree(rawNodes, options, report);

    // Process and rehost document assets, fonts, and inline styles
    const combinedStylesheets = [
      ...(parseResult.stylesheetUrls ?? []),
      ...((parseResult.styles ?? []).map((s) => s.content)),
      ...(options?.stylesheets ?? []),
    ];
    const assetOptions: HtmlImportOptions = {
      ...options,
      stylesheets: combinedStylesheets,
    };

    const { nodes: assetProcessedNodes } = await processDocumentAssets(
      normalizedNodes,
      assetOptions,
      report,
      options?.theme,
    );

    const nodeCount = countTotalNodes(assetProcessedNodes);
    report.stats.nodeCount = nodeCount;
    report.stats.fidelityScore = computeFidelityScore(report.stats);
    report.stats.durationMs = Date.now() - startTime;

    const maxNodeCount = options?.limits?.maxNodeCount ?? 1000;
    if (maxNodeCount !== undefined && nodeCount > maxNodeCount) {
      return {
        success: false,
        nodes: assetProcessedNodes,
        report,
        error: `Node count limit exceeded: ${nodeCount} exceeds limit of ${maxNodeCount}`,
      };
    }

    return {
      success: true,
      nodes: assetProcessedNodes,
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
